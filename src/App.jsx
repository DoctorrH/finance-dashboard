import React, { useState, useEffect } from 'react';
import { fetchStockData } from './utils/api';
import TickerTable from './components/TickerTable';
import CandlestickChart from './components/CandlestickChart';
import PortfolioManager from './components/PortfolioManager';
import GoldDashboard from './components/GoldDashboard';
import FinanceDashboard from './components/FinanceDashboard';
import OverviewDashboard from './components/OverviewDashboard';
import PhysicalAssetDashboard from './components/PhysicalAssetDashboard';
import LoginPage from './components/LoginPage';
import LogoIcon from './components/LogoIcon';
import { Activity, TrendingUp, TrendingDown, Loader2, Briefcase, BarChart2, Wallet, PieChart, LogOut, Home } from 'lucide-react';
import { savePortfolioToFirebase, savePurchasingPowerToFirebase, subscribeToPortfolio, onAuthChange, signOutUser, migrateOldData, saveCashOnHand, subscribeCashOnHand } from './firebase';

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
    const unsubscribe = onAuthChange((firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Chạy migration nền — không chờ migrate xong mới tắt loading (tránh màn tối + spinner quá lâu)
        migrateOldData(firebaseUser.uid).catch((err) =>
          console.error('migrateOldData failed:', err),
        );
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
  
  const [activeTab, setActiveTab] = useState('market'); // 'market', 'portfolio'
  const [portfolio, setPortfolio] = useState([]);
  const [purchasingPower, setPurchasingPower] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeToPortfolio(uid, (data) => {
      setPortfolio(data.portfolio || []);
      setPurchasingPower(data.purchasingPower || 0);
    });
    return () => unsubscribe();
  }, [uid]);

  const handleUpdatePurchasingPower = (amount) => {
    setPurchasingPower(amount);
    savePurchasingPowerToFirebase(uid, amount);
  };

  const [cashOnHand, setCashOnHand] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeCashOnHand(uid, setCashOnHand);
    return () => unsubscribe();
  }, [uid]);

  const handleUpdateCashOnHand = (amount) => {
    setCashOnHand(amount);
    saveCashOnHand(uid, amount);
  };

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
    const timer = setInterval(loadData, 3600000); // 1 hour
    return () => clearInterval(timer);
  }, []);

  const handleAddHolding = (holding, isEditMode) => {
    const existing = portfolio.find(p => p.symbol === holding.symbol);
    let newPortfolio;
    
    if (existing) {
      if (isEditMode) {
        newPortfolio = portfolio.map(p => p.symbol === holding.symbol ? holding : p);
      } else {
        const newVolume = existing.volume + holding.volume;
        const newBuyPrice = ((existing.buyPrice * existing.volume) + (holding.buyPrice * holding.volume)) / newVolume;
        newPortfolio = portfolio.map(p => p.symbol === holding.symbol ? {
          ...p,
          volume: newVolume,
          buyPrice: newBuyPrice
        } : p);
      }
    } else {
      newPortfolio = [...portfolio, holding];
    }
    
    setPortfolio(newPortfolio);
    savePortfolioToFirebase(uid, newPortfolio);
  };

  const handleRemoveHolding = (symbol) => {
    const newPortfolio = portfolio.filter(p => p.symbol !== symbol);
    setPortfolio(newPortfolio);
    savePortfolioToFirebase(uid, newPortfolio);
  };

  const handleSellHolding = (symbol, sellVolume, sellPrice) => {
    let soldValue = 0;
    const newPortfolio = portfolio.map(p => {
      if (p.symbol === symbol) {
        soldValue = sellVolume * sellPrice * 1000;
        return { ...p, volume: p.volume - sellVolume };
      }
      return p;
    }).filter(p => p.volume > 0);

    setPortfolio(newPortfolio);
    savePortfolioToFirebase(uid, newPortfolio);

    if (soldValue > 0) {
      handleUpdatePurchasingPower(purchasingPower + soldValue);
    }
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



  return (
    <div className="app-container">
      {/* Header */}
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <LogoIcon size={30} />
          <h1>My Finance</h1>
        </div>
        
        {/* App Switcher */}
        <div className="app-switcher">
          <button 
            className={`switch-btn switch-btn-overview ${currentApp === 'overview' ? 'active' : ''}`}
            onClick={() => setCurrentApp('overview')}
          >
            <PieChart size={16} /> <span>Tổng Quan</span>
          </button>
          <button 
            className={`switch-btn switch-btn-finance ${currentApp === 'finance' ? 'active' : ''}`}
            onClick={() => setCurrentApp('finance')}
          >
            <Wallet size={16} /> <span>Tài Chính</span>
          </button>
          <button 
            className={`switch-btn switch-btn-stocks ${currentApp === 'stocks' ? 'active' : ''}`}
            onClick={() => setCurrentApp('stocks')}
          >
            <BarChart2 size={16} /> <span>Chứng Khoán</span>
          </button>
          <button 
            className={`switch-btn switch-btn-gold ${currentApp === 'gold' ? 'active' : ''}`}
            onClick={() => setCurrentApp('gold')}
          >
            <TrendingUp size={16} /> <span>Vàng</span>
          </button>
          <button 
            className={`switch-btn ${currentApp === 'assets' ? 'active' : ''}`}
            onClick={() => setCurrentApp('assets')}
            style={currentApp === 'assets' ? { background: 'rgba(20,184,166,0.15)', color: '#14b8a6', borderColor: '#14b8a6' } : {}}
          >
            <Home size={16} /> <span>Tài Sản</span>
          </button>
        </div>

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
      </header>

      {currentApp === 'overview' ? (
        <OverviewDashboard stockData={stockData} uid={uid} />
      ) : currentApp === 'finance' ? (
        <FinanceDashboard uid={uid} />
      ) : currentApp === 'gold' ? (
        <GoldDashboard uid={uid} cashOnHand={cashOnHand} onUpdateCashOnHand={handleUpdateCashOnHand} />
      ) : currentApp === 'assets' ? (
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <PhysicalAssetDashboard uid={uid} cashOnHand={cashOnHand} onUpdateCashOnHand={handleUpdateCashOnHand} />
        </div>
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
                purchasingPower={purchasingPower}
                onUpdatePurchasingPower={handleUpdatePurchasingPower}
                cashOnHand={cashOnHand}
                onUpdateCashOnHand={handleUpdateCashOnHand}
                stockData={stockData}
                onAddHolding={handleAddHolding}
                onRemoveHolding={handleRemoveHolding}
                onSellHolding={handleSellHolding}
                onSelectTicker={setSelectedTicker}
                selectedTicker={selectedTicker}
                uid={uid}
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
                

              </>
            )}
          </section>
        </main>
      )}
    </div>
  );
}

export default App;
