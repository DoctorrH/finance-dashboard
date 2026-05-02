import React, { useState, useEffect } from 'react';
import { fetchStockData, getRecommendation } from './utils/api';
import { engine } from './utils/analysisEngine';
import TickerTable from './components/TickerTable';
import CandlestickChart from './components/CandlestickChart';
import PortfolioManager from './components/PortfolioManager';
import GoldDashboard from './components/GoldDashboard';
import FinanceDashboard from './components/FinanceDashboard';
import OverviewDashboard from './components/OverviewDashboard';
import LoginPage from './components/LoginPage';
import StockScanner from './components/StockScanner';
import { Activity, TrendingUp, TrendingDown, Clock, Loader2, Lightbulb, Briefcase, BarChart2, Wallet, PieChart, LogOut, Search, Check } from 'lucide-react';
import { savePortfolioToFirebase, subscribeToPortfolio, onAuthChange, signOutUser, migrateOldData } from './firebase';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div style={{padding: '20px', color: 'var(--accent-red)'}}>Error loading chart: {this.state.error?.message || 'Something went wrong'}</div>;
    }
    return this.props.children;
  }
}

function App() {
  // === Auth State ===
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Migrate old data on first login
        await migrateOldData(firebaseUser.uid);
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // === Show loading while checking auth ===
  if (authLoading) {
    return (
      <div className="app-container" style={{justifyContent: 'center', alignItems: 'center', gap: '1rem'}}>
        <Loader2 className="animate-spin" color="var(--accent-green)" size={48} />
      </div>
    );
  }

  // === Show login page if not authenticated ===
  if (!user) {
    return <LoginPage />;
  }

  // === Authenticated: show dashboard ===
  return <Dashboard user={user} />;
}

function Dashboard({ user }) {
  const uid = user.uid;

  const [stockData, setStockData] = useState([]);
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [activeTab, setActiveTab] = useState('market'); // 'market', 'portfolio', 'scanner'
  const [portfolio, setPortfolio] = useState([]);
  const [finalReport, setFinalReport] = useState(null);
  const [isReportLoading, setIsReportLoading] = useState(false);

  // Global Scanner State
  const [scanResults, setScanResults] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  const startGlobalScan = async () => {
    if (isScanning || !stockData.length) return;
    setIsScanning(true);
    setScanProgress(0);
    const scanned = [];
    
    for (let i = 0; i < stockData.length; i++) {
      const ticker = stockData[i];
      try {
        const report = await engine.generateFinalReport(ticker);
        scanned.push({
          ...ticker,
          score: parseInt(report.rating.split('/')[0]) || 0,
          verdict: report.verdict,
          marketStatus: report.analysis?.market || 'N/A'
        });
      } catch (err) {
        console.error(`Failed to scan ${ticker.symbol}`, err);
        scanned.push({ ...ticker, score: 0, verdict: 'LỖI', marketStatus: 'N/A' });
      }
      setScanProgress(Math.round(((i + 1) / stockData.length) * 100));
      await new Promise(resolve => setTimeout(resolve, 150)); // Throttling
    }

    setScanResults([...scanned].sort((a, b) => b.score - a.score));
    setIsScanning(false);
  };

  useEffect(() => {
    const unsubscribe = subscribeToPortfolio(uid, (data) => {
      setPortfolio(data);
    });
    return () => unsubscribe();
  }, [uid]);

  useEffect(() => {
    async function getAdvancedReport() {
      if (!selectedTicker) return;
      try {
        setIsReportLoading(true);
        const report = await engine.generateFinalReport(selectedTicker, holding);
        setFinalReport(report);
      } catch (err) {
        console.error("Failed to generate report:", err);
      } finally {
        setIsReportLoading(false);
      }
    }
    getAdvancedReport();
  }, [selectedTicker, portfolio]);

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const data = await fetchStockData();
        if (data && data.length > 0) {
          setStockData(data);
          setSelectedTicker(data[0]);
        } else {
          setError('Failed to load market data.');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadData();
  }, []);

  const handleAddHolding = (holding, isEditMode) => {
    const existing = portfolio.find(p => p.symbol === holding.symbol);
    let newPortfolio;
    
    if (existing) {
      if (isEditMode) {
        // Ghi đè hoàn toàn (Overwrite)
        newPortfolio = portfolio.map(p => p.symbol === holding.symbol ? holding : p);
      } else {
        // Gộp nhiều lần mua (Merge & Average Price)
        const newVolume = existing.volume + holding.volume;
        const newBuyPrice = ((existing.buyPrice * existing.volume) + (holding.buyPrice * holding.volume)) / newVolume;
        newPortfolio = portfolio.map(p => p.symbol === holding.symbol ? {
          ...p,
          volume: newVolume,
          buyPrice: newBuyPrice
        } : p);
      }
    } else {
      // Thêm mới
      newPortfolio = [...portfolio, holding];
    }
    
    // Cập nhật giao diện lập tức, sau đó đẩy lên Cloud
    setPortfolio(newPortfolio);
    savePortfolioToFirebase(uid, newPortfolio);
  };

  const handleRemoveHolding = (symbol) => {
    const newPortfolio = portfolio.filter(p => p.symbol !== symbol);
    setPortfolio(newPortfolio);
    savePortfolioToFirebase(uid, newPortfolio);
  };

  const [currentApp, setCurrentApp] = useState('overview'); // 'overview', 'stocks', 'gold', 'finance'

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="app-container" style={{justifyContent: 'center', alignItems: 'center', gap: '1rem'}}>
        <Loader2 className="animate-spin" color="var(--accent-green)" size={48} />
        <h2 style={{color: 'var(--text-secondary)'}}>Loading Market Data...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container" style={{justifyContent: 'center', alignItems: 'center'}}>
        <div style={{color: 'var(--accent-red)', fontSize: '1.2rem'}}>{error}</div>
      </div>
    );
  }

  const getSignalColor = (signal) => {
    if (!signal) return 'var(--hold-color)';
    const s = signal.toUpperCase();
    if (s.includes('MUA') || s.includes('BUY')) return 'var(--buy-color)';
    if (s.includes('BÁN') || s.includes('SELL')) return 'var(--sell-color)';
    return 'var(--hold-color)';
  };

  // --- Personalized AI Logic (Analysis Engine v3) ---
  const holding = selectedTicker ? portfolio.find(p => p.symbol === selectedTicker.symbol) : null;
  
  const aiPrediction = finalReport?.verdict || 'HOLD';
  const aiReason = finalReport?.analysis?.technical || '';
  const aiScore = finalReport?.rating ? parseInt(finalReport.rating.split('/')[0]) : 0;
  const aiStrength = aiScore > 75 ? 'Strong' : 'Normal';
  
  // Sanitize class name for CSS (Remove spaces and special chars)
  const sanitizedPredictionClass = aiPrediction.toLowerCase().replace(/[^a-z0-9]/g, '-');



  return (
    <div className="app-container">
      {/* Header */}
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity color={currentApp === 'stocks' ? "#10b981" : currentApp === 'gold' ? "#f59e0b" : currentApp === 'overview' ? "#8b5cf6" : "#3b82f6"} size={28} />
          <h1>Finance Dashboard</h1>
        </div>

        {isScanning && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: 'rgba(16, 185, 129, 0.1)', padding: '0.4rem 1rem', borderRadius: '2rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <Loader2 className="animate-spin" size={16} color="var(--accent-green)" />
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-green)' }}>
              Đang quét thị trường: {scanProgress}%
            </div>
            <div style={{ width: '60px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: `${scanProgress}%`, height: '100%', background: 'var(--accent-green)', transition: 'width 0.3s' }}></div>
            </div>
          </div>
        )}
        
        {/* App Switcher */}
        <div className="app-switcher" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button 
            className={`switch-btn ${currentApp === 'overview' ? 'active' : ''}`}
            onClick={() => setCurrentApp('overview')}
            style={{ 
              background: currentApp === 'overview' ? 'var(--card-bg)' : 'transparent',
              border: '1px solid',
              borderColor: currentApp === 'overview' ? '#8b5cf6' : 'transparent',
              color: currentApp === 'overview' ? '#8b5cf6' : 'var(--text-secondary)',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <PieChart size={16} /> Tổng Quan
          </button>
          <button 
            className={`switch-btn ${currentApp === 'stocks' ? 'active' : ''}`}
            onClick={() => setCurrentApp('stocks')}
            style={{ 
              background: currentApp === 'stocks' ? 'var(--card-bg)' : 'transparent',
              border: '1px solid',
              borderColor: currentApp === 'stocks' ? 'var(--buy-color)' : 'transparent',
              color: currentApp === 'stocks' ? 'var(--buy-color)' : 'var(--text-secondary)',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
          >
            Chứng Khoán
          </button>
          <button 
            className={`switch-btn ${currentApp === 'gold' ? 'active' : ''}`}
            onClick={() => setCurrentApp('gold')}
            style={{ 
              background: currentApp === 'gold' ? 'var(--card-bg)' : 'transparent',
              border: '1px solid',
              borderColor: currentApp === 'gold' ? '#f59e0b' : 'transparent',
              color: currentApp === 'gold' ? '#f59e0b' : 'var(--text-secondary)',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
          >
            Thị Trường Vàng
          </button>
          <button 
            className={`switch-btn ${currentApp === 'finance' ? 'active' : ''}`}
            onClick={() => setCurrentApp('finance')}
            style={{ 
              background: currentApp === 'finance' ? 'var(--card-bg)' : 'transparent',
              border: '1px solid',
              borderColor: currentApp === 'finance' ? '#3b82f6' : 'transparent',
              color: currentApp === 'finance' ? '#3b82f6' : 'var(--text-secondary)',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <Wallet size={16} /> Tài Chính Cá Nhân
          </button>

          {/* User Info & Logout */}
          <div className="user-menu" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.5rem', paddingLeft: '1rem', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
            <img 
              src={user.photoURL} 
              alt={user.displayName} 
              style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)' }}
              referrerPolicy="no-referrer"
            />
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.displayName?.split(' ').pop()}
            </span>
            <button 
              onClick={handleSignOut}
              title="Đăng xuất"
              style={{ 
                background: 'transparent', border: 'none', color: 'var(--text-secondary)', 
                cursor: 'pointer', padding: '0.4rem', borderRadius: '0.25rem',
                transition: 'all 0.2s', display: 'flex', alignItems: 'center'
              }}
              onMouseEnter={e => e.target.style.color = '#ef4444'}
              onMouseLeave={e => e.target.style.color = 'var(--text-secondary)'}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {currentApp === 'overview' ? (
        <OverviewDashboard stockData={stockData} uid={uid} />
      ) : currentApp === 'finance' ? (
        <FinanceDashboard uid={uid} />
      ) : currentApp === 'gold' ? (
        <GoldDashboard uid={uid} />
      ) : (
        /* Stock Market Main Content */
        <main className="main-content">
          <aside className="sidebar">
            <div className="sidebar-tabs">
              <button 
                className={`tab-btn ${activeTab === 'market' ? 'active' : ''}`}
                onClick={() => setActiveTab('market')}
              >
                <BarChart2 size={16} /> Thị Trường
              </button>
              <button 
                className={`tab-btn ${activeTab === 'scanner' ? 'active' : ''}`}
                onClick={() => setActiveTab('scanner')}
              >
                <Search size={16} /> Bộ Lọc AI
              </button>
              <button 
                className={`tab-btn ${activeTab === 'portfolio' ? 'active' : ''}`}
                onClick={() => setActiveTab('portfolio')}
              >
                <Briefcase size={16} /> Danh Mục
              </button>
            </div>
            
            {activeTab === 'market' ? (
              <TickerTable 
                data={stockData} 
                selectedTicker={selectedTicker} 
                onSelectTicker={setSelectedTicker} 
              />
            ) : activeTab === 'scanner' ? (
              <div style={{ padding: '0.5rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  * Kết quả quét được duy trì ngầm khi bạn chuyển tab
                </div>
                <div style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
                  <StockScanner 
                    stockData={stockData} 
                    results={scanResults}
                    isScanning={isScanning}
                    progress={scanProgress}
                    onStartScan={startGlobalScan}
                    onSelectTicker={(s) => {
                      setSelectedTicker(s);
                      setActiveTab('market');
                    }} 
                  />
                </div>
              </div>
            ) : (
              <PortfolioManager 
                portfolio={portfolio}
                stockData={stockData}
                onAddHolding={handleAddHolding}
                onRemoveHolding={handleRemoveHolding}
                onSelectTicker={setSelectedTicker}
                selectedTicker={selectedTicker}
              />
            )}
          </aside>

          <section className="chart-container">
            {selectedTicker && (
              <>
                <div className="chart-header">
                  <div>
                    <div className="chart-title">{selectedTicker.name} ({selectedTicker.symbol})</div>
                  </div>
                  <div className="chart-stats">
                    <div className="stat-item">
                      <span className="stat-label">Current Price</span>
                      <span className="stat-value">{selectedTicker.price.toFixed(2)}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Change</span>
                      <span className={`stat-value ${selectedTicker.change >= 0 ? 'up' : 'down'}`}>
                        {selectedTicker.change >= 0 ? <TrendingUp size={18} style={{display: 'inline', marginBottom: '-2px', marginRight: '4px'}} /> : <TrendingDown size={18} style={{display: 'inline', marginBottom: '-2px', marginRight: '4px'}} />}
                        {selectedTicker.change > 0 ? '+' : ''}{selectedTicker.changePercent.toFixed(2)}%
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">RSI (14)</span>
                      <span className="stat-value" style={{color: selectedTicker.rsi > 70 ? 'var(--accent-red)' : selectedTicker.rsi < 30 ? 'var(--accent-green)' : 'var(--text-primary)'}}>
                        {selectedTicker.rsi}
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">MFI (14)</span>
                      <span className="stat-value" style={{color: selectedTicker.mfi > 80 ? 'var(--accent-red)' : selectedTicker.mfi < 20 ? 'var(--accent-green)' : 'var(--text-primary)'}}>
                        {selectedTicker.mfi}
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Vol Ratio</span>
                      <span className="stat-value" style={{color: selectedTicker.volRatio > 1.2 ? 'var(--accent-green)' : 'var(--text-primary)'}}>
                        {selectedTicker.volRatio.toFixed(2)}x
                      </span>
                    </div>
                  </div>
                </div>
                
                <ErrorBoundary>
                  <CandlestickChart data={selectedTicker.history} />
                </ErrorBoundary>
                
                <div className={`analysis-panel ${sanitizedPredictionClass}-signal ${aiStrength.toLowerCase()}`}>
                  <div className="analysis-header" style={{color: getSignalColor(aiPrediction), display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                      <Lightbulb size={18} />
                      AI Robo-Advisor: {aiPrediction} ({finalReport?.rating || '0/100'})
                    </div>
                    {isReportLoading && <Loader2 size={14} className="animate-spin" />}
                  </div>

                  {finalReport && (
                    <>
                      <div className="analysis-grid" style={{ 
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                        gap: '1rem', marginTop: '1rem', fontSize: '0.85rem' 
                      }}>
                        <div className="analysis-item" style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '0.5rem' }}>
                          <div style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem', fontSize: '0.75rem', textTransform: 'uppercase' }}>Chất lượng (Cơ bản)</div>
                          <div style={{ fontWeight: 600 }}>{finalReport.analysis.fundamental}</div>
                        </div>
                        <div className="analysis-item" style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '0.5rem' }}>
                          <div style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem', fontSize: '0.75rem', textTransform: 'uppercase' }}>Dòng tiền ngoại</div>
                          <div style={{ fontWeight: 600 }}>{finalReport.analysis.big_money}</div>
                        </div>
                        <div className="analysis-item" style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '0.5rem' }}>
                          <div style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem', fontSize: '0.75rem', textTransform: 'uppercase' }}>Bối cảnh thị trường</div>
                          <div style={{ fontWeight: 600, color: finalReport.isBear ? 'var(--accent-red)' : 'var(--accent-green)' }}>{finalReport.analysis.market}</div>
                        </div>
                        <div className="analysis-item" style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '0.5rem' }}>
                          <div style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem', fontSize: '0.75rem', textTransform: 'uppercase' }}>Quản trị rủi ro</div>
                          <div style={{ fontWeight: 600, color: 'var(--accent-red)' }}>SL: {finalReport.risk_management.stop_loss}</div>
                        </div>
                      </div>
                      
                      <div className="analysis-content" style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                        <div style={{ fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                          <Check size={16} color="var(--accent-green)" /> Lý do từ Robot AI:
                        </div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                          {finalReport.reasons?.map((reason, idx) => (
                            <li key={idx} style={{ 
                              fontSize: '0.85rem', color: 'var(--text-secondary)', 
                              display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                              background: 'rgba(255,255,255,0.02)', padding: '0.6rem', borderRadius: '0.4rem'
                            }}>
                              <span style={{ color: 'var(--accent-green)', marginTop: '0.1rem' }}>•</span>
                              {reason}
                            </li>
                          ))}
                          {(!finalReport.reasons || finalReport.reasons.length === 0) && (
                            <li style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                              Chưa có tín hiệu kỹ thuật đặc biệt nào được ghi nhận.
                            </li>
                          )}
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </section>
        </main>
      )}
    </div>
  );
}

export default App;
