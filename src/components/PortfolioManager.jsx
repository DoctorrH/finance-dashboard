import React, { useState } from 'react';
import { Plus, Trash2, Pencil } from 'lucide-react';

export default function PortfolioManager({ portfolio, stockData, onAddHolding, onRemoveHolding, onSelectTicker, selectedTicker }) {
  const [isAdding, setIsAdding] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [volume, setVolume] = useState('');

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
      <div className="portfolio-summary">
        <div className="summary-label">Tổng Tài Sản</div>
        <div className="summary-value">{(totalValue * 1000).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} ₫</div>
        <div className={`summary-pl ${totalPl >= 0 ? 'up' : 'down'}`}>
          {totalPl >= 0 ? '+' : ''}{(totalPl * 1000).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} ₫ ({totalPlPercent.toFixed(2)}%)
        </div>
      </div>

      <div className="portfolio-actions">
        <button className="btn-add" onClick={handleAddClick}>
          <Plus size={16} /> {isAdding ? 'Hủy Bỏ' : 'Thêm Cổ Phiếu'}
        </button>
      </div>

      {isAdding && (
        <form className="add-holding-form" onSubmit={handleAdd}>
          <input 
            type="text" 
            placeholder="Mã CP (VD: HPG)" 
            value={symbol} 
            onChange={e => setSymbol(e.target.value.toUpperCase())}
            required
            className="input-field"
            disabled={isEditMode}
            style={{ opacity: isEditMode ? 0.6 : 1 }}
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
            {isEditMode ? 'Cập Nhật' : 'Lưu'}
          </button>
        </form>
      )}

      <div className="portfolio-list">
        {holdings.length === 0 && !isAdding && (
          <div className="empty-state">Chưa có cổ phiếu nào trong danh mục.</div>
        )}
        {holdings.map(item => (
          <div 
            key={item.symbol} 
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
        ))}
      </div>
    </div>
  );
}
