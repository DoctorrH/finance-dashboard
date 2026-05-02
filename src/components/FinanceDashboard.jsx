import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Edit3, ArrowUpCircle, ArrowDownCircle, 
  Target, CreditCard, PiggyBank, Calendar, ChevronDown,
  TrendingUp, TrendingDown, DollarSign, X, Check, MoreHorizontal
} from 'lucide-react';
import { 
  saveTransactions, subscribeTransactions,
  saveDebts, subscribeDebts,
  saveSavings, subscribeSavings
} from '../firebase';

const CATEGORIES_INCOME = ['Lương', 'Thưởng', 'Đầu tư', 'Freelance', 'Khác'];
const CATEGORIES_EXPENSE = ['Ăn uống', 'Di chuyển', 'Mua sắm', 'Nhà ở', 'Giáo dục', 'Y tế', 'Giải trí', 'Tiết kiệm', 'Khác'];
const REPAYMENT_OPTIONS = ['Hàng tháng', '2 tháng/lần', '3 tháng/lần', '6 tháng/lần', 'Hàng năm', 'Linh hoạt'];

function formatVND(num) {
  if (num === undefined || num === null) return '0';
  return num.toLocaleString('vi-VN') + ' ₫';
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * Tính toán lịch trả nợ thông minh (Dư nợ giảm dần)
 */
function calculateLoanSchedule(principal, ratePerYear, months, principalFrequency = 1, additionalLoans = []) {
  const schedule = [];
  let remainingPrincipal = principal;
  const monthlyRate = ratePerYear / 100 / 12;
  
  // Sắp xếp các khoản vay bổ sung theo tháng
  const additions = [...additionalLoans].sort((a, b) => a.month - b.month);
  
  for (let m = 1; m <= months; m++) {
    // Kiểm tra vay bổ sung trong tháng này
    const currentAdditions = additions.filter(a => a.month === m);
    currentAdditions.forEach(a => {
      remainingPrincipal += a.amount;
    });

    const interestPayment = remainingPrincipal * monthlyRate;
    let principalPayment = 0;
    
    // Trả gốc định kỳ (ví dụ mỗi 6 tháng)
    if (m % principalFrequency === 0) {
      principalPayment = Math.min(principal / (months / principalFrequency), remainingPrincipal);
    }

    schedule.push({
      month: m,
      interest: interestPayment,
      principal: principalPayment,
      total: interestPayment + principalPayment,
      remaining: Math.max(remainingPrincipal - principalPayment, 0)
    });

    remainingPrincipal -= principalPayment;
    if (remainingPrincipal <= 0 && m >= months) break;
  }
  return schedule;
}

// ==================== TAB 1: TRANSACTIONS ====================
function TransactionsTab({ transactions, setTransactions, uid }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ type: 'expense', amount: '', category: 'Ăn uống', note: '', date: new Date().toISOString().slice(0, 10) });
  
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth());
  const [filterYear, setFilterYear] = useState(now.getFullYear());

  const filtered = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const totalIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpense;

  const handleSubmit = () => {
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) return;
    
    const entry = { ...form, amount, id: editId || genId() };
    let updated;
    if (editId) {
      updated = transactions.map(t => t.id === editId ? entry : t);
    } else {
      updated = [...transactions, entry];
    }
    setTransactions(updated);
    saveTransactions(uid, updated);
    setShowForm(false);
    setEditId(null);
    setForm({ type: 'expense', amount: '', category: 'Ăn uống', note: '', date: new Date().toISOString().slice(0, 10) });
  };

  const handleDelete = (id) => {
    const updated = transactions.filter(t => t.id !== id);
    setTransactions(updated);
    saveTransactions(uid, updated);
  };

  const handleEdit = (t) => {
    setForm({ type: t.type, amount: t.amount.toString(), category: t.category, note: t.note, date: t.date });
    setEditId(t.id);
    setShowForm(true);
  };

  const months = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

  return (
    <div className="finance-tab-content">
      {/* Summary Cards */}
      <div className="finance-summary-row">
        <div className="finance-card income-card">
          <ArrowUpCircle size={20} />
          <div>
            <div className="finance-card-label">Thu nhập</div>
            <div className="finance-card-value">{formatVND(totalIncome)}</div>
          </div>
        </div>
        <div className="finance-card expense-card">
          <ArrowDownCircle size={20} />
          <div>
            <div className="finance-card-label">Chi tiêu</div>
            <div className="finance-card-value">{formatVND(totalExpense)}</div>
          </div>
        </div>
        <div className={`finance-card balance-card ${balance >= 0 ? 'positive' : 'negative'}`}>
          <DollarSign size={20} />
          <div>
            <div className="finance-card-label">Số dư</div>
            <div className="finance-card-value">{balance >= 0 ? '+' : ''}{formatVND(balance)}</div>
          </div>
        </div>
      </div>

      {/* Filter & Add */}
      <div className="finance-toolbar">
        <div className="finance-filter">
          <Calendar size={16} />
          <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} className="finance-select">
            {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="finance-select">
            {Array.from({ length: 81 }, (_, i) => 2020 + i).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button className="btn-add" onClick={() => { setShowForm(!showForm); setEditId(null); }}>
          <Plus size={16} /> Thêm
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="finance-form">
          <div className="finance-form-row">
            <button className={`type-btn ${form.type === 'income' ? 'active-income' : ''}`} onClick={() => setForm({ ...form, type: 'income', category: 'Lương' })}>
              <ArrowUpCircle size={14} /> Thu nhập
            </button>
            <button className={`type-btn ${form.type === 'expense' ? 'active-expense' : ''}`} onClick={() => setForm({ ...form, type: 'expense', category: 'Ăn uống' })}>
              <ArrowDownCircle size={14} /> Chi tiêu
            </button>
          </div>
          <input type="number" className="input-field" placeholder="Số tiền (VNĐ)" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
          <select className="input-field" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
            {(form.type === 'income' ? CATEGORIES_INCOME : CATEGORIES_EXPENSE).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="text" className="input-field" placeholder="Ghi chú" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
          <input type="date" className="input-field" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          <div className="finance-form-actions">
            <button className="btn-submit" onClick={handleSubmit}><Check size={14} /> {editId ? 'Cập nhật' : 'Thêm'}</button>
            <button className="btn-cancel" onClick={() => { setShowForm(false); setEditId(null); }}><X size={14} /> Hủy</button>
          </div>
        </div>
      )}

      {/* Transaction List */}
      <div className="transaction-list">
        {filtered.length === 0 ? (
          <div className="empty-state">Chưa có giao dịch nào trong {months[filterMonth]} {filterYear}</div>
        ) : filtered.map(t => (
          <div key={t.id} className={`transaction-item ${t.type}`}>
            <div className="transaction-icon">
              {t.type === 'income' ? <ArrowUpCircle size={18} /> : <ArrowDownCircle size={18} />}
            </div>
            <div className="transaction-info">
              <div className="transaction-category">{t.category}</div>
              <div className="transaction-note">{t.note || '—'}</div>
            </div>
            <div className="transaction-date">{new Date(t.date).toLocaleDateString('vi-VN')}</div>
            <div className={`transaction-amount ${t.type}`}>
              {t.type === 'income' ? '+' : '-'}{formatVND(t.amount)}
            </div>
            <div className="transaction-actions">
              <button className="btn-edit" onClick={() => handleEdit(t)}><Edit3 size={14} /></button>
              <button className="btn-delete" onClick={() => handleDelete(t.id)}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== TAB 2: DEBTS ====================
function DebtsTab({ debts, setDebts, uid }) {
  const DEFAULT_FORM = { 
    name: '', principalAmount: '', totalPayable: '', 
    principalPaid: '0', totalPaid: '0', interestRate: '0', 
    startDate: new Date().toISOString().slice(0, 10), dueDate: '', 
    repaymentSchedule: 'Hàng tháng',
    isSmart: true, // Mặc định dùng chế độ thông minh
    principalFreq: '1' // Mặc định trả gốc mỗi tháng
  };

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [actionId, setActionId] = useState(null);
  const [actionType, setActionType] = useState('pay'); // 'pay' or 'borrow'
  const [payPrincipal, setPayPrincipal] = useState('');
  const [payTotal, setPayTotal] = useState('');
  const [showScheduleId, setShowScheduleId] = useState(null);

  // Auto-calculate totalPayable when principal, rate, dates change
  const autoCalcTotal = (principal, rate, start, due) => {
    const p = parseFloat(principal) || 0;
    const r = parseFloat(rate) || 0;
    if (!p || !r || !start || !due) return '';
    const years = (new Date(due) - new Date(start)) / (365.25 * 24 * 60 * 60 * 1000);
    if (years <= 0) return p.toString();
    return Math.round(p * (1 + r / 100 * years)).toString();
  };

  const handleFormChange = (field, value) => {
    const newForm = { ...form, [field]: value };
    // Auto-calc when relevant fields change
    if (['principalAmount', 'interestRate', 'startDate', 'dueDate'].includes(field)) {
      const calc = autoCalcTotal(
        field === 'principalAmount' ? value : newForm.principalAmount,
        field === 'interestRate' ? value : newForm.interestRate,
        field === 'startDate' ? value : newForm.startDate,
        field === 'dueDate' ? value : newForm.dueDate
      );
      if (calc) newForm.totalPayable = calc;
    }
    setForm(newForm);
  };

  const sumPrincipal = debts.reduce((s, d) => s + d.principalAmount, 0);
  const sumPayable = debts.reduce((s, d) => s + d.totalPayable, 0);
  const sumPrincipalPaid = debts.reduce((s, d) => s + d.principalPaid, 0);
  const sumTotalPaid = debts.reduce((s, d) => s + d.totalPaid, 0);

  const handleSubmit = () => {
    const principalAmount = parseFloat(form.principalAmount);
    const totalPayable = parseFloat(form.totalPayable) || principalAmount;
    const principalPaid = parseFloat(form.principalPaid) || 0;
    const totalPaid = parseFloat(form.totalPaid) || 0;
    const interestRate = parseFloat(form.interestRate) || 0;
    if (!principalAmount || !form.name) return;

    const entry = { 
      ...form, principalAmount, totalPayable, principalPaid, totalPaid, interestRate, 
      id: editId || genId() 
    };
    let updated;
    if (editId) {
      updated = debts.map(d => d.id === editId ? entry : d);
    } else {
      updated = [...debts, entry];
    }
    setDebts(updated);
    saveDebts(uid, updated);
    setShowForm(false);
    setEditId(null);
    setForm(DEFAULT_FORM);
  };

  const handlePayment = (id) => {
    const pPrincipal = parseFloat(payPrincipal) || 0;
    const pTotal = parseFloat(payTotal) || 0;
    if (pPrincipal <= 0 && pTotal <= 0) return;

    const updated = debts.map(d => {
      if (d.id !== id) return d;
      return { 
        ...d, 
        principalPaid: Math.min(d.principalPaid + pPrincipal, d.principalAmount),
        totalPaid: Math.min(d.totalPaid + pTotal, d.totalPayable)
      };
    });
    setDebts(updated);
    saveDebts(uid, updated);
    setActionId(null);
    setPayPrincipal('');
    setPayTotal('');
  };

  const handleBorrow = (id) => {
    const amount = parseFloat(payPrincipal) || 0;
    if (amount <= 0) return;

    const updated = debts.map(d => {
      if (d.id !== id) return d;
      const additions = d.additions || [];
      // Giả định vay thêm vào thời điểm hiện tại (tính tháng tương đối)
      const start = new Date(d.startDate);
      const now = new Date();
      const monthDiff = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
      
      return { 
        ...d, 
        principalAmount: d.principalAmount + amount,
        additions: [...additions, { amount, month: Math.max(1, monthDiff), date: now.toISOString().slice(0, 10) }]
      };
    });
    setDebts(updated);
    saveDebts(uid, updated);
    setActionId(null);
    setPayPrincipal('');
  };

  const handleDelete = (id) => {
    const updated = debts.filter(d => d.id !== id);
    setDebts(updated);
    saveDebts(uid, updated);
  };

  const handleEdit = (d) => {
    setForm({
      name: d.name,
      principalAmount: d.principalAmount.toString(),
      totalPayable: d.totalPayable.toString(),
      principalPaid: d.principalPaid.toString(),
      totalPaid: d.totalPaid.toString(),
      interestRate: d.interestRate.toString(),
      startDate: d.startDate,
      dueDate: d.dueDate || '',
      repaymentSchedule: d.repaymentSchedule
    });
    setEditId(d.id);
    setShowForm(true);
  };

  return (
    <div className="finance-tab-content">
      {/* Summary */}
      <div className="finance-summary-row four-cols">
        <div className="finance-card expense-card">
          <CreditCard size={20} />
          <div>
            <div className="finance-card-label">Tổng nợ gốc</div>
            <div className="finance-card-value">{formatVND(sumPrincipal)}</div>
          </div>
        </div>
        <div className="finance-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <Target size={20} style={{ color: '#f59e0b' }} />
          <div>
            <div className="finance-card-label">Tổng phải trả</div>
            <div className="finance-card-value" style={{ color: '#f59e0b' }}>{formatVND(sumPayable)}</div>
          </div>
        </div>
        <div className="finance-card income-card">
          <Check size={20} />
          <div>
            <div className="finance-card-label">Gốc đã trả</div>
            <div className="finance-card-value">{formatVND(sumPrincipalPaid)}</div>
          </div>
        </div>
        <div className="finance-card balance-card positive">
          <DollarSign size={20} />
          <div>
            <div className="finance-card-label">Tổng đã trả</div>
            <div className="finance-card-value">{formatVND(sumTotalPaid)}</div>
          </div>
        </div>
      </div>

      <div className="finance-toolbar">
        <div></div>
        <button className="btn-add" onClick={() => { setShowForm(!showForm); setEditId(null); setForm(DEFAULT_FORM); }}>
          <Plus size={16} /> Thêm khoản nợ
        </button>
      </div>

      {showForm && (
        <div className="finance-form">
          <input type="text" className="input-field" placeholder="Tên khoản nợ" value={form.name} onChange={e => handleFormChange('name', e.target.value)} />
          <div className="finance-form-row">
            <div style={{ flex: 1 }}>
              <label className="form-label">Nợ gốc (VNĐ)</label>
              <input type="number" className="input-field" placeholder="Số tiền gốc" value={form.principalAmount} onChange={e => handleFormChange('principalAmount', e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="form-label">Lãi suất (%/năm)</label>
              <input type="number" className="input-field" placeholder="VD: 12" value={form.interestRate} onChange={e => handleFormChange('interestRate', e.target.value)} />
            </div>
          </div>
          <div className="finance-form-row">
            <div style={{ flex: 1 }}>
              <label className="form-label">Ngày vay</label>
              <input type="date" className="input-field" value={form.startDate} onChange={e => handleFormChange('startDate', e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="form-label">Hạn trả</label>
              <input type="date" className="input-field" value={form.dueDate} onChange={e => handleFormChange('dueDate', e.target.value)} />
            </div>
          </div>
          <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
            <label className="form-label" style={{ color: '#f59e0b' }}>Tổng phải trả khi đến hạn (Tự tính = Gốc + Lãi)</label>
            <input type="number" className="input-field" placeholder="Tự động tính hoặc nhập tay" value={form.totalPayable} onChange={e => handleFormChange('totalPayable', e.target.value)} />
          </div>
          <select className="input-field" value={form.repaymentSchedule} onChange={e => handleFormChange('repaymentSchedule', e.target.value)}>
            {REPAYMENT_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <div className="finance-form-row">
            <div style={{ flex: 1 }}>
              <label className="form-label">Tần suất trả gốc (tháng/lần)</label>
              <input type="number" className="input-field" placeholder="VD: 6 (Trả mỗi 6 tháng)" value={form.principalFreq} onChange={e => handleFormChange('principalFreq', e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="form-label">Thời gian vay (tháng)</label>
              <input type="number" className="input-field" placeholder="VD: 24" value={form.durationMonths || '12'} onChange={e => handleFormChange('durationMonths', e.target.value)} />
            </div>
          </div>
          <div className="finance-form-actions">
            <button className="btn-submit" onClick={handleSubmit}><Check size={14} /> {editId ? 'Cập nhật' : 'Thêm'}</button>
            <button className="btn-cancel" onClick={() => { setShowForm(false); setEditId(null); }}><X size={14} /> Hủy</button>
          </div>
        </div>
      )}

      {/* Debt List */}
      <div className="debt-list">
        {debts.length === 0 ? (
          <div className="empty-state">Chưa có khoản nợ nào. Tuyệt vời! 🎉</div>
        ) : debts.map(d => {
          const principalRemain = d.principalAmount - d.principalPaid;
          const totalRemain = d.totalPayable - d.totalPaid;
          const principalPct = d.principalAmount > 0 ? (d.principalPaid / d.principalAmount) * 100 : 0;
          const totalPct = d.totalPayable > 0 ? (d.totalPaid / d.totalPayable) * 100 : 0;
          const isCompleted = totalRemain <= 0 && principalRemain <= 0;
          const dueDate = d.dueDate ? new Date(d.dueDate) : null;
          const isOverdue = dueDate && dueDate < new Date() && !isCompleted;
          const interestTotal = d.totalPayable - d.principalAmount;

          return (
            <div key={d.id} className={`debt-card ${isCompleted ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}`}>
              <div className="debt-header">
                <div className="debt-name">
                  {d.name}
                  {isCompleted && <span className="debt-badge done">Đã xong</span>}
                  {isOverdue && <span className="debt-badge overdue">Quá hạn</span>}
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button className="btn-edit" onClick={() => handleEdit(d)}><Edit3 size={14} /></button>
                  <button className="btn-delete" onClick={() => handleDelete(d.id)}><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="debt-details">
                <span>Gốc: {formatVND(d.principalAmount)}</span>
                <span>Lãi: {formatVND(interestTotal)}</span>
                <span>Lãi suất: {d.interestRate}%/năm</span>
                <span>Trả: {d.repaymentSchedule}</span>
              </div>
              <div className="debt-dates">
                <span>Vay: {new Date(d.startDate).toLocaleDateString('vi-VN')}</span>
                {d.dueDate && <span>Hạn: {new Date(d.dueDate).toLocaleDateString('vi-VN')}</span>}
              </div>

              {/* Progress Bar 1: Nợ gốc */}
              <div className="debt-progress-container">
                <div className="debt-progress-label">
                  <span>📌 Nợ gốc</span>
                  <span className="debt-pct">{principalPct.toFixed(1)}%</span>
                </div>
                <div className="debt-progress-bar">
                  <div className="debt-progress-fill principal" style={{ width: `${Math.min(principalPct, 100)}%` }}></div>
                </div>
                <div className="debt-progress-text">
                  <span>Đã trả gốc: {formatVND(d.principalPaid)}</span>
                  <span>Còn: {formatVND(Math.max(principalRemain, 0))}</span>
                </div>
              </div>

              {/* Progress Bar 2: Tổng phải trả */}
              <div className="debt-progress-container">
                <div className="debt-progress-label">
                  <span>💰 Tổng phải trả</span>
                  <span className="debt-pct">{totalPct.toFixed(1)}%</span>
                </div>
                <div className="debt-progress-bar">
                  <div className="debt-progress-fill total" style={{ width: `${Math.min(totalPct, 100)}%` }}></div>
                </div>
                <div className="debt-progress-text">
                  <span>Đã trả tổng: {formatVND(d.totalPaid)}</span>
                  <span>Còn: {formatVND(Math.max(totalRemain, 0))}</span>
                </div>
              </div>

              {/* Action buttons */}
              {!isCompleted && (
                <div className="debt-actions">
                  <button className="debt-action-btn" onClick={() => { setActionId(d.id); setActionType('pay'); }}>💰 Trả nợ</button>
                  <button className="debt-action-btn" onClick={() => { setActionId(d.id); setActionType('borrow'); }}>➕ Vay thêm</button>
                  <button className="debt-action-btn" onClick={() => setShowScheduleId(showScheduleId === d.id ? null : d.id)}>📅 Lịch trả</button>
                </div>
              )}

              {actionId === d.id && (
                <div className="debt-action-form">
                  <input 
                    type="number" 
                    className="input-field" 
                    placeholder={actionType === 'pay' ? "Số tiền trả gốc (VNĐ)" : "Số tiền vay thêm (VNĐ)"}
                    value={payPrincipal} 
                    onChange={e => setPayPrincipal(e.target.value)} 
                  />
                  <div className="finance-form-actions">
                    <button className="btn-submit" onClick={() => actionType === 'pay' ? handlePayment(d.id) : handleBorrow(d.id)}>Xác nhận</button>
                    <button className="btn-cancel" onClick={() => setActionId(null)}>Hủy</button>
                  </div>
                </div>
              )}

              {showScheduleId === d.id && (
                <div className="repayment-schedule-box" style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Lịch trả nợ dự kiến (Dư nợ giảm dần)</span>
                    <span style={{ color: 'var(--accent-green)' }}>{d.interestRate}%/năm</span>
                  </div>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '0.75rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0, background: '#1a1d21' }}>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                          <th style={{ padding: '0.4rem' }}>Kỳ</th>
                          <th>Gốc</th>
                          <th>Lãi</th>
                          <th>Còn lại</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calculateLoanSchedule(
                          d.principalAmount, 
                          d.interestRate, 
                          parseInt(d.durationMonths || 12), 
                          parseInt(d.principalFreq || 1),
                          d.additions || []
                        ).map(s => (
                          <tr key={s.month} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '0.4rem' }}>T.{s.month}</td>
                            <td style={{ color: s.principal > 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{s.principal > 0 ? formatVND(s.principal) : '-'}</td>
                            <td style={{ color: 'var(--accent-red)' }}>{formatVND(s.interest)}</td>
                            <td>{formatVND(s.remaining)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== TAB 3: SAVINGS ====================
function SavingsTab({ savings, setSavings, uid }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [depositId, setDepositId] = useState(null);
  const [depositAmount, setDepositAmount] = useState('');
  const DEFAULT_FORM = { name: '', targetAmount: '', currentAmount: '0' };
  const [form, setForm] = useState(DEFAULT_FORM);

  const totalSaved = savings.reduce((s, g) => s + g.currentAmount, 0);
  const totalTarget = savings.reduce((s, g) => s + g.targetAmount, 0);

  const handleSubmit = () => {
    const targetAmount = parseFloat(form.targetAmount);
    const currentAmount = parseFloat(form.currentAmount) || 0;
    if (!targetAmount || !form.name) return;

    const entry = { ...form, targetAmount, currentAmount, id: editId || genId() };
    let updated;
    if (editId) {
      updated = savings.map(g => g.id === editId ? entry : g);
    } else {
      updated = [...savings, entry];
    }
    setSavings(updated);
    saveSavings(uid, updated);
    setShowForm(false);
    setEditId(null);
    setForm(DEFAULT_FORM);
  };

  const handleDeposit = (id) => {
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) return;

    const updated = savings.map(g => g.id === id ? { ...g, currentAmount: g.currentAmount + amount } : g);
    setSavings(updated);
    saveSavings(uid, updated);
    setDepositId(null);
    setDepositAmount('');
  };

  const handleDelete = (id) => {
    const updated = savings.filter(g => g.id !== id);
    setSavings(updated);
    saveSavings(uid, updated);
  };

  const handleEdit = (g) => {
    setForm({
      name: g.name,
      targetAmount: g.targetAmount.toString(),
      currentAmount: g.currentAmount.toString()
    });
    setEditId(g.id);
    setShowForm(true);
  };

  return (
    <div className="finance-tab-content">
      {/* Summary */}
      <div className="finance-summary-row">
        <div className="finance-card income-card">
          <PiggyBank size={20} />
          <div>
            <div className="finance-card-label">Tổng tiết kiệm</div>
            <div className="finance-card-value">{formatVND(totalSaved)}</div>
          </div>
        </div>
        <div className="finance-card balance-card positive">
          <Target size={20} />
          <div>
            <div className="finance-card-label">Tổng mục tiêu</div>
            <div className="finance-card-value">{formatVND(totalTarget)}</div>
          </div>
        </div>
        <div className="finance-card expense-card">
          <TrendingUp size={20} />
          <div>
            <div className="finance-card-label">Tiến độ chung</div>
            <div className="finance-card-value">{totalTarget > 0 ? ((totalSaved / totalTarget) * 100).toFixed(1) : 0}%</div>
          </div>
        </div>
      </div>

      <div className="finance-toolbar">
        <div></div>
        <button className="btn-add" onClick={() => { setShowForm(!showForm); setEditId(null); setForm(DEFAULT_FORM); }}>
          <Plus size={16} /> Thêm mục tiêu
        </button>
      </div>

      {showForm && (
        <div className="finance-form">
          <input type="text" className="input-field" placeholder="Tên mục tiêu (VD: Mua xe, Du lịch...)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input type="number" className="input-field" placeholder="Số tiền mục tiêu (VNĐ)" value={form.targetAmount} onChange={e => setForm({ ...form, targetAmount: e.target.value })} />
          <input type="number" className="input-field" placeholder="Số tiền hiện có (VNĐ)" value={form.currentAmount} onChange={e => setForm({ ...form, currentAmount: e.target.value })} />
          <div className="finance-form-actions">
            <button className="btn-submit" onClick={handleSubmit}><Check size={14} /> {editId ? 'Cập nhật' : 'Tạo'}</button>
            <button className="btn-cancel" onClick={() => { setShowForm(false); setEditId(null); }}><X size={14} /> Hủy</button>
          </div>
        </div>
      )}

      {/* Savings Goals */}
      <div className="savings-grid">
        {savings.length === 0 ? (
          <div className="empty-state">Hãy tạo mục tiêu tiết kiệm đầu tiên! 🎯</div>
        ) : savings.map(g => {
          const progress = g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0;
          const isCompleted = progress >= 100;

          return (
            <div key={g.id} className={`savings-card ${isCompleted ? 'completed' : ''}`}>
              <div className="savings-header">
                <div className="savings-name">{g.name}</div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button className="btn-edit" onClick={() => handleEdit(g)}><Edit3 size={14} /></button>
                  <button className="btn-delete" onClick={() => handleDelete(g.id)}><Trash2 size={14} /></button>
                </div>
              </div>

              <div className="savings-progress-ring">
                <svg viewBox="0 0 100 100" className="progress-svg">
                  <circle className="progress-bg" cx="50" cy="50" r="42" />
                  <circle className="progress-fill" cx="50" cy="50" r="42" 
                    strokeDasharray={`${Math.min(progress, 100) * 2.639} 263.9`}
                    style={{ stroke: isCompleted ? 'var(--accent-green)' : '#3b82f6' }}
                  />
                </svg>
                <div className="progress-text">{Math.min(progress, 100).toFixed(0)}%</div>
              </div>

              <div className="savings-amounts">
                <div><span className="savings-label">Hiện có:</span> {formatVND(g.currentAmount)}</div>
                <div><span className="savings-label">Mục tiêu:</span> {formatVND(g.targetAmount)}</div>
                <div><span className="savings-label">Còn thiếu:</span> {formatVND(Math.max(g.targetAmount - g.currentAmount, 0))}</div>
              </div>

              {!isCompleted && (
                <>
                  <button className="savings-deposit-btn" onClick={() => { setDepositId(g.id); setDepositAmount(''); }}>
                    <Plus size={14} /> Nạp thêm
                  </button>
                  {depositId === g.id && (
                    <div className="debt-action-form">
                      <input type="number" className="input-field" placeholder="Số tiền nạp" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
                      <button className="btn-submit small" onClick={() => handleDeposit(g.id)}><Check size={14} /></button>
                      <button className="btn-cancel small" onClick={() => setDepositId(null)}><X size={14} /></button>
                    </div>
                  )}
                </>
              )}
              {isCompleted && <div className="savings-completed-badge">🎉 Hoàn thành!</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================
export default function FinanceDashboard({ uid }) {
  const [activeTab, setActiveTab] = useState('transactions');
  const [transactions, setTransactions] = useState([]);
  const [debts, setDebts] = useState([]);
  const [savings, setSavings] = useState([]);

  useEffect(() => {
    if (!uid) return;
    const unsub1 = subscribeTransactions(uid, setTransactions);
    const unsub2 = subscribeDebts(uid, setDebts);
    const unsub3 = subscribeSavings(uid, setSavings);
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [uid]);

  return (
    <div className="finance-dashboard">
      {/* Sub-tabs */}
      <div className="finance-tabs">
        <button className={`finance-tab-btn ${activeTab === 'transactions' ? 'active' : ''}`} onClick={() => setActiveTab('transactions')}>
          <DollarSign size={16} /> Chi Tiêu & Thu Nhập
        </button>
        <button className={`finance-tab-btn ${activeTab === 'debts' ? 'active' : ''}`} onClick={() => setActiveTab('debts')}>
          <CreditCard size={16} /> Quản Lý Nợ
        </button>
        <button className={`finance-tab-btn ${activeTab === 'savings' ? 'active' : ''}`} onClick={() => setActiveTab('savings')}>
          <PiggyBank size={16} /> Tiết Kiệm
        </button>
      </div>

      {/* Content */}
      {activeTab === 'transactions' && <TransactionsTab transactions={transactions} setTransactions={setTransactions} uid={uid} />}
      {activeTab === 'debts' && <DebtsTab debts={debts} setDebts={setDebts} uid={uid} />}
      {activeTab === 'savings' && <SavingsTab savings={savings} setSavings={setSavings} uid={uid} />}
    </div>
  );
}
