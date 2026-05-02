import React, { useState, useEffect } from 'react';
import { fetchDomesticGold, fetchWorldGold } from '../utils/goldApi';
import CandlestickChart from './CandlestickChart';
import { Loader2, TrendingUp, TrendingDown, Lightbulb, MapPin, Plus, Trash2, Edit3, Check, X, Briefcase } from 'lucide-react';
import { saveGoldHoldings, subscribeGoldHoldings } from '../firebase';

function formatVND(num) {
  if (!num) return '0';
  return num.toLocaleString('vi-VN') + ' ₫';
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function GoldDashboard({ uid }) {
  const [domesticGold, setDomesticGold] = useState([]);
  const [worldGold, setWorldGold] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Gold holdings
  const [holdings, setHoldings] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [activeTab, setActiveTab] = useState('prices'); // 'prices' or 'holdings'
  const DEFAULT_FORM = { name: '', type: 'SJC', weight: '', unit: 'lượng', buyPrice: '', buyDate: new Date().toISOString().slice(0, 10) };
  const [form, setForm] = useState(DEFAULT_FORM);

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const [domestic, world] = await Promise.all([
          fetchDomesticGold(),
          fetchWorldGold()
        ]);
        setDomesticGold(domestic);
        setWorldGold(world);
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

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeGoldHoldings(uid, setHoldings);
    return () => unsub();
  }, [uid]);

  const handleSubmit = () => {
    const weight = parseFloat(form.weight);
    const buyPrice = parseFloat(form.buyPrice);
    if (!weight || !buyPrice || !form.name) return;

    const entry = { ...form, weight, buyPrice, id: editId || genId() };
    let updated;
    if (editId) {
      updated = holdings.map(h => h.id === editId ? entry : h);
    } else {
      updated = [...holdings, entry];
    }
    setHoldings(updated);
    saveGoldHoldings(uid, updated);
    setShowForm(false);
    setEditId(null);
    setForm(DEFAULT_FORM);
  };

  const handleDelete = (id) => {
    const updated = holdings.filter(h => h.id !== id);
    setHoldings(updated);
    saveGoldHoldings(uid, updated);
  };

  const handleEdit = (h) => {
    setForm({
      name: h.name,
      type: h.type,
      weight: h.weight.toString(),
      unit: h.unit,
      buyPrice: h.buyPrice.toString(),
      buyDate: h.buyDate
    });
    setEditId(h.id);
    setShowForm(true);
  };

  // Get current sell price for a holding type, adjusted by unit
  // API returns price per lượng. 1 lượng = 10 chỉ = 1 cây
  const getCurrentPrice = (type, unit) => {
    const match = domesticGold.find(d => 
      d.city.toLowerCase().includes(type.toLowerCase()) || 
      d.type.toLowerCase().includes(type.toLowerCase())
    );
    const pricePerLuong = match ? match.sell : (domesticGold[0]?.sell || 0);
    if (unit === 'chỉ') return pricePerLuong / 10;
    return pricePerLuong; // lượng and cây are the same
  };

  if (isLoading) {
    return (
      <div className="app-container" style={{justifyContent: 'center', alignItems: 'center', gap: '1rem', flex: 1}}>
        <Loader2 className="animate-spin" color="#f59e0b" size={48} />
        <h2 style={{color: 'var(--text-secondary)'}}>Loading Gold Data...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container" style={{justifyContent: 'center', alignItems: 'center', flex: 1}}>
        <div style={{color: 'var(--accent-red)', fontSize: '1.2rem'}}>{error}</div>
      </div>
    );
  }

  const getSignalColor = (signal) => {
    if (signal === 'BUY') return 'var(--buy-color)';
    if (signal === 'SELL') return 'var(--sell-color)';
    return 'var(--hold-color)';
  };

  // Calculate holdings summary
  const totalInvested = holdings.reduce((s, h) => s + h.buyPrice * h.weight, 0);
  const totalCurrentValue = holdings.reduce((s, h) => s + getCurrentPrice(h.type, h.unit) * h.weight, 0);
  const totalPL = totalCurrentValue - totalInvested;
  const totalPLPct = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

  return (
    <main className="main-content">
      {/* Sidebar */}
      <aside className="sidebar">
        {/* Tab switcher */}
        <div className="sidebar-tabs">
          <button 
            className={`tab-btn ${activeTab === 'prices' ? 'active' : ''}`}
            onClick={() => setActiveTab('prices')}
            style={{ borderBottomColor: activeTab === 'prices' ? '#f59e0b' : 'transparent' }}
          >
            <MapPin size={16} /> Giá Vàng
          </button>
          <button 
            className={`tab-btn ${activeTab === 'holdings' ? 'active' : ''}`}
            onClick={() => setActiveTab('holdings')}
            style={{ borderBottomColor: activeTab === 'holdings' ? '#f59e0b' : 'transparent' }}
          >
            <Briefcase size={16} /> Đang Nắm Giữ
          </button>
        </div>

        {activeTab === 'prices' ? (
          <>
            <div className="sidebar-header">
              <h2 style={{color: '#f59e0b'}}>Vàng Trong Nước</h2>
            </div>
            <div className="table-container">
              <table className="ticker-table">
                <thead>
                  <tr>
                    <th>Thành Phố / Loại</th>
                    <th>Mua Vào</th>
                    <th>Bán Ra</th>
                  </tr>
                </thead>
                <tbody>
                  {domesticGold.map((item, index) => (
                    <tr key={`${item.city}-${item.type}-${index}`} className="ticker-row">
                      <td className="ticker-cell">
                        <div style={{fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px'}}>
                          <MapPin size={12} color="var(--text-secondary)"/> {item.city}
                        </div>
                        <div style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>{item.type}</div>
                      </td>
                      <td className="ticker-cell" style={{color: 'var(--buy-color)', fontWeight: 600}}>
                        {item.buy.toLocaleString('vi-VN')}
                      </td>
                      <td className="ticker-cell" style={{color: 'var(--accent-red)', fontWeight: 600}}>
                        {item.sell.toLocaleString('vi-VN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, overflowY: 'auto' }}>
            {/* Holdings Summary */}
            <div className="portfolio-summary" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(15,23,42,0.8))', borderColor: 'rgba(245,158,11,0.3)' }}>
              <div className="summary-label">Tổng Giá Trị Nắm Giữ</div>
              <div className="summary-value">{formatVND(totalCurrentValue)}</div>
              <div className="summary-pl" style={{ color: totalPL >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {totalPL >= 0 ? '+' : ''}{formatVND(totalPL)} ({totalPLPct >= 0 ? '+' : ''}{totalPLPct.toFixed(2)}%)
              </div>
            </div>

            {/* Add button */}
            <div className="portfolio-actions">
              <button className="btn-add" style={{ background: '#f59e0b' }} onClick={() => { setShowForm(!showForm); setEditId(null); setForm(DEFAULT_FORM); }}>
                <Plus size={16} /> Thêm vàng
              </button>
            </div>

            {/* Form (Add New only) */}
            {showForm && !editId && (
              <div className="add-holding-form">
                <input type="text" className="input-field" placeholder="Tên (VD: Vàng SJC 1 lượng)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <select className="input-field" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option value="SJC">SJC</option>
                  <option value="DOJI">DOJI</option>
                  <option value="PNJ">PNJ</option>
                  <option value="Bảo Tín">Bảo Tín Minh Châu</option>
                  <option value="Nhẫn">Nhẫn tròn 9999</option>
                  <option value="Khác">Khác</option>
                </select>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="number" className="input-field" placeholder="Khối lượng" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} style={{ flex: 2 }} />
                  <select className="input-field" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} style={{ flex: 1 }}>
                    <option value="lượng">Lượng</option>
                    <option value="chỉ">Chỉ</option>
                    <option value="cây">Cây</option>
                  </select>
                </div>
                <input type="number" className="input-field" placeholder="Giá mua (VNĐ / lượng)" value={form.buyPrice} onChange={e => setForm({ ...form, buyPrice: e.target.value })} />
                <input type="date" className="input-field" value={form.buyDate} onChange={e => setForm({ ...form, buyDate: e.target.value })} />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn-submit" onClick={handleSubmit}><Check size={14} /> Thêm</button>
                  <button className="btn-cancel" onClick={() => { setShowForm(false); setEditId(null); }}><X size={14} /> Hủy</button>
                </div>
              </div>
            )}

            {/* Holdings List */}
            <div className="portfolio-list">
              {holdings.length === 0 ? (
                <div className="empty-state">Chưa nắm giữ vàng nào</div>
              ) : holdings.map(h => {
                const currentPrice = getCurrentPrice(h.type, h.unit);
                const invested = h.buyPrice * h.weight;
                const current = currentPrice * h.weight;
                const pl = current - invested;
                const plPct = invested > 0 ? (pl / invested) * 100 : 0;

                return (
                  <React.Fragment key={h.id}>
                    <div className="portfolio-item" style={{ gridTemplateColumns: '2fr 2fr 2fr auto' }}>
                      <div className="item-main">
                        <div className="item-symbol" style={{ color: '#f59e0b' }}>{h.name}</div>
                        <div className="item-vol">{h.weight} {h.unit} · {h.type}</div>
                        <div className="item-vol">{new Date(h.buyDate).toLocaleDateString('vi-VN')}</div>
                      </div>
                      <div className="item-price">
                        <div style={{fontSize: '0.85rem', fontWeight: 600}}>{formatVND(currentPrice)}</div>
                        <div style={{fontSize: '0.7rem', color: 'var(--text-secondary)'}}>Vốn: {formatVND(h.buyPrice)} / {h.unit}</div>
                      </div>
                      <div className="item-pl" style={{ textAlign: 'right' }}>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.9rem' }}>
                          {formatVND(current)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: pl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                          {pl >= 0 ? '+' : ''}{formatVND(pl)} ({plPct >= 0 ? '+' : ''}{plPct.toFixed(2)}%)
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <button className="btn-edit" onClick={() => handleEdit(h)}><Edit3 size={14} /></button>
                        <button className="btn-delete" onClick={() => handleDelete(h.id)}><Trash2 size={14} /></button>
                      </div>
                    </div>

                    {/* Inline Edit Form */}
                    {editId === h.id && (
                      <div className="add-holding-form inline-edit" style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
                        <input type="text" className="input-field" placeholder="Tên" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                        <select className="input-field" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                          <option value="SJC">SJC</option>
                          <option value="DOJI">DOJI</option>
                          <option value="PNJ">PNJ</option>
                          <option value="Bảo Tín">Bảo Tín Minh Châu</option>
                          <option value="Nhẫn">Nhẫn tròn 9999</option>
                          <option value="Khác">Khác</option>
                        </select>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input type="number" className="input-field" placeholder="Khối lượng" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} style={{ flex: 2 }} />
                          <select className="input-field" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} style={{ flex: 1 }}>
                            <option value="lượng">Lượng</option>
                            <option value="chỉ">Chỉ</option>
                            <option value="cây">Cây</option>
                          </select>
                        </div>
                        <input type="number" className="input-field" placeholder="Giá mua (VNĐ / lượng)" value={form.buyPrice} onChange={e => setForm({ ...form, buyPrice: e.target.value })} />
                        <input type="date" className="input-field" value={form.buyDate} onChange={e => setForm({ ...form, buyDate: e.target.value })} />
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn-submit" onClick={handleSubmit}><Check size={14} /> Cập nhật</button>
                          <button className="btn-cancel" onClick={() => { setShowForm(false); setEditId(null); }}><X size={14} /> Hủy</button>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}
      </aside>

      {/* Chart Area: World Gold */}
      <section className="chart-container">
        {worldGold && (
          <>
            <div className="chart-header">
              <div>
                <div className="chart-title" style={{color: '#f59e0b'}}>{worldGold.name} ({worldGold.symbol})</div>
              </div>
              <div className="chart-stats">
                <div className="stat-item">
                  <span className="stat-label">Current Price</span>
                  <span className="stat-value">${worldGold.price.toFixed(2)} / oz</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Change</span>
                  <span className={`stat-value ${worldGold.change >= 0 ? 'up' : 'down'}`}>
                    {worldGold.change >= 0 ? <TrendingUp size={18} style={{display: 'inline', marginBottom: '-2px', marginRight: '4px'}} /> : <TrendingDown size={18} style={{display: 'inline', marginBottom: '-2px', marginRight: '4px'}} />}
                    {worldGold.change > 0 ? '+' : ''}{worldGold.changePercent.toFixed(2)}%
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">RSI (14)</span>
                  <span className="stat-value" style={{color: worldGold.rsi > 70 ? 'var(--accent-red)' : worldGold.rsi < 30 ? 'var(--accent-green)' : 'var(--text-primary)'}}>
                    {worldGold.rsi}
                  </span>
                </div>
              </div>
            </div>
            
            <CandlestickChart data={worldGold.history} />
            
            <div className={`analysis-panel ${worldGold.prediction.toLowerCase()}-signal`}>
              <div className="analysis-header" style={{color: getSignalColor(worldGold.prediction)}}>
                <Lightbulb size={18} />
                Gợi Ý AI (Vàng Thế Giới): {worldGold.prediction === 'BUY' ? 'MUA' : worldGold.prediction === 'SELL' ? 'BÁN' : 'GIỮ'}
              </div>
              <div className="analysis-content">
                {worldGold.reason}
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
