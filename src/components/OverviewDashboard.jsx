import React, { useState, useEffect } from 'react';
import { 
  subscribeToPortfolio, 
  subscribeTransactions, 
  subscribeDebts, 
  subscribeSavings, 
  subscribeGoldHoldings,
  saveAssetHistory,
  subscribeAssetHistory,
  saveNetWorthHistory,
  subscribeNetWorthHistory,
  subscribePhysicalAssets,
  subscribePassbooks,
  subscribeCashOnHand
} from '../firebase';
import { fetchDomesticGold } from '../utils/goldApi';
import { Wallet, TrendingUp, CreditCard, PiggyBank, Target, Activity, Home } from 'lucide-react';

function formatVND(num) {
  if (!num) return '0 ₫';
  return num.toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' ₫';
}

function BarChart({ data, color, height = 200 }) {
  if (!data || data.length < 2) {
    return (
      <div style={{ width: '100%', height: `${height}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '0.5rem', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
        Hệ thống đang thu thập dữ liệu (cần ít nhất 2 tháng để vẽ biểu đồ)
      </div>
    );
  }
  const recent = data.slice(-12);
  const maxVal = Math.max(...recent.map(h => h.value), 1);
  return (
    <div style={{ padding: '0.5rem 0' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', height: `${height}px`, gap: '2px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        {recent.map(h => {
          const pct = Math.max((h.value / maxVal) * 100, 2);
          const d = new Date(h.time);
          const label = `${d.getMonth() + 1}/${d.getFullYear().toString().slice(2)}`;
          return (
            <div key={h.time} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', height: '100%' }}>
              <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                <div
                  style={{ height: `${pct}%`, width: '90%', maxWidth: '40px', background: color, borderRadius: '4px 4px 0 0', transition: 'height 0.5s ease-out' }}
                  title={`${label}: ${formatVND(h.value)}`}
                />
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function OverviewDashboard({ stockData, uid }) {
  const [portfolio, setPortfolio] = useState([]);
  const [purchasingPower, setPurchasingPower] = useState(0);
  const [goldHoldings, setGoldHoldings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [debts, setDebts] = useState([]);
  const [savings, setSavings] = useState([]);
  const [passbooks, setPassbooks] = useState([]);
  const [cashOnHand, setCashOnHand] = useState(0);
  const [domesticGold, setDomesticGold] = useState([]);
  const [assetHistory, setAssetHistory] = useState(null);
  const [netWorthHistory, setNetWorthHistory] = useState(null);
  const [physicalAssets, setPhysicalAssets] = useState([]);

  useEffect(() => {
    if (!uid) return;
    const unsubPortfolio = subscribeToPortfolio(uid, (data) => {
      setPortfolio(data.portfolio || []);
      setPurchasingPower(data.purchasingPower || 0);
    });
    const unsubGold = subscribeGoldHoldings(uid, setGoldHoldings);
    const unsubTrans = subscribeTransactions(uid, setTransactions);
    const unsubDebts = subscribeDebts(uid, setDebts);
    const unsubSavings = subscribeSavings(uid, setSavings);
    const unsubPassbooks = subscribePassbooks(uid, setPassbooks);
    const unsubHistory = subscribeAssetHistory(uid, setAssetHistory);
    const unsubNetWorth = subscribeNetWorthHistory(uid, setNetWorthHistory);
    const unsubCash = subscribeCashOnHand(uid, setCashOnHand);
    const unsubPhysical = subscribePhysicalAssets(uid, setPhysicalAssets);

    const loadGold = () => fetchDomesticGold().then(setDomesticGold).catch(console.error);
    loadGold();
    const goldTimer = setInterval(loadGold, 3600000);

    return () => {
      unsubPortfolio(); unsubGold(); unsubTrans(); unsubDebts();
      unsubSavings(); unsubPassbooks(); unsubHistory(); unsubNetWorth();
      unsubCash(); unsubPhysical();
      clearInterval(goldTimer);
    };
  }, [uid]);

  // --- Tính toán ---
  const totalStockValue = portfolio.reduce((sum, item) => {
    const live = stockData.find(s => s.symbol === item.symbol);
    return sum + (live ? live.price * item.volume * 1000 : 0);
  }, 0);
  const totalStockAccountValue = totalStockValue + purchasingPower;

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

  const totalSavings = savings.reduce((sum, s) => sum + s.currentAmount, 0) +
    passbooks.filter(p => p.status !== 'Đã tất toán').reduce((sum, p) => sum + (parseFloat(p.depositAmount) || 0), 0);

  const totalPhysicalValue = physicalAssets.reduce((sum, a) => sum + (parseFloat(a.currentValue) || 0), 0);

  // Tổng Tài Sản = tất cả tài sản (kể cả tài sản hiện hữu)
  const totalAssets = totalStockAccountValue + totalGoldValue + totalSavings + cashOnHand + totalPhysicalValue;

  // Tổng Nợ
  const totalDebt = debts.reduce((sum, d) => sum + (d.principalAmount - d.principalPaid), 0);

  // Tài Sản Ròng = Tổng Tài Sản - Tổng Nợ
  const netWorth = totalAssets - totalDebt;

  // --- Thu Chi ---
  const isSystemTransaction = (t) => {
    if (t.isSystem && t.category !== 'Trả nợ') return true;
    const systemCategories = ['Tiết kiệm', 'Đầu tư', 'Giải ngân', 'Mua vàng', 'Mua cổ phiếu'];
    if (systemCategories.includes(t.category) && t.note) {
      const prefixes = ['Nạp tiền', 'Rút tiền', 'Hủy mục tiêu', 'Vay thêm', 'Tất toán', 'Mở sổ', 'Mua vàng', 'Bán vàng', 'Mua cổ phiếu', 'Bán cổ phiếu'];
      if (prefixes.some(prefix => t.note.startsWith(prefix))) return true;
    }
    return false;
  };
  const manualTransactions = transactions.filter(t => !isSystemTransaction(t));

  const now = new Date();
  const currentMonthTransactions = manualTransactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const currentIncome = currentMonthTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const currentExpense = currentMonthTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const netMonthly = currentIncome - currentExpense;

  // --- 6-month income/expense chart ---
  const { last6Months, maxChartValue } = React.useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ month: d.getMonth(), year: d.getFullYear(), label: `T${d.getMonth() + 1}`, income: 0, expense: 0 });
    }
    manualTransactions.forEach(t => {
      const d = new Date(t.date);
      const target = months.find(x => x.month === d.getMonth() && x.year === d.getFullYear());
      if (target) {
        if (t.type === 'income') target.income += t.amount;
        else target.expense += t.amount;
      }
    });
    const maxValue = Math.max(...months.map(m => Math.max(m.income, m.expense)), 1000000);
    return { last6Months: months, maxChartValue: maxValue };
  }, [transactions]);

  // --- Lưu lịch sử Tổng Tài Sản & Tài Sản Ròng hàng tháng ---
  const lastSavedAssets = React.useRef(0);
  const lastSavedNetWorth = React.useRef(0);

  useEffect(() => {
    if (totalAssets > 0 && Math.abs(totalAssets - lastSavedAssets.current) > 1000 && assetHistory !== null) {
      const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
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

  useEffect(() => {
    if (netWorthHistory !== null && Math.abs(netWorth - lastSavedNetWorth.current) > 1000) {
      const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const existingIndex = netWorthHistory.findIndex(h => h.time === timeStr);
      let newData = [...netWorthHistory];
      if (existingIndex >= 0) {
        if (newData[existingIndex].value === netWorth) return;
        newData[existingIndex].value = netWorth;
      } else {
        newData.push({ time: timeStr, value: netWorth });
      }
      newData.sort((a, b) => a.time.localeCompare(b.time));
      lastSavedNetWorth.current = netWorth;
      saveNetWorthHistory(uid, newData);
    }
  }, [netWorth, netWorthHistory]);

  const assetChartData = React.useMemo(() => {
    if (!assetHistory) return [];
    return [...assetHistory].sort((a, b) => a.time.localeCompare(b.time));
  }, [assetHistory]);

  const netWorthChartData = React.useMemo(() => {
    if (!netWorthHistory) return [];
    return [...netWorthHistory].sort((a, b) => a.time.localeCompare(b.time));
  }, [netWorthHistory]);

  return (
    <div className="finance-dashboard" style={{ padding: '1rem', overflowY: 'auto' }}>
      
      {/* Row 1: Summary Cards */}
      <div className="finance-summary-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '1rem' }}>
        {/* Tổng Tài Sản */}
        <div className="finance-card balance-card" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <Wallet size={24} style={{ marginBottom: '0.5rem', color: '#3b82f6' }} />
          <div className="finance-card-label">Tổng Tài Sản</div>
          <div className="finance-card-value">{formatVND(totalAssets)}</div>
        </div>

        {/* Tài Sản Ròng */}
        <div className="finance-card balance-card" style={{ flexDirection: 'column', alignItems: 'flex-start', borderLeftColor: netWorth >= 0 ? '#10b981' : '#ef4444' }}>
          <TrendingUp size={24} style={{ marginBottom: '0.5rem', color: netWorth >= 0 ? '#10b981' : '#ef4444' }} />
          <div className="finance-card-label">Tài Sản Ròng</div>
          <div className="finance-card-value" style={{ color: netWorth >= 0 ? '#10b981' : '#ef4444' }}>{formatVND(netWorth)}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>= Tổng TS − Tổng Nợ</div>
        </div>

        {/* Tổng Nợ */}
        <div className="finance-card expense-card" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <CreditCard size={24} style={{ marginBottom: '0.5rem', color: '#ef4444' }} />
          <div className="finance-card-label">Tổng Nợ Gốc</div>
          <div className="finance-card-value" style={{ color: '#ef4444' }}>{formatVND(totalDebt)}</div>
        </div>

        {/* Tổng Tiết Kiệm */}
        <div className="finance-card income-card" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <PiggyBank size={24} style={{ marginBottom: '0.5rem', color: '#10b981' }} />
          <div className="finance-card-label">Tổng Tiết Kiệm</div>
          <div className="finance-card-value">{formatVND(totalSavings)}</div>
        </div>

        {/* Tiền Nhàn Rỗi */}
        <div className="finance-card income-card" style={{ borderLeftColor: '#8b5cf6', flexDirection: 'column', alignItems: 'flex-start' }}>
          <Wallet size={24} style={{ marginBottom: '0.5rem', color: '#8b5cf6' }} />
          <div className="finance-card-label">Tiền Nhàn Rỗi</div>
          <div className="finance-card-value" style={{ color: '#fff' }}>{formatVND(cashOnHand)}</div>
        </div>
      </div>

      {/* Row 2: Asset Distribution Pie Chart */}
      <div className="finance-card" style={{ marginTop: '1.5rem', flexDirection: 'column', alignItems: 'stretch' }}>
        <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Target size={18} color="#3b82f6" /> Phân Bổ Tổng Tài Sản
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3rem', flexWrap: 'wrap', padding: '1rem' }}>
          {/* SVG Donut Chart */}
          <div style={{ position: 'relative', width: '180px', height: '180px', flexShrink: 0 }}>
            <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
              {(() => {
                const total = totalAssets || 1;
                const pStock = (totalStockAccountValue / total) * 100;
                const pGold = (totalGoldValue / total) * 100;
                const pSavings = (totalSavings / total) * 100;
                const pCash = (cashOnHand / total) * 100;
                const pPhysical = (totalPhysicalValue / total) * 100;
                const r = 40;
                const circ = 2 * Math.PI * r;
                // Stack: Physical(teal) > Savings(green) > Cash(purple) > Gold(yellow) > Stock(blue) on top
                const pAll = pPhysical + pSavings + pCash + pGold + pStock;
                return (
                  <>
                    {/* Background */}
                    <circle cx="50" cy="50" r={r} fill="transparent" stroke="#14b8a6" strokeWidth="12" strokeDasharray={`${circ} ${circ}`} strokeDashoffset="0" />
                    {/* Remove physical portion */}
                    <circle cx="50" cy="50" r={r} fill="transparent" stroke="#10b981" strokeWidth="12" strokeDasharray={`${(pSavings + pCash + pGold + pStock) / 100 * circ} ${circ}`} strokeDashoffset="0" />
                    {/* Remove savings */}
                    <circle cx="50" cy="50" r={r} fill="transparent" stroke="#8b5cf6" strokeWidth="12" strokeDasharray={`${(pCash + pGold + pStock) / 100 * circ} ${circ}`} strokeDashoffset="0" />
                    {/* Remove cash */}
                    <circle cx="50" cy="50" r={r} fill="transparent" stroke="#f59e0b" strokeWidth="12" strokeDasharray={`${(pGold + pStock) / 100 * circ} ${circ}`} strokeDashoffset="0" />
                    {/* Remove gold */}
                    <circle cx="50" cy="50" r={r} fill="transparent" stroke="#3b82f6" strokeWidth="12" strokeDasharray={`${pStock / 100 * circ} ${circ}`} strokeDashoffset="0" />
                    {/* Empty fallback */}
                    <circle cx="50" cy="50" r={r} fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="12" strokeDasharray={totalAssets === 0 ? `${circ} ${circ}` : `0 ${circ}`} />
                    <circle cx="50" cy="50" r="32" fill="var(--card-bg)" />
                  </>
                );
              })()}
            </svg>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Phân bổ</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800 }}>Tài Sản</div>
            </div>
          </div>

          <div className="asset-breakdown" style={{ flex: 1, minWidth: 'min(100%, 250px)', maxWidth: '420px' }}>
            {[
              { label: 'Chứng Khoán', value: totalStockAccountValue, color: '#3b82f6' },
              { label: 'Vàng', value: totalGoldValue, color: '#f59e0b' },
              { label: 'Tiết Kiệm', value: totalSavings, color: '#10b981' },
              { label: 'Tiền Nhàn Rỗi', value: cashOnHand, color: '#8b5cf6' },
              { label: 'Tài Sản Hiện Hữu', value: totalPhysicalValue, color: '#14b8a6' },
            ].map(item => (
              <div key={item.label} className="asset-item" style={{ marginBottom: '0.6rem', padding: '0.65rem 0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="asset-info" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="asset-color" style={{ background: item.color, width: '10px', height: '10px', borderRadius: '2px', display: 'inline-block' }}></span>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.label}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{formatVND(item.value)}</div>
                  <div style={{ fontSize: '0.72rem', color: item.color }}>{totalAssets > 0 ? ((item.value / totalAssets) * 100).toFixed(1) : 0}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Monthly summary + 6-month chart */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
        <div className="finance-card" style={{ flex: 1, minWidth: 'min(100%, 300px)', flexDirection: 'column', alignItems: 'stretch' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={18} color="#f59e0b" /> Thu/Chi Tháng Này
          </h3>
          <div className="finance-card-value" style={{ color: netMonthly >= 0 ? '#10b981' : '#ef4444', fontSize: '1.5rem', marginBottom: '1rem' }}>
            {netMonthly >= 0 ? '+' : ''}{formatVND(netMonthly)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ flex: 1, minWidth: '120px', padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '0.5rem' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>THU NHẬP</div>
              <div style={{ fontWeight: 700, color: '#10b981' }}>{formatVND(currentIncome)}</div>
            </div>
            <div style={{ flex: 1, minWidth: '120px', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '0.5rem' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>CHI TIÊU</div>
              <div style={{ fontWeight: 700, color: '#ef4444' }}>{formatVND(currentExpense)}</div>
            </div>
          </div>
        </div>

        <div className="finance-card" style={{ flex: 2, minWidth: 'min(100%, 400px)', flexDirection: 'column', alignItems: 'stretch' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={18} color="#10b981" /> Thu Chi 6 Tháng Gần Nhất
          </h3>
          <div className="bar-chart-container" style={{ display: 'flex', alignItems: 'flex-end', height: '220px', gap: '4px', paddingTop: '1rem', position: 'relative' }}>
            {last6Months.map(m => {
              const incomeHeight = Math.max((m.income / maxChartValue) * 100, 2);
              const expenseHeight = Math.max((m.expense / maxChartValue) * 100, 2);
              return (
                <div key={m.label} className="chart-group" style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                  <div className="bars" style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '2px', width: '100%', justifyContent: 'center' }}>
                    <div className="bar income-bar" style={{ height: `${incomeHeight}%`, width: '100%', maxWidth: '18px', background: 'linear-gradient(to top, #059669, #10b981)', borderRadius: '4px 4px 0 0', transition: 'height 0.3s ease' }} title={`Thu: ${formatVND(m.income)}`}></div>
                    <div className="bar expense-bar" style={{ height: `${expenseHeight}%`, width: '100%', maxWidth: '18px', background: 'linear-gradient(to top, #b91c1c, #ef4444)', borderRadius: '4px 4px 0 0', transition: 'height 0.3s ease' }} title={`Chi: ${formatVND(m.expense)}`}></div>
                  </div>
                  <div className="chart-label" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginTop: 'auto' }}>{m.label}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1.2rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', background: '#10b981', borderRadius: '2px' }}></span> Tổng Thu</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', background: '#ef4444', borderRadius: '2px' }}></span> Tổng Chi</div>
          </div>
        </div>
      </div>

      {/* Row 4: Two growth charts side by side */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
        {/* Tổng Tài Sản growth chart */}
        <div className="finance-card" style={{ flex: 1, minWidth: 'min(100%, 300px)', flexDirection: 'column', alignItems: 'stretch' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={18} color="#3b82f6" /> Tổng Tài Sản (12 Tháng)
          </h3>
          <BarChart data={assetChartData} color="linear-gradient(to top, #2563eb, #3b82f6)" height={180} />
        </div>

        {/* Tài Sản Ròng growth chart */}
        <div className="finance-card" style={{ flex: 1, minWidth: 'min(100%, 300px)', flexDirection: 'column', alignItems: 'stretch' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={18} color="#10b981" /> Tài Sản Ròng (12 Tháng)
          </h3>
          <BarChart data={netWorthChartData} color="linear-gradient(to top, #059669, #10b981)" height={180} />
        </div>
      </div>

    </div>
  );
}
