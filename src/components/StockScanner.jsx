import React, { useState, useEffect } from 'react';
import { engine } from '../utils/analysisEngine';
import { Loader2, TrendingUp, Award, AlertCircle, Search } from 'lucide-react';

export default function StockScanner({ stockData, onSelectTicker }) {
  const [results, setResults] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);

  const startScan = async () => {
    if (isScanning) return;
    setIsScanning(true);
    setProgress(0);
    const scanned = [];
    
    // Scan sequentially to be nice to the API
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
        // Add a "failed" entry so it doesn't just disappear
        scanned.push({
          ...ticker,
          score: 0,
          verdict: 'LỖI DỮ LIỆU',
          marketStatus: 'N/A'
        });
      }
      setProgress(Math.round(((i + 1) / stockData.length) * 100));
      // Small delay to avoid rate limit
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Sort by score descending
    const sorted = [...scanned].sort((a, b) => b.score - a.score);
    setResults(sorted);
    setIsScanning(false);
  };

  useEffect(() => {
    if (stockData && stockData.length > 0 && results.length === 0 && !isScanning) {
      startScan();
    }
  }, [stockData]);

  const highScores = results.filter(r => r.score >= 80);
  const others = results.filter(r => r.score < 80);

  return (
    <div className="scanner-container" style={{ padding: '1.5rem', background: 'var(--card-bg)', borderRadius: '1rem', border: '1px solid var(--border-color)', marginTop: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Award color="#f59e0b" /> Robo-Scanner 3-Tier
        </h2>
        {isScanning ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <Loader2 className="animate-spin" size={16} /> Đang quét thị trường... {progress}%
          </div>
        ) : (
          <button 
            onClick={startScan} 
            style={{ 
              padding: '0.4rem 0.8rem', 
              background: 'rgba(255,255,255,0.05)', 
              border: '1px solid var(--border-color)', 
              borderRadius: '0.5rem', 
              fontSize: '0.8rem', 
              cursor: 'pointer',
              color: 'var(--text-primary)'
            }}
          >
            Quét lại
          </button>
        )}
      </div>

      <div className="scanner-sections" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* TOP PICKS */}
        <section>
          <h3 style={{ fontSize: '0.9rem', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={16} /> Top Cổ Phiếu Đạt Điểm ( {'>'} 80 )
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {highScores.map(stock => (
              <div 
                key={stock.symbol} 
                onClick={() => onSelectTicker(stock)}
                style={{ 
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(16, 185, 129, 0.1))', 
                  padding: '1rem', borderRadius: '0.75rem', border: '2px solid #f59e0b',
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>{stock.symbol}</span>
                  <span style={{ background: '#f59e0b', color: '#000', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 900 }}>
                    {stock.score}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--accent-green)', fontWeight: 700, marginTop: '0.5rem' }}>{stock.verdict}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{stock.name}</div>
              </div>
            ))}
            {highScores.length === 0 && !isScanning && (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontStyle: 'italic' }}>Chưa tìm thấy mã nào đạt tiêu chuẩn MUA MẠNH.</div>
            )}
          </div>
        </section>

        {/* OTHERS */}
        <section>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '1rem' }}>Danh sách theo dõi khác</h3>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '0.5rem' }}>Mã</th>
                  <th>Điểm</th>
                  <th>Nhận định</th>
                  <th>Thị trường</th>
                </tr>
              </thead>
              <tbody>
                {others.map(stock => (
                  <tr 
                    key={stock.symbol} 
                    onClick={() => onSelectTicker(stock)}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700 }}>{stock.symbol}</td>
                    <td>{stock.score}</td>
                    <td style={{ color: stock.score > 60 ? 'var(--accent-green)' : stock.score < 40 ? 'var(--accent-red)' : 'inherit' }}>
                      {stock.verdict}
                    </td>
                    <td style={{ fontSize: '0.75rem' }}>{stock.marketStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
