import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Pencil, Wallet } from 'lucide-react';
import { subscribeTransactions, saveTransactions } from '../firebase';

export default function PortfolioManager({ portfolio, purchasingPower = 0, onUpdatePurchasingPower, cashOnHand = 0, onUpdateCashOnHand, stockData, onAddHolding, onRemoveHolding, onSellHolding, onSelectTicker, selectedTicker, uid }) {
  const [isAdding, setIsAdding] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [volume, setVolume] = useState('');

  const [isSelling, setIsSelling] = useState(false);
  const [sellSymbol, setSellSymbol] = useState('');
  const [sellVolume, setSellVolume] = useState('');
  const [sellPrice, setSellPrice] = useState('');

  // Sức mua cash state
  const [isEditingCash, setIsEditingCash] = useState(false);
  const [cashInput, setCashInput] = useState('');

  // Sức mua topup states
  const [isShowingTopup, setIsShowingTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeTransactions(uid, setTransactions);
    return () => unsub();
  }, [uid]);

  const genId = () => {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  };

  const handleSaveCash = (e) => {
    e.preventDefault();
    const amount = Number(cashInput);
    if (isNaN(amount) || amount < 0) {
      alert('Vui lòng nhập số tiền mặt hợp lệ.');
      return;
    }
    onUpdatePurchasingPower(amount);
    setIsEditingCash(false);
  };

  const handleTopupSubmit = (e) => {
    e.preventDefault();
    const amount = Number(topupAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Vui lòng nhập số tiền hợp lệ.');
      return;
    }

    if (cashOnHand < amount) {
      alert(`Số dư Tiền Nhàn Rỗi không đủ để chuyển vào Sức Mua.\n(Hiện tại: ${cashOnHand.toLocaleString('vi-VN')} ₫, Cần nạp: ${amount.toLocaleString('vi-VN')} ₫)`);
      return;
    }

    // Trừ Tiền Nhàn Rỗi, cộng vào Sức Mua
    onUpdateCashOnHand(cashOnHand - amount);
    onUpdatePurchasingPower(purchasingPower + amount);

    // Tự sinh giao dịch Chi tiêu
    const newTransaction = {
      id: genId(),
      type: 'expense',
      amount: amount,
      category: 'Đầu tư',
      note: `Nạp tiền vào tài khoản chứng khoán (Bổ sung Sức mua)`,
      date: new Date().toISOString().split('T')[0]
    };
    const updatedTransactions = [...transactions, newTransaction];
    setTransactions(updatedTransactions);
    saveTransactions(uid, updatedTransactions);

    setIsShowingTopup(false);
    setTopupAmount('');
  };

  const handleAdd = (e, shouldDeduct = false) => {
    if (e) e.preventDefault();
    if (!symbol || !buyPrice || !volume) return;
    
    const exists = stockData.find(s => s.symbol.toUpperCase() === symbol.toUpperCase());
    if (!exists) {
      alert('Mã cổ phiếu này không được hỗ trợ trong danh sách theo dõi hiện tại.');
      return;
    }

    const priceVal = Number(buyPrice);
    const volumeVal = Number(volume);

    if (shouldDeduct) {
      const cost = priceVal * volumeVal * 1000;
      if (purchasingPower < cost) {
        alert(`Số dư Sức Mua không đủ để mua cổ phiếu này.\n(Sức mua hiện tại: ${purchasingPower.toLocaleString('vi-VN')} ₫, Chi phí mua: ${cost.toLocaleString('vi-VN')} ₫)`);
        return;
      }
      onUpdatePurchasingPower(purchasingPower - cost);
    }

    onAddHolding({
      symbol: symbol.toUpperCase(),
      buyPrice: priceVal,
      volume: volumeVal
    }, isEditMode);

    resetForm();
  };

  const resetForm = () => {
    setSymbol('');
    setBuyPrice('');
    setVolume('');
    setIsAdding(false);
    setIsEditMode(false);
  };

  const handleEditClick = (e, item) => {
    e.stopPropagation();
    setSymbol(item.symbol);
    setBuyPrice(item.buyPrice);
    setVolume(item.volume);
    setIsEditMode(true);
    setIsAdding(true);
    setIsSelling(false);
  };

  const handleSellClick = (e, item) => {
    e.stopPropagation();
    setSellSymbol(item.symbol);
    setSellPrice(item.currentPrice);
    setSellVolume(item.volume);
    setIsSelling(true);
    setIsEditMode(false);
    setIsAdding(false);
  };

  const handleSellSubmit = (e, maxVolume) => {
    e.preventDefault();
    const v = Number(sellVolume);
    const p = Number(sellPrice);
    if (isNaN(v) || v <= 0 || isNaN(p) || p <= 0) {
      alert("Vui lòng nhập khối lượng và giá hợp lệ!");
      return;
    }
    if (v > maxVolume) {
      alert("Khối lượng bán không được vượt quá số lượng đang nắm giữ!");
      return;
    }
    
    if (onSellHolding) {
      onSellHolding(sellSymbol, v, p);
    }
    
    setIsSelling(false);
    setSellSymbol('');
    setSellVolume('');
    setSellPrice('');
  };

  const handleAddClick = () => {
    if (isAdding) {
      resetForm();
    } else {
      setIsAdding(true);
      setIsEditMode(false);
      setIsSelling(false);
      setSymbol('');
      setBuyPrice('');
      setVolume('');
    }
  };

  const holdings = portfolio.map(item => {
    const live = stockData.find(s => s.symbol === item.symbol);
    if (!live) return null;
    
    const currentPrice = live.price;
    const value = currentPrice * item.volume;
    const cost = item.buyPrice * item.volume;
    const pl = value - cost;
    const plPercent = cost > 0 ? (pl / cost) * 100 : 0;
    
    return {
      ...item,
      currentPrice,
      value,
      pl,
      plPercent,
      liveData: live
    };
  }).filter(Boolean);

  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);
  const totalCost = holdings.reduce((sum, h) => sum + (h.buyPrice * h.volume), 0);
  const totalPl = totalValue - totalCost;
  const totalPlPercent = totalCost > 0 ? (totalPl / totalCost) * 100 : 0;

  return (
    <div className="portfolio-manager">
      <div className="portfolio-summary" style={{ padding: '1rem', textAlign: 'left' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
          <div>
            <div className="summary-label" style={{ marginBottom: '0.25rem' }}>Cổ Phiếu</div>
            <div className="summary-value" style={{ fontSize: '1.2rem', marginBottom: '0.1rem' }}>
              {(totalValue * 1000).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} ₫
            </div>
            <div className={`summary-pl ${totalPl >= 0 ? 'up' : 'down'}`} style={{ fontSize: '0.75rem' }}>
              {totalPl >= 0 ? '+' : ''}{(totalPl * 1000).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} ₫ ({totalPlPercent.toFixed(2)}%)
            </div>
          </div>
          <div style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '0.75rem' }}>
            <div className="summary-label" style={{ marginBottom: '0.25rem' }}>Sức Mua (Tiền Mặt)</div>
            {isEditingCash ? (
              <form onSubmit={handleSaveCash} style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '0.25rem' }}>
                <input
                  type="number"
                  value={cashInput}
                  onChange={(e) => setCashInput(e.target.value)}
                  className="input-field"
                  placeholder="Tiền mặt (₫)"
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box', height: '32px' }}
                  autoFocus
                  min="0"
                />
                {cashInput && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--accent-green)', textAlign: 'right', fontWeight: 'bold' }}>
                    {Number(cashInput).toLocaleString('vi-VN')} ₫
                  </div>
                )}
                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn-submit" style={{ padding: '2px 8px', fontSize: '0.75rem', borderRadius: '4px', height: '24px', cursor: 'pointer' }}>Lưu</button>
                  <button type="button" onClick={() => setIsEditingCash(false)} style={{ padding: '2px 8px', fontSize: '0.75rem', borderRadius: '4px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', height: '24px', cursor: 'pointer' }}>Hủy</button>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                <span className="summary-value" style={{ fontSize: '1.2rem', marginBottom: 0 }}>
                  {purchasingPower.toLocaleString('vi-VN')} ₫
                </span>
                <button
                  onClick={() => {
                    setCashInput(purchasingPower.toString());
                    setIsEditingCash(true);
                  }}
                  title="Chỉnh sửa sức mua"
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setIsShowingTopup(!isShowingTopup)}
                  style={{ marginTop: '0.5rem', background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.25)', color: '#c084fc', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}
                >
                  <Plus size={10} /> Bổ sung
                </button>
              </div>
            )}

            {isShowingTopup && (
              <form onSubmit={handleTopupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Nguồn: Tiền nhàn rỗi ({cashOnHand.toLocaleString('vi-VN')} ₫)</div>
                <input
                  type="number"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  className="input-field"
                  placeholder="Nhập số tiền (₫)"
                  style={{ padding: '2px 6px', fontSize: '0.8rem', height: '28px', boxSizing: 'border-box' }}
                  min="1"
                  required
                  autoFocus
                />
                {topupAmount && (
                  <div style={{ fontSize: '0.65rem', color: 'var(--accent-green)', fontWeight: 'bold' }}>
                    {Number(topupAmount).toLocaleString('vi-VN')} ₫
                  </div>
                )}
                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', marginTop: '2px' }}>
                  <button type="submit" className="btn-submit" style={{ padding: '2px 8px', fontSize: '0.7rem', height: '22px', cursor: 'pointer' }}>Nạp</button>
                  <button type="button" className="btn-cancel" onClick={() => { setIsShowingTopup(false); setTopupAmount(''); }} style={{ padding: '2px 8px', fontSize: '0.7rem', height: '22px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>Hủy</button>
                </div>
              </form>
            )}
          </div>
        </div>
        
        <div style={{ textAlign: 'center' }}>
          <div className="summary-label" style={{ marginBottom: '0.1rem', fontSize: '0.7rem' }}>Tổng Giá Trị Tài Khoản</div>
          <div className="summary-value" style={{ fontSize: '1.6rem', color: 'var(--accent-green)', marginBottom: 0 }}>
            {((totalValue * 1000) + purchasingPower).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} ₫
          </div>
        </div>
      </div>

      <div className="portfolio-actions">
        <button className="btn-add" onClick={handleAddClick}>
          <Plus size={16} /> {isAdding ? 'Hủy Bỏ' : 'Thêm Cổ Phiếu'}
        </button>
      </div>

      {isAdding && !isEditMode && (
        <form className="add-holding-form" onSubmit={handleAdd}>
          <input 
            type="text" 
            placeholder="Mã CP (VD: HPG)" 
            value={symbol} 
            onChange={e => setSymbol(e.target.value.toUpperCase())}
            required
            className="input-field"
          />
          <input 
            type="number" 
            placeholder="Giá Mua (VND)" 
            value={buyPrice} 
            onChange={e => setBuyPrice(e.target.value)}
            min="0"
            step="0.01"
            required
            className="input-field"
          />
          <input 
            type="number" 
            placeholder="Khối Lượng" 
            value={volume} 
            onChange={e => setVolume(e.target.value)}
            min="1"
            required
            className="input-field"
          />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', width: '100%', flexWrap: 'wrap' }}>
            <button 
              type="button" 
              className="btn-submit" 
              style={{ flex: 1, minWidth: '130px', background: 'var(--buy-color)', cursor: 'pointer' }}
              onClick={(e) => handleAdd(e, true)}
            >
              Mua (Trừ Sức Mua)
            </button>
            <button 
              type="button" 
              style={{ flex: 1, minWidth: '130px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
              onClick={(e) => handleAdd(e, false)}
            >
              Thêm (Không trừ tiền)
            </button>
          </div>
        </form>
      )}

      <div className="portfolio-list">
        {holdings.length === 0 && !isAdding && (
          <div className="empty-state">Chưa có cổ phiếu nào trong danh mục.</div>
        )}
        {holdings.map(item => (
          <React.Fragment key={item.symbol}>
            <div 
              className={`portfolio-item ${selectedTicker?.symbol === item.symbol ? 'selected' : ''}`}
              onClick={() => onSelectTicker(item.liveData)}
            >
              <div className="item-main">
                <span className="item-symbol">{item.symbol}</span>
                <span className="item-vol">{item.volume.toLocaleString()} CP</span>
              </div>
              <div className="item-price">
                <span>{item.currentPrice.toFixed(2)}</span>
                <span className="item-cost">Vốn: {item.buyPrice.toFixed(2)}</span>
              </div>
              <div className={`item-pl ${item.pl >= 0 ? 'up' : 'down'}`}>
                <div style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                  {(item.value * 1000).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} ₫
                </div>
                <div style={{ fontSize: '0.75rem' }}>
                  {item.pl >= 0 ? '+' : ''}{item.plPercent.toFixed(2)}%
                </div>
              </div>
              <div style={{display: 'flex', gap: '4px'}}>
                <button 
                  className="btn-edit" 
                  style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
                  onClick={(e) => handleSellClick(e, item)}
                  title="Bán cổ phiếu"
                >
                  Bán
                </button>
                <button 
                  className="btn-edit" 
                  onClick={(e) => handleEditClick(e, item)}
                >
                  <Pencil size={16} />
                </button>
                <button 
                  className="btn-delete" 
                  onClick={(e) => {
                    e.stopPropagation();
                    if(window.confirm(`Bạn muốn xóa hoàn toàn ${item.symbol} khỏi danh mục? (Không hoàn tiền vào sức mua)`)) {
                      onRemoveHolding(item.symbol);
                    }
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Inline Sell Form */}
            {isSelling && sellSymbol === item.symbol && (
              <form className="add-holding-form inline-edit" onSubmit={(e) => handleSellSubmit(e, item.volume)} style={{ marginTop: '0.5rem', marginBottom: '1rem', background: 'rgba(239, 68, 68, 0.05)' }}>
                <input 
                  type="text" 
                  value={sellSymbol} 
                  disabled
                  className="input-field"
                  style={{ opacity: 0.6, gridColumn: 'span 1' }}
                />
                <input 
                  type="number" 
                  value={sellPrice}
                  onChange={e => setSellPrice(e.target.value)}
                  placeholder="Giá bán"
                  min="0"
                  step="0.01"
                  required
                  className="input-field"
                  style={{ gridColumn: 'span 1' }}
                />
                <input 
                  type="number" 
                  value={sellVolume}
                  onChange={e => setSellVolume(e.target.value)}
                  placeholder="Khối lượng bán"
                  min="1"
                  max={item.volume}
                  required
                  className="input-field"
                  style={{ gridColumn: 'span 1' }}
                />
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', gridColumn: 'span 3' }}>
                  <button type="submit" className="btn-submit" style={{ flex: 1, background: '#ef4444' }}>Chốt Bán</button>
                  <button type="button" className="btn-cancel" onClick={() => setIsSelling(false)} style={{ flex: 1 }}>Hủy</button>
                </div>
              </form>
            )}

            {/* Inline Edit Form */}
            {isEditMode && symbol === item.symbol && (
              <form className="add-holding-form inline-edit" onSubmit={handleAdd} style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
                <input 
                  type="text" 
                  value={symbol} 
                  disabled
                  className="input-field"
                  style={{ opacity: 0.6 }}
                />
                <input 
                  type="number" 
                  placeholder="Giá Mua (VND)" 
                  value={buyPrice} 
                  onChange={e => setBuyPrice(e.target.value)}
                  min="0"
                  step="0.01"
                  required
                  className="input-field"
                />
                <input 
                  type="number" 
                  placeholder="Khối Lượng" 
                  value={volume} 
                  onChange={e => setVolume(e.target.value)}
                  min="1"
                  required
                  className="input-field"
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="submit" className="btn-submit" style={{ flex: 1 }}>Cập Nhật</button>
                  <button type="button" className="btn-cancel" onClick={resetForm} style={{ flex: 1, padding: '0.5rem', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Hủy</button>
                </div>
              </form>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
