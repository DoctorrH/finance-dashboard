import React, { useState, useEffect } from 'react';
import { 
  subscribeToPortfolio, 
  subscribeTransactions, 
  subscribeDebts, 
  subscribeSavings, 
  subscribeGoldHoldings,
  saveAssetHistory,
  subscribeAssetHistory
} from '../firebase';
import { fetchDomesticGold } from '../utils/goldApi';
import { Wallet, TrendingUp, CreditCard, PiggyBank, Target, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import { createChart } from 'lightweight-charts';

function formatVND(num) {
  if (!num) return '0 ₫';
  return num.toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' ₫';
}

export default function OverviewDashboard({ stockData, uid }) {
  const [portfolio, setPortfolio] = useState([]);
  const [goldHoldings, setGoldHoldings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [debts, setDebts] = useState([]);
  const [savings, setSavings] = useState([]);
  const [domesticGold, setDomesticGold] = useState([]);
  const [assetHistory, setAssetHistory] = useState(null);

  useEffect(() => {
    if (!uid) return;
    // Subscriptions
    const unsubPortfolio = subscribeToPortfolio(uid, setPortfolio);
    const unsubGold = subscribeGoldHoldings(uid, setGoldHoldings);
    const unsubTrans = subscribeTransactions(uid, setTransactions);
    const unsubDebts = subscribeDebts(uid, setDebts);
    const unsubSavings = subscribeSavings(uid, setSavings);
    const unsubHistory = subscribeAssetHistory(uid, setAssetHistory);

    // Fetch gold prices
    fetchDomesticGold().then(setDomesticGold).catch(console.error);

    return () => {
      unsubPortfolio();
      unsubGold();
      unsubTrans();
      unsubDebts();
      unsubSavings();
      unsubHistory();
    };
  }, [uid]);

  // --- 1. Tính Tổng Tài Sản ---
  // Stock value
  const totalStockValue = portfolio.reduce((sum, item) => {
    const live = stockData.find(s => s.symbol === item.symbol);
    return sum + (live ? live.price * item.volume * 1000 : 0); // Multiply by 1000 for VND
  }, 0);

  // Gold value
  const getGoldPrice = (type, unit) => {
    if (!domesticGold.length) return 0;
    const match = domesticGold.find(d => 
      d.city.toLowerCase().includes(type.toLowerCase()) || 
      d.type.toLowerCase().includes(type.toLowerCase())
    );
    const pricePerLuong = match ? match.sell : (domesticGold[0]?.sell || 0);
    if (unit === 'chỉ') return pricePerLuong / 10;
    return pricePerLuong;
  };
  const totalGoldValue = goldHoldings.reduce((sum, h) => sum + (getGoldPrice(h.type, h.unit) * h.weight), 0);

  const totalSavings = savings.reduce((sum, s) => sum + s.currentAmount, 0);
  const totalAssets = totalStockValue + totalGoldValue + totalSavings;

  // --- 2. Tính Tổng Nợ ---
  const totalDebt = debts.reduce((sum, d) => sum + (d.principalAmount - d.principalPaid), 0);

  // --- 4. Chi Tiêu Tháng Này ---
  const now = new Date();
  const currentMonthTransactions = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const currentIncome = currentMonthTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const currentExpense = currentMonthTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const netMonthly = currentIncome - currentExpense;

  // --- 5. Biểu đồ 6 tháng gần nhất ---
  const last6Months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    last6Months.push({
      month: d.getMonth(),
      year: d.getFullYear(),
      label: `T${d.getMonth() + 1}`,
      income: 0,
      expense: 0
    });
  }

  transactions.forEach(t => {
    const d = new Date(t.date);
    const m = d.getMonth();
    const y = d.getFullYear();
    const target = last6Months.find(x => x.month === m && x.year === y);
    if (target) {
      if (t.type === 'income') target.income += t.amount;
      else target.expense += t.amount;
    }
  });

  const maxChartValue = Math.max(...last6Months.map(m => Math.max(m.income, m.expense)), 1000000); // Tối thiểu 1tr để chart không trống

  // --- 6. Biểu đồ Tăng Trưởng Tài Sản 12 Tháng ---
  const lastSavedAssets = React.useRef(0);

  useEffect(() => {
    if (totalAssets > 0 && Math.abs(totalAssets - lastSavedAssets.current) > 1000 && assetHistory !== null) {
      const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const timeStr = currentMonthStr + '-01'; // lightweight-charts expects YYYY-MM-DD
      
      const existingIndex = assetHistory.findIndex(h => h.time === timeStr);
      let newData = [...assetHistory];
      
      if (existingIndex >= 0) {
        if (newData[existingIndex].value === totalAssets) return;
        newData[existingIndex].value = totalAssets;
      } else {
        newData.push({ time: timeStr, value: totalAssets });
      }
      
      newData.sort((a, b) => a.time.localeCompare(b.time));
      lastSavedAssets.current = totalAssets;
      saveAssetHistory(uid, newData);
    }
  }, [totalAssets, assetHistory]);

  const assetChartData = React.useMemo(() => {
    if (!assetHistory) return [];
    return [...assetHistory].sort((a, b) => a.time.localeCompare(b.time));
  }, [assetHistory]);

  const assetChartContainerRef = React.useRef(null);
  const assetChartRef = React.useRef(null);

  useEffect(() => {
    if (!assetChartContainerRef.current) return;
    if (assetChartData.length < 2) return; // Lightweight charts needs at least 2 points for an area chart
    
    try {
      if (!assetChartRef.current) {
        const chart = createChart(assetChartContainerRef.current, {
          layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#9ca3af' },
          grid: { vertLines: { color: 'rgba(255, 255, 255, 0.05)' }, horzLines: { color: 'rgba(255, 255, 255, 0.05)' } },
          rightPriceScale: { borderVisible: false },
          timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
          height: 250,
        });
        
        const areaSeries = chart.addAreaSeries({
          lineColor: '#3b82f6',
          topColor: 'rgba(59, 130, 246, 0.4)',
          bottomColor: 'rgba(59, 130, 246, 0.0)',
          lineWidth: 3,
        });
        
        assetChartRef.current = { chart, areaSeries };
      }
      
      assetChartRef.current.areaSeries.setData(assetChartData);
      assetChartRef.current.chart.timeScale().fitContent();
      
      const handleResize = () => {
        if (assetChartContainerRef.current && assetChartRef.current) {
          assetChartRef.current.chart.applyOptions({ width: assetChartContainerRef.current.clientWidth });
        }
      };
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    } catch (err) {
      console.error("Error drawing chart:", err);
    }
  }, [assetChartData]);

  return (
    <div className="finance-dashboard" style={{ padding: '1rem', overflowY: 'auto' }}>
      
      {/* 4 Summary Cards */}
      <div className="finance-summary-row four-cols">
        {/* Total Assets */}
        <div className="finance-card balance-card">
          <Wallet size={24} style={{ marginBottom: '0.5rem', color: '#3b82f6' }} />
          <div className="finance-card-label">Tổng Tài Sản</div>
          <div className="finance-card-value">{formatVND(totalAssets)}</div>
        </div>
        
        {/* Total Debts */}
        <div className="finance-card expense-card">
          <CreditCard size={24} style={{ marginBottom: '0.5rem', color: '#ef4444' }} />
          <div className="finance-card-label">Tổng Nợ Gốc</div>
          <div className="finance-card-value" style={{ color: '#ef4444' }}>{formatVND(totalDebt)}</div>
        </div>

        {/* Total Savings */}
        <div className="finance-card income-card">
          <PiggyBank size={24} style={{ marginBottom: '0.5rem', color: '#10b981' }} />
          <div className="finance-card-label">Tổng Tiết Kiệm</div>
          <div className="finance-card-value">{formatVND(totalSavings)}</div>
        </div>

        {/* Current Month Net */}
        <div className="finance-card" style={{ background: 'var(--card-bg)', borderLeft: '4px solid #f59e0b' }}>
          <Activity size={24} style={{ marginBottom: '0.5rem', color: '#f59e0b' }} />
          <div className="finance-card-label">Thu/Chi Tháng Này</div>
          <div className="finance-card-value" style={{ color: netMonthly >= 0 ? '#10b981' : '#ef4444' }}>
            {netMonthly >= 0 ? '+' : ''}{formatVND(netMonthly)}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8rem', marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center' }}><ArrowUpRight size={12} color="#10b981" /> {formatVND(currentIncome)}</span>
            <span style={{ display: 'flex', alignItems: 'center' }}><ArrowDownRight size={12} color="#ef4444" /> {formatVND(currentExpense)}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
        
        {/* Left Col: Asset Breakdown */}
        <div className="finance-card" style={{ flex: 1, minWidth: '300px' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Target size={18} color="#3b82f6" /> Phân Bổ Tài Sản
          </h3>
          
          <div className="asset-breakdown">
            <div className="asset-item">
              <div className="asset-info">
                <span className="asset-color" style={{ background: '#3b82f6' }}></span>
                <span>Chứng Khoán</span>
              </div>
              <span>{formatVND(totalStockValue)}</span>
            </div>
            <div className="asset-item">
              <div className="asset-info">
                <span className="asset-color" style={{ background: '#f59e0b' }}></span>
                <span>Vàng</span>
              </div>
              <span>{formatVND(totalGoldValue)}</span>
            </div>
            <div className="asset-item">
              <div className="asset-info">
                <span className="asset-color" style={{ background: '#10b981' }}></span>
                <span>Tiết Kiệm</span>
              </div>
              <span>{formatVND(totalSavings)}</span>
            </div>
          </div>
          
          <div className="asset-progress-bar" style={{ display: 'flex', height: '12px', borderRadius: '6px', overflow: 'hidden', marginTop: '1rem' }}>
            <div style={{ width: `${totalAssets > 0 ? (totalStockValue / totalAssets) * 100 : 33.33}%`, background: '#3b82f6' }}></div>
            <div style={{ width: `${totalAssets > 0 ? (totalGoldValue / totalAssets) * 100 : 33.33}%`, background: '#f59e0b' }}></div>
            <div style={{ width: `${totalAssets > 0 ? (totalSavings / totalAssets) * 100 : 33.34}%`, background: '#10b981' }}></div>
          </div>
        </div>

        {/* Right Col: 6 Month Chart */}
        <div className="finance-card" style={{ flex: 2, minWidth: '400px' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={18} color="#10b981" /> Thu Chi 6 Tháng Gần Nhất
          </h3>
          
          <div className="bar-chart-container" style={{ display: 'flex', alignItems: 'flex-end', height: '200px', gap: '1rem', paddingTop: '1rem', position: 'relative' }}>
            {last6Months.map(m => {
              const incomeHeight = Math.max((m.income / maxChartValue) * 100, 2); // min 2%
              const expenseHeight = Math.max((m.expense / maxChartValue) * 100, 2); // min 2%
              
              return (
                <div key={m.label} className="chart-group" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <div className="bars" style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '100%', width: '100%', justifyContent: 'center' }}>
                    <div className="bar income-bar" style={{ height: `${incomeHeight}%`, width: '20px', background: 'linear-gradient(to top, #059669, #10b981)', borderRadius: '4px 4px 0 0' }} title={`Thu: ${formatVND(m.income)}`}></div>
                    <div className="bar expense-bar" style={{ height: `${expenseHeight}%`, width: '20px', background: 'linear-gradient(to top, #b91c1c, #ef4444)', borderRadius: '4px 4px 0 0' }} title={`Chi: ${formatVND(m.expense)}`}></div>
                  </div>
                  <div className="chart-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{m.label}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', background: '#10b981', borderRadius: '2px' }}></span> Tổng Thu</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', background: '#ef4444', borderRadius: '2px' }}></span> Tổng Chi</div>
          </div>
        </div>

      </div>

      {/* Asset Growth Chart */}
      <div className="finance-card" style={{ marginTop: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <TrendingUp size={18} color="#3b82f6" /> Tăng Trưởng Tài Sản (12 Tháng)
        </h3>
        {assetChartData.length < 2 ? (
          <div style={{ width: '100%', height: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '0.5rem' }}>
            Hệ thống đang thu thập dữ liệu (cần ít nhất 2 tháng để vẽ biểu đồ)
          </div>
        ) : (
          <div ref={assetChartContainerRef} style={{ width: '100%', height: '250px' }}></div>
        )}
      </div>
    </div>
  );
}
