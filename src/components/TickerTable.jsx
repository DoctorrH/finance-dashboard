import React, { useState } from 'react';
import { Search } from 'lucide-react';

export default function TickerTable({ data, selectedTicker, onSelectTicker }) {
  const [searchQuery, setSearchQuery] = useState('');

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const filteredData = data.filter(ticker => 
    ticker.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
    ticker.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="table-container">
      <div className="search-container">
        <Search size={16} className="search-icon" />
        <input 
          type="text" 
          placeholder="Tìm kiếm mã cổ phiếu..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>
      <table className="ticker-table">
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Price</th>
            <th>Change %</th>
            <th>Vol</th>
            <th>RSI</th>
            <th>Signal</th>
          </tr>
        </thead>
        <tbody>
          {filteredData.map((ticker) => (
            <tr 
              key={ticker.symbol}
              className={`ticker-row ${selectedTicker?.symbol === ticker.symbol ? 'active' : ''}`}
              onClick={() => onSelectTicker(ticker)}
            >
              <td className="ticker-cell">
                <div>{ticker.symbol}</div>
              </td>
              <td className="ticker-cell">{ticker.price.toFixed(2)}</td>
              <td className={`ticker-cell ${ticker.change >= 0 ? 'price-up' : 'price-down'}`}>
                {ticker.change > 0 ? '+' : ''}{ticker.changePercent.toFixed(2)}%
              </td>
              <td className="ticker-cell">{formatNumber(ticker.volume)}</td>
              <td className="ticker-cell">{ticker.rsi}</td>
              <td className="ticker-cell">
                <span className={`badge badge-${ticker.prediction.toLowerCase()}`}>
                  {ticker.prediction}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
