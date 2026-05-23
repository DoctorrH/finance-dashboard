import React, { useState } from 'react';
import { Plus, Trash2, Pencil } from 'lucide-react';

export default function PortfolioManager({ portfolio, purchasingPower = 0, onUpdatePurchasingPower, stockData, onAddHolding, onRemoveHolding, onSelectTicker, selectedTicker }) {
  const [isAdding, setIsAdding] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [volume, setVolume] = useState('');

  // Sức mua cash state
  const [isEditingCash, setIsEditingCash] = useState(false);
  const [cashInput, setCashInput] = useState('');

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

  const handleAdd = (e) => {
    e.preventDefault();
    if (!symbol || !buyPrice || !volume) return;
    
    const exists = stockData.find(s => s.symbol.toUpperCase() === symbol.toUpperCase());
    if (!exists) {
      alert('Mã cổ phiếu này không được hỗ trợ trong danh sách theo dõi hiện tại.');
      return;
    }

    onAddHolding({
      symbol: symbol.toUpperCase(),
      buyPrice: Number(buyPrice),
      volume: Number(volume)
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
  };

  const handleAddClick = () => {
    if (isAdding) {
      resetForm();
    } else {
      setIsAdding(true);
      setIsEditMode(false);
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
              </div>
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
          <button type="submit" className="btn-submit">
            Lưu
          </button>
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
                  onClick={(e) => handleEditClick(e, item)}
                >
                  <Pencil size={16} />
                </button>
                <button 
                  className="btn-delete" 
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveHolding(item.symbol);
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

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
