import React, { useState, useEffect } from 'react';
import { fetchStockData } from './utils/api';
import TickerTable from './components/TickerTable';
import CandlestickChart from './components/CandlestickChart';
import PortfolioManager from './components/PortfolioManager';
import GoldDashboard from './components/GoldDashboard';
import FinanceDashboard from './components/FinanceDashboard';
import OverviewDashboard from './components/OverviewDashboard';
import LoginPage from './components/LoginPage';
import { Activity, TrendingUp, TrendingDown, Clock, Loader2, Lightbulb, Briefcase, BarChart2, Wallet, PieChart, LogOut } from 'lucide-react';
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
  
  const [activeTab, setActiveTab] = useState('market'); // 'market' or 'portfolio'
  const [portfolio, setPortfolio] = useState([]);

  useEffect(() => {
    const unsubscribe = subscribeToPortfolio(uid, (data) => {
      setPortfolio(data);
    });
    return () => unsubscribe();
  }, [uid]);

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
    if (signal === 'BUY') return 'var(--buy-color)';
    if (signal === 'SELL') return 'var(--sell-color)';
    return 'var(--hold-color)';
  };

  // Personalized AI Logic
  const holding = selectedTicker ? portfolio.find(p => p.symbol === selectedTicker.symbol) : null;
  let aiPrediction = selectedTicker ? selectedTicker.prediction : 'HOLD';
  let aiReason = selectedTicker ? selectedTicker.reason : '';

  if (holding && selectedTicker) {
    const currentPrice = selectedTicker.price;
    const plPercent = ((currentPrice - holding.buyPrice) / holding.buyPrice) * 100;
    const rsi = selectedTicker.rsi;

    if (plPercent <= -7) {
      if (rsi < 30) {
        aiPrediction = 'HOLD';
        aiReason = `Bạn đang lỗ ${Math.abs(plPercent).toFixed(2)}% nhưng RSI đang ở vùng QUÁ BÁN (${rsi}). Lực rơi sắp cạn, hạn chế bán tháo lúc này, NẮM GIỮ chờ nhịp hồi phục để cơ cấu.`;
      } else {
        aiPrediction = 'SELL';
        aiReason = `Bạn đang lỗ ${Math.abs(plPercent).toFixed(2)}%, vi phạm nguyên tắc quản trị rủi ro (> 7%). RSI là ${rsi}. Khuyến nghị CẮT LỖ dứt khoát để bảo vệ vốn.`;
      }
    } else if (plPercent >= 10) {
      if (rsi > 70) {
        aiPrediction = 'SELL';
        aiReason = `Tuyệt vời! Bạn đang lãi ${plPercent.toFixed(2)}% và cổ phiếu đã vào vùng QUÁ MUA (RSI = ${rsi}). Rủi ro đảo chiều rất cao, khuyến nghị CHỐT LỜI bảo toàn thành quả.`;
      } else {
        aiPrediction = 'HOLD';
        aiReason = `Bạn đang có mức sinh lời tốt (${plPercent.toFixed(2)}%). RSI hiện tại (${rsi}) chưa có dấu hiệu nguy hiểm. Tiếp tục NẮM GIỮ và dời điểm chặn lãi lên cao hơn.`;
      }
    } else {
      if (rsi > 70) {
        aiPrediction = 'SELL';
        aiReason = `Bạn đang nắm giữ mã này với hiệu suất ${plPercent.toFixed(2)}%. Tuy nhiên RSI đã báo động đỏ (${rsi}). Nên xem xét BÁN để tránh rủi ro điều chỉnh.`;
      } else if (rsi < 30) {
        aiPrediction = 'BUY';
        aiReason = `Bạn đang nắm giữ mã này. RSI giảm sâu về ${rsi} (Quá bán). Nếu còn sức mua, có thể xem xét GIA TĂNG tỷ trọng đón sóng hồi.`;
      } else {
        aiPrediction = 'HOLD';
        aiReason = `Cổ phiếu đang diễn biến bình thường, vị thế của bạn đang dao động ${plPercent >= 0 ? '+' : ''}${plPercent.toFixed(2)}%. Khuyến nghị tiếp tục NẮM GIỮ.`;
      }
    }
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity color={currentApp === 'stocks' ? "#10b981" : currentApp === 'gold' ? "#f59e0b" : currentApp === 'overview' ? "#8b5cf6" : "#3b82f6"} size={28} />
          <h1>Finance Dashboard</h1>
        </div>
        
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
                  </div>
                </div>
                
                <ErrorBoundary>
                  <CandlestickChart data={selectedTicker.history} />
                </ErrorBoundary>
                
                <div className={`analysis-panel ${aiPrediction.toLowerCase()}-signal`}>
                  <div className="analysis-header" style={{color: getSignalColor(aiPrediction)}}>
                    <Lightbulb size={18} />
                    Gợi Ý Của AI: Khuyến Nghị {aiPrediction === 'BUY' ? 'MUA' : aiPrediction === 'SELL' ? 'BÁN' : 'GIỮ'}
                  </div>
                  <div className="analysis-content">
                    {aiReason}
                  </div>
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
