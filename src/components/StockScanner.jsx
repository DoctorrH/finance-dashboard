import React from 'react';
import { Loader2, TrendingUp, Award, PlayCircle, CheckCircle2 } from 'lucide-react';

export default function StockScanner({ stockData, results, isScanning, progress, onStartScan, onSelectTicker }) {
  const highScores = results.filter(r => r.score >= 80);
  const others = results.filter(r => r.score < 80);

  return (
    <div className="scanner-container" style={{ padding: '1.5rem', background: 'var(--card-bg)', borderRadius: '1rem', border: '1px solid var(--border-color)', marginTop: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Award color="#f59e0b" /> Robo-Scanner AI
        </h2>
        
        {isScanning ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: 'rgba(255,255,255,0.05)', padding: '0.4rem 1rem', borderRadius: '0.5rem' }}>
            <Loader2 className="animate-spin" size={16} />
            <span style={{ fontSize: '0.85rem' }}>Đang quét... {progress}%</span>
          </div>
        ) : (
          <button 
            onClick={onStartScan} 
            style={{ 
              padding: '0.5rem 1.2rem', 
              background: 'var(--buy-color)', 
              color: 'white',
              border: 'none', 
              borderRadius: '0.5rem', 
              fontSize: '0.85rem', 
              cursor: 'pointer',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
            }}
          >
            <PlayCircle size={18} /> {results.length > 0 ? 'Quét lại thị trường' : 'Bắt đầu quét AI'}
          </button>
        )}
      </div>

      {results.length === 0 && !isScanning && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
          <Award size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
          <p>Nhấn nút <b>"Bắt đầu quét AI"</b> để tìm các cổ phiếu có dòng tiền và nền tảng tốt nhất thị trường.</p>
        </div>
      )}

      {(results.length > 0 || isScanning) && (
        <div className="scanner-sections" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* TOP PICKS */}
          <section>
            <h3 style={{ fontSize: '0.9rem', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={16} /> Top Cổ Phiếu Tiềm Năng ( {'>'} 80 )
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
              {highScores.map(stock => (
                <div 
                  key={stock.symbol} 
                  onClick={() => onSelectTicker(stock)}
                  style={{ 
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(16, 185, 129, 0.1))', 
                    padding: '1.2rem', borderRadius: '0.75rem', border: '2px solid #f59e0b',
                    cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden'
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
                    <span style={{ fontWeight: 800, fontSize: '1.2rem' }}>{stock.symbol}</span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ background: '#f59e0b', color: '#000', padding: '0.1rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.8rem', fontWeight: 900 }}>
                        {stock.score}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--accent-green)', fontWeight: 700, marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <CheckCircle2 size={14} /> {stock.verdict}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{stock.name}</div>
                </div>
              ))}
              {highScores.length === 0 && !isScanning && (
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontStyle: 'italic', gridColumn: '1/-1' }}>
                  Chưa tìm thấy mã nào đạt tiêu chuẩn MUA MẠNH trong lượt quét này.
                </div>
              )}
            </div>
          </section>

          {/* OTHERS LIST */}
          <section>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '1rem' }}>Các mã khác đang theo dõi</h3>
            <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '0.5rem' }}>
              <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--card-bg)', zIndex: 1 }}>
                  <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '0.75rem' }}>Mã</th>
                    <th>Điểm AI</th>
                    <th>Nhận định</th>
                    <th>Thị trường</th>
                  </tr>
                </thead>
                <tbody>
                  {others.map(stock => (
                    <tr 
                      key={stock.symbol} 
                      onClick={() => onSelectTicker(stock)}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer', transition: 'background 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '0.8rem 0.75rem', fontWeight: 700 }}>{stock.symbol}</td>
                      <td style={{ fontWeight: 600 }}>{stock.score}</td>
                      <td style={{ 
                        color: stock.score > 60 ? 'var(--accent-green)' : stock.score < 40 ? 'var(--accent-red)' : 'inherit',
                        fontWeight: stock.score > 60 ? 600 : 400
                      }}>
                        {stock.verdict}
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{stock.marketStatus}</td>
                    </tr>
                  ))}
                  {others.length === 0 && !isScanning && (
                    <tr>
                      <td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        Đang chờ dữ liệu quét...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
