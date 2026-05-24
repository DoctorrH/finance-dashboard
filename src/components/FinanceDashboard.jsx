import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Edit3, ArrowUpCircle, ArrowDownCircle, 
  Target, CreditCard, PiggyBank, Calendar,
  TrendingUp, DollarSign, X, Check, BookOpen, Wallet
} from 'lucide-react';
import { 
  saveTransactions, subscribeTransactions,
  saveDebts, subscribeDebts,
  saveSavings, subscribeSavings,
  savePassbooks, subscribePassbooks,
  saveCashOnHand, subscribeCashOnHand
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
function TransactionsTab({ transactions, setTransactions, cashOnHand = 0, onUpdateCashOnHand, uid }) {
  const [isEditingCash, setIsEditingCash] = useState(false);
  const [cashInput, setCashInput] = useState('');

  const handleSaveCash = (e) => {
    e.preventDefault();
    const amount = Number(cashInput);
    if (isNaN(amount) || amount < 0) {
      alert('Vui lòng nhập số tiền mặt hợp lệ.');
      return;
    }
    onUpdateCashOnHand(amount);
    setIsEditingCash(false);
  };
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ type: 'expense', amount: '', category: 'Ăn uống', note: '', date: new Date().toISOString().slice(0, 10) });
  
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth());
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = transactions.filter(t => {
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      const matchesNote = t.note?.toLowerCase().includes(query);
      const matchesCategory = t.category?.toLowerCase().includes(query);
      const matchesAmount = t.amount?.toString().includes(query);
      const dateObj = new Date(t.date);
      const matchesDate = dateObj.toLocaleDateString('vi-VN').includes(query);
      
      return matchesNote || matchesCategory || matchesAmount || matchesDate;
    }

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
      const old = transactions.find(t => t.id === editId);
      if (old) {
        const reverseDiff = old.type === 'income' ? -old.amount : old.amount;
        const newDiff = entry.type === 'income' ? amount : -amount;
        onUpdateCashOnHand(cashOnHand + reverseDiff + newDiff);
      }
    } else {
      updated = [...transactions, entry];
      const diff = entry.type === 'income' ? amount : -amount;
      onUpdateCashOnHand(cashOnHand + diff);
    }
    setTransactions(updated);
    saveTransactions(uid, updated);
    setShowForm(false);
    setEditId(null);
    setForm({ type: 'expense', amount: '', category: 'Ăn uống', note: '', date: new Date().toISOString().slice(0, 10) });
  };

  const handleDelete = (id) => {
    const target = transactions.find(t => t.id === id);
    const updated = transactions.filter(t => t.id !== id);
    setTransactions(updated);
    saveTransactions(uid, updated);
    if (target) {
      const diff = target.type === 'income' ? -target.amount : target.amount;
      onUpdateCashOnHand(cashOnHand + diff);
    }
  };

  const handleEdit = (t) => {
    setForm({ type: t.type, amount: t.amount.toString(), category: t.category, note: t.note, date: t.date });
    setEditId(t.id);
    setShowForm(true);
  };

  const months = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

  return (
    <div className="finance-tab-content">
      {/* Monthly Summary Flow Row (3 cards) */}
      <div className="finance-summary-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <div className="finance-card income-card">
          <ArrowUpCircle size={20} />
          <div>
            <div className="finance-card-label">Thu nhập tháng này</div>
            <div className="finance-card-value">{formatVND(totalIncome)}</div>
          </div>
        </div>
        <div className="finance-card expense-card">
          <ArrowDownCircle size={20} />
          <div>
            <div className="finance-card-label">Chi tiêu tháng này</div>
            <div className="finance-card-value">{formatVND(totalExpense)}</div>
          </div>
        </div>
        <div className={`finance-card balance-card ${balance >= 0 ? 'positive' : 'negative'}`}>
          <TrendingUp size={20} />
          <div>
            <div className="finance-card-label">Thặng dư tháng này</div>
            <div className="finance-card-value">{balance >= 0 ? '+' : ''}{formatVND(balance)}</div>
          </div>
        </div>
      </div>

      {/* Filter, Search & Add */}
      <div className="finance-toolbar" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="finance-filter" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Calendar size={16} />
          <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} className="finance-select" disabled={searchQuery.trim() !== ''}>
            {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="finance-select" disabled={searchQuery.trim() !== ''}>
            {Array.from({ length: 81 }, (_, i) => 2020 + i).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Search Input */}
        <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
          <input 
            type="text" 
            className="input-field" 
            placeholder="Tìm kiếm danh mục, ghi chú, số tiền..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            style={{ margin: 0, paddingRight: '2rem' }}
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              style={{ 
                position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <button className="btn-add" onClick={() => { setShowForm(!showForm); setEditId(null); }}>
          <Plus size={16} /> Thêm
        </button>
      </div>

      {searchQuery.trim() !== '' && (
        <div style={{ fontSize: '0.85rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(245, 158, 11, 0.08)', padding: '0.6rem 0.8rem', borderRadius: '0.5rem', marginTop: '-0.25rem', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
          <span>🔍 Đang tìm kiếm toàn bộ lịch sử (Tìm thấy {filtered.length} kết quả).</span>
        </div>
      )}

      {/* Form */}
      {/* Form (Add New only) */}
      {showForm && !editId && (
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
            <button className="btn-submit" onClick={handleSubmit}><Check size={14} /> Thêm</button>
            <button className="btn-cancel" onClick={() => { setShowForm(false); setEditId(null); }}><X size={14} /> Hủy</button>
          </div>
        </div>
      )}

      {/* Transaction List */}
      <div className="transaction-list">
        {filtered.length === 0 ? (
          <div className="empty-state">
            {searchQuery.trim() !== '' 
              ? `Không tìm thấy kết quả phù hợp với "${searchQuery}"`
              : `Chưa có giao dịch nào trong ${months[filterMonth]} ${filterYear}`
            }
          </div>
        ) : filtered.map(t => (
          <React.Fragment key={t.id}>
            <div className={`transaction-item ${t.type}`}>
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
            
            {/* Inline Edit Form */}
            {editId === t.id && (
              <div className="finance-form inline-edit">
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
                  <button className="btn-submit" onClick={handleSubmit}><Check size={14} /> Cập nhật</button>
                  <button className="btn-cancel" onClick={() => { setShowForm(false); setEditId(null); }}><X size={14} /> Hủy</button>
                </div>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ==================== TAB 2: DEBTS ====================
function DebtsTab({ debts, setDebts, transactions, setTransactions, cashOnHand = 0, onUpdateCashOnHand, uid }) {
  const DEFAULT_FORM = { 
    name: '', principalAmount: '', totalPayable: '', 
    principalPaid: '0', totalPaid: '0', interestRate: '0', 
    startDate: new Date().toISOString().slice(0, 10), dueDate: '', 
    durationMonths: '12',
    repaymentSchedule: 'Hàng tháng',
    isSmart: true, 
    principalFreq: '1' 
  };

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [actionId, setActionId] = useState(null);
  const [actionType, setActionType] = useState('pay'); // 'pay' or 'borrow'
  const [payPrincipal, setPayPrincipal] = useState('');
  const [payInterest, setPayInterest] = useState('');
  const [payTotal, setPayTotal] = useState('');
  const [showScheduleId, setShowScheduleId] = useState(null);

  const calculateMonths = (start, due) => {
    if (!start || !due) return '';
    const d1 = new Date(start);
    const d2 = new Date(due);
    const months = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
    return months > 0 ? months.toString() : '0';
  };

  const autoCalcTotal = (principal, rate, months, freq) => {
    const p = parseFloat(principal);
    const r = parseFloat(rate);
    const m = parseInt(months);
    if (isNaN(p) || isNaN(r) || isNaN(m) || m <= 0) return null;
    
    // Tính tổng nợ dựa trên số tháng và tần suất trả gốc
    const schedule = calculateLoanSchedule(p, r, m, parseInt(freq) || 1);
    const totalInterest = schedule.reduce((s, item) => s + item.interest, 0);
    return Math.round(p + totalInterest).toString();
  };

  const handleFormChange = (field, value) => {
    const newForm = { ...form, [field]: value };
    
    // Auto-calc totalPayable
    if (['principalAmount', 'interestRate', 'durationMonths', 'principalFreq'].includes(field)) {
      const calcTotal = autoCalcTotal(
        field === 'principalAmount' ? value : newForm.principalAmount,
        field === 'interestRate' ? value : newForm.interestRate,
        field === 'durationMonths' ? value : newForm.durationMonths,
        field === 'principalFreq' ? value : newForm.principalFreq
      );
      if (calcTotal) newForm.totalPayable = calcTotal;
      
      // Auto-update dueDate based on startDate + durationMonths
      const start = new Date(field === 'startDate' ? value : newForm.startDate);
      const m = parseInt(field === 'durationMonths' ? value : newForm.durationMonths);
      if (!isNaN(start.getTime()) && !isNaN(m)) {
        const due = new Date(start);
        due.setMonth(due.getMonth() + m);
        newForm.dueDate = due.toISOString().slice(0, 10);
      }
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
    const pInterest = parseFloat(payInterest) || 0;
    const pTotal = pPrincipal + pInterest;
    if (pPrincipal <= 0 && pInterest <= 0) return;

    if (cashOnHand < pTotal) {
      alert(`Số dư Tiền Nhàn Rỗi không đủ để thực hiện thanh toán này.\n(Số dư hiện tại: ${formatVND(cashOnHand)}, Cần thanh toán: ${formatVND(pTotal)})`);
      return;
    }

    const d = debts.find(x => x.id === id);
    if (!d) return;

    const updated = debts.map(x => {
      if (x.id !== id) return x;
      return { 
        ...x, 
        principalPaid: Math.min(x.principalPaid + pPrincipal, x.principalAmount),
        totalPaid: Math.min(x.totalPaid + pTotal, x.totalPayable)
      };
    });
    setDebts(updated);
    saveDebts(uid, updated);

    // Trừ ví Tiền Nhàn Rỗi
    onUpdateCashOnHand(cashOnHand - pTotal);

    // Tự sinh giao dịch Chi tiêu
    const newTransaction = {
      id: genId(),
      type: 'expense',
      amount: pTotal,
      category: 'Khác',
      note: `Trả nợ khoản vay: ${d.name} (Gốc: ${formatVND(pPrincipal)} + Lãi: ${formatVND(pInterest)})`,
      date: new Date().toISOString().split('T')[0]
    };
    const updatedTransactions = [...transactions, newTransaction];
    setTransactions(updatedTransactions);
    saveTransactions(uid, updatedTransactions);

    setActionId(null);
    setPayPrincipal('');
    setPayInterest('');
    setPayTotal('');
  };

  const handleBorrow = (id) => {
    const amount = parseFloat(payPrincipal) || 0;
    if (amount <= 0) return;

    const d = debts.find(x => x.id === id);
    if (!d) return;

    const updated = debts.map(x => {
      if (x.id !== id) return x;
      const additions = x.additions || [];
      const start = new Date(x.startDate);
      const now = new Date();
      const monthDiff = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
      const newPrincipal = x.principalAmount + amount;
      const newTotalPayable = parseFloat(autoCalcTotal(newPrincipal, x.interestRate, x.durationMonths, x.principalFreq)) || (x.totalPayable + amount);
      
      return { 
        ...x, 
        principalAmount: newPrincipal,
        totalPayable: newTotalPayable,
        additions: [...additions, { month: Math.max(1, monthDiff), amount }]
      };
    });
    setDebts(updated);
    saveDebts(uid, updated);

    // Cộng vào ví Tiền Nhàn Rỗi
    onUpdateCashOnHand(cashOnHand + amount);

    // Tự sinh giao dịch Thu nhập
    const newTransaction = {
      id: genId(),
      type: 'income',
      amount: amount,
      category: 'Khác',
      note: `Vay thêm từ khoản: ${d.name}`,
      date: new Date().toISOString().split('T')[0]
    };
    const updatedTransactions = [...transactions, newTransaction];
    setTransactions(updatedTransactions);
    saveTransactions(uid, updatedTransactions);

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
      durationMonths: d.durationMonths || calculateMonths(d.startDate, d.dueDate) || '12',
      principalFreq: d.principalFreq || '1',
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

      {/* Form (Add New only) */}
      {showForm && !editId && (
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
              <label className="form-label">Thời hạn vay (tháng)</label>
              <input type="number" className="input-field" placeholder="VD: 12" value={form.durationMonths} onChange={e => handleFormChange('durationMonths', e.target.value)} />
            </div>
          </div>
          <div className="finance-form-row">
            <div style={{ flex: 1 }}>
              <label className="form-label">Tần suất trả gốc (tháng/lần)</label>
              <input type="number" className="input-field" placeholder="VD: 1 (Hàng tháng)" value={form.principalFreq} onChange={e => handleFormChange('principalFreq', e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="form-label" style={{ color: '#f59e0b' }}>Tổng nợ (Tự tính = Gốc + Lãi)</label>
              <input type="number" className="input-field" placeholder="Tự động tính hoặc nhập tay" value={form.totalPayable} onChange={e => handleFormChange('totalPayable', e.target.value)} style={{ borderColor: 'rgba(245, 158, 11, 0.4)' }} />
            </div>
          </div>
          <div className="finance-form-actions">
            <button className="btn-submit" onClick={handleSubmit}><Check size={14} /> Thêm</button>
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
            <React.Fragment key={d.id}>
              <div className={`debt-card ${isCompleted ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}`}>
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
                  <span>Trả: {(!d.principalFreq || d.principalFreq === '0') ? 'Linh hoạt' : `${d.principalFreq} tháng/lần`}</span>
                </div>
                <div className="debt-dates">
                  <span>Vay: {new Date(d.startDate).toLocaleDateString('vi-VN')}</span>
                  {d.dueDate ? (
                    <span>Hạn: {new Date(d.dueDate).toLocaleDateString('vi-VN')}</span>
                  ) : (
                    <span>Hạn: Linh hoạt</span>
                  )}
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
                  <div className="debt-action-form" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input 
                        type="number" 
                        className="input-field" 
                        placeholder={actionType === 'pay' ? "Số tiền trả gốc (VNĐ)" : "Số tiền vay thêm (VNĐ)"}
                        value={payPrincipal} 
                        onChange={e => setPayPrincipal(e.target.value)} 
                        style={{ flex: 1 }}
                      />
                      {actionType === 'pay' && (
                        <input 
                          type="number" 
                          className="input-field" 
                          placeholder="Số tiền trả lãi (VNĐ)"
                          value={payInterest} 
                          onChange={e => setPayInterest(e.target.value)} 
                          style={{ flex: 1 }}
                        />
                      )}
                    </div>
                    {actionType === 'pay' && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--accent-green)', fontWeight: '600', paddingLeft: '0.25rem' }}>
                        Tổng tiền thanh toán: {formatVND((parseFloat(payPrincipal) || 0) + (parseFloat(payInterest) || 0))}
                      </div>
                    )}
                    <div className="finance-form-actions" style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <button className="btn-submit" onClick={() => actionType === 'pay' ? handlePayment(d.id) : handleBorrow(d.id)} style={{ flex: 1 }}>Xác nhận</button>
                      <button className="btn-cancel" onClick={() => { setActionId(null); setPayPrincipal(''); setPayInterest(''); }} style={{ flex: 1 }}>Hủy</button>
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

              {/* Inline Edit Form */}
              {editId === d.id && (
                <div className="finance-form inline-edit">
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
                      <label className="form-label">Thời hạn vay (tháng)</label>
                      <input type="number" className="input-field" value={form.durationMonths} onChange={e => handleFormChange('durationMonths', e.target.value)} />
                    </div>
                  </div>
                  <div className="finance-form-row">
                    <div style={{ flex: 1 }}>
                      <label className="form-label">Tần suất trả gốc (tháng/lần)</label>
                      <input type="number" className="input-field" value={form.principalFreq} onChange={e => handleFormChange('principalFreq', e.target.value)} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="form-label" style={{ color: '#f59e0b' }}>Tổng nợ (Gốc + Lãi)</label>
                      <input type="number" className="input-field" value={form.totalPayable} onChange={e => handleFormChange('totalPayable', e.target.value)} style={{ borderColor: 'rgba(245, 158, 11, 0.4)' }} />
                    </div>
                  </div>
                  <div className="finance-form-actions">
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

      {/* Form (Add New only) */}
      {showForm && !editId && (
        <div className="finance-form">
          <input type="text" className="input-field" placeholder="Tên mục tiêu (VD: Mua xe, Du lịch...)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input type="number" className="input-field" placeholder="Số tiền mục tiêu (VNĐ)" value={form.targetAmount} onChange={e => setForm({ ...form, targetAmount: e.target.value })} />
          <input type="number" className="input-field" placeholder="Số tiền hiện có (VNĐ)" value={form.currentAmount} onChange={e => setForm({ ...form, currentAmount: e.target.value })} />
          <div className="finance-form-actions">
            <button className="btn-submit" onClick={handleSubmit}><Check size={14} /> Tạo</button>
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
            <React.Fragment key={g.id}>
              <div className={`savings-card ${isCompleted ? 'completed' : ''}`}>
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

              {/* Inline Edit Form */}
              {editId === g.id && (
                <div className="finance-form inline-edit" style={{ marginTop: '1rem' }}>
                  <input type="text" className="input-field" placeholder="Tên mục tiêu" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                  <input type="number" className="input-field" placeholder="Số tiền mục tiêu (VNĐ)" value={form.targetAmount} onChange={e => setForm({ ...form, targetAmount: e.target.value })} />
                  <input type="number" className="input-field" placeholder="Số tiền hiện có (VNĐ)" value={form.currentAmount} onChange={e => setForm({ ...form, currentAmount: e.target.value })} />
                  <div className="finance-form-actions">
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
  );
}

function PassbooksTab({ passbooks, setPassbooks, transactions, setTransactions, cashOnHand = 0, onUpdateCashOnHand, uid }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [withdrawId, setWithdrawId] = useState(null);
  const [actualInterestInput, setActualInterestInput] = useState('');

  const DEFAULT_FORM = {
    bankName: '',
    depositAmount: '',
    interestRate: '',
    term: '12 tháng',
    startDate: new Date().toISOString().split('T')[0],
    maturityMethod: 'Tự động quay vòng gốc và lãi',
    note: '',
    status: 'Đang gửi'
  };

  const [form, setForm] = useState(DEFAULT_FORM);

  const TERMS = ['Không kỳ hạn', '1 tháng', '3 tháng', '6 tháng', '9 tháng', '12 tháng', '18 tháng', '24 tháng', '36 tháng'];
  const MATURITY_METHODS = ['Tự động quay vòng gốc và lãi', 'Tự động quay vòng gốc', 'Tất toán khi đáo hạn'];

  const getMaturityDate = (startDateStr, term) => {
    if (term === 'Không kỳ hạn') return null;
    const date = new Date(startDateStr);
    const months = parseInt(term);
    if (isNaN(months)) return null;
    date.setMonth(date.getMonth() + months);
    return date;
  };

  const getProjectedInterest = (amount, rate, term) => {
    const principal = parseFloat(amount) || 0;
    const r = parseFloat(rate) || 0;
    if (term === 'Không kỳ hạn') {
      return principal * (r / 100) * (1 / 12);
    }
    const months = parseInt(term);
    if (isNaN(months)) return 0;
    return principal * (r / 100) * (months / 12);
  };

  const getProgressInfo = (startDateStr, term) => {
    const maturity = getMaturityDate(startDateStr, term);
    if (!maturity) return { pct: 0, daysRemaining: null, isMatured: false };

    const start = new Date(startDateStr).getTime();
    const end = maturity.getTime();
    const now = new Date().getTime();

    if (now >= end) return { pct: 100, daysRemaining: 0, isMatured: true };
    if (now <= start) return { pct: 0, daysRemaining: Math.ceil((end - start) / (1000 * 60 * 60 * 24)), isMatured: false };

    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.ceil((now - start) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, totalDays - elapsedDays);
    const pct = Math.min(100, (elapsedDays / totalDays) * 100);

    return { pct, daysRemaining, isMatured: false };
  };

  const activePassbooks = passbooks.filter(p => p.status !== 'Đã tất toán');
  const totalActiveDeposit = activePassbooks.reduce((sum, p) => sum + (parseFloat(p.depositAmount) || 0), 0);
  const totalProjectedInterest = activePassbooks.reduce((sum, p) => {
    return sum + getProjectedInterest(p.depositAmount, p.interestRate, p.term);
  }, 0);

  const upcomingMaturityCount = activePassbooks.filter(p => {
    const info = getProgressInfo(p.startDate, p.term);
    return info.daysRemaining !== null && info.daysRemaining <= 30 && !info.isMatured;
  }).length;

  const handleSubmit = () => {
    const depositAmount = parseFloat(form.depositAmount);
    const interestRate = parseFloat(form.interestRate);
    if (!form.bankName || isNaN(depositAmount) || isNaN(interestRate)) return;

    const entry = {
      ...form,
      depositAmount,
      interestRate,
      id: editId || genId()
    };

    let updated;
    if (editId) {
      updated = passbooks.map(p => p.id === editId ? entry : p);
    } else {
      updated = [...passbooks, entry];
    }

    setPassbooks(updated);
    savePassbooks(uid, updated);
    setShowForm(false);
    setEditId(null);
    setForm(DEFAULT_FORM);
  };

  const handleEdit = (p) => {
    setForm({
      bankName: p.bankName,
      depositAmount: p.depositAmount.toString(),
      interestRate: p.interestRate.toString(),
      term: p.term,
      startDate: p.startDate,
      maturityMethod: p.maturityMethod,
      note: p.note || '',
      status: p.status || 'Đang gửi'
    });
    setEditId(p.id);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa sổ tiết kiệm này?")) {
      const updated = passbooks.filter(p => p.id !== id);
      setPassbooks(updated);
      savePassbooks(uid, updated);
    }
  };

  const handleWithdrawClick = (p) => {
    setWithdrawId(p.id);
    const projInterest = getProjectedInterest(p.depositAmount, p.interestRate, p.term);
    const info = getProgressInfo(p.startDate, p.term);
    if (info.isMatured) {
      setActualInterestInput(projInterest.toFixed(0));
    } else {
      const start = new Date(p.startDate).getTime();
      const now = new Date().getTime();
      const elapsedDays = Math.max(0, Math.ceil((now - start) / (1000 * 60 * 60 * 24)));
      const earlyInterest = p.depositAmount * (0.1 / 100) * (elapsedDays / 365);
      setActualInterestInput(earlyInterest.toFixed(0));
    }
  };

  const handleWithdrawSubmit = (id) => {
    const actualInterest = parseFloat(actualInterestInput) || 0;
    const book = passbooks.find(p => p.id === id);
    if (!book) return;

    const principal = parseFloat(book.depositAmount) || 0;

    const updated = passbooks.map(p => {
      if (p.id === id) {
        return {
          ...p,
          status: 'Đã tất toán',
          actualInterest,
          withdrawalDate: new Date().toISOString().split('T')[0]
        };
      }
      return p;
    });

    setPassbooks(updated);
    savePassbooks(uid, updated);

    // Tự động tạo giao dịch Thu nhập (Income) cho tiền gốc + lãi nhận được
    const newTransaction = {
      id: genId(),
      type: 'income',
      amount: principal + actualInterest,
      category: 'Đầu tư',
      note: `Tất toán sổ tiết kiệm ${book.bankName} (Gốc: ${formatVND(principal)} + Lãi thực nhận: ${formatVND(actualInterest)})`,
      date: new Date().toISOString().split('T')[0]
    };

    const updatedTransactions = [...transactions, newTransaction];
    setTransactions(updatedTransactions);
    saveTransactions(uid, updatedTransactions);
    if (onUpdateCashOnHand) {
      onUpdateCashOnHand(cashOnHand + (principal + actualInterest));
    }

    setWithdrawId(null);
    setActualInterestInput('');
  };

  return (
    <div className="finance-tab-content">
      <div className="finance-summary-row">
        <div className="finance-card income-card" style={{ borderLeftColor: '#10b981' }}>
          <BookOpen size={20} style={{ color: '#10b981' }} />
          <div>
            <div className="finance-card-label">Tổng tiền gửi</div>
            <div className="finance-card-value" style={{ color: '#10b981' }}>{formatVND(totalActiveDeposit)}</div>
          </div>
        </div>
        <div className="finance-card balance-card positive" style={{ borderLeftColor: '#3b82f6' }}>
          <TrendingUp size={20} style={{ color: '#3b82f6' }} />
          <div>
            <div className="finance-card-label">Lãi dự kiến</div>
            <div className="finance-card-value" style={{ color: '#3b82f6' }}>{formatVND(totalProjectedInterest)}</div>
          </div>
        </div>
        <div className="finance-card expense-card" style={{ borderLeftColor: '#f59e0b' }}>
          <Calendar size={20} style={{ color: '#f59e0b' }} />
          <div>
            <div className="finance-card-label">Sắp đáo hạn (&lt;30 ngày)</div>
            <div className="finance-card-value" style={{ color: '#f59e0b' }}>{upcomingMaturityCount} sổ</div>
          </div>
        </div>
      </div>

      <div className="finance-toolbar">
        <div></div>
        <button className="btn-add" onClick={() => { setShowForm(!showForm); setEditId(null); setForm(DEFAULT_FORM); }}>
          <Plus size={16} /> Thêm sổ tiết kiệm
        </button>
      </div>

      {showForm && (
        <div className="finance-form">
          <div style={{ fontWeight: 700, marginBottom: '0.25rem', fontSize: '0.95rem' }}>
            {editId ? "Cập nhật sổ tiết kiệm" : "Mở sổ tiết kiệm mới"}
          </div>
          <div className="finance-form-row">
            <div style={{ flex: 2 }}>
              <span className="form-label">Tên ngân hàng / Sổ</span>
              <input type="text" className="input-field" placeholder="VD: Vietcombank, BIDV..." value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })} />
            </div>
            <div style={{ flex: 2 }}>
              <span className="form-label">Số tiền gửi (VNĐ)</span>
              <input type="number" className="input-field" placeholder="Số tiền gửi" value={form.depositAmount} onChange={e => setForm({ ...form, depositAmount: e.target.value })} />
            </div>
          </div>

          <div className="finance-form-row">
            <div style={{ flex: 1 }}>
              <span className="form-label">Kỳ hạn</span>
              <select className="finance-select" style={{ width: '100%' }} value={form.term} onChange={e => setForm({ ...form, term: e.target.value })}>
                {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <span className="form-label">Lãi suất (% / năm)</span>
              <input type="number" step="0.01" className="input-field" placeholder="Lãi suất" value={form.interestRate} onChange={e => setForm({ ...form, interestRate: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <span className="form-label">Ngày gửi</span>
              <input type="date" className="input-field" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
            </div>
          </div>

          <div className="finance-form-row">
            <div style={{ flex: 2 }}>
              <span className="form-label">Phương thức đáo hạn</span>
              <select className="finance-select" style={{ width: '100%' }} value={form.maturityMethod} onChange={e => setForm({ ...form, maturityMethod: e.target.value })}>
                {MATURITY_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ flex: 2 }}>
              <span className="form-label">Ghi chú</span>
              <input type="text" className="input-field" placeholder="VD: Gửi mua nhà, tích lũy..." value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
            </div>
          </div>

          <div className="finance-form-actions">
            <button className="btn-submit" onClick={handleSubmit}><Check size={14} /> {editId ? "Lưu thay đổi" : "Mở sổ"}</button>
            <button className="btn-cancel" onClick={() => { setShowForm(false); setEditId(null); }}><X size={14} /> Hủy</button>
          </div>
        </div>
      )}

      <div className="savings-grid">
        {passbooks.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1/-1' }}>Hãy mở sổ tiết kiệm đầu tiên! 💼🏦</div>
        ) : (
          passbooks.map(p => {
            const isWithdrawn = p.status === 'Đã tất toán';
            const projInterest = getProjectedInterest(p.depositAmount, p.interestRate, p.term);
            const info = getProgressInfo(p.startDate, p.term);
            const matDate = getMaturityDate(p.startDate, p.term);
            const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : 'Không kỳ hạn';

            return (
              <React.Fragment key={p.id}>
                <div className={`savings-card ${isWithdrawn ? 'completed' : ''}`} style={{ alignItems: 'stretch', textAlign: 'left' }}>
                  <div className="savings-header" style={{ marginBottom: '0.5rem' }}>
                    <div className="savings-name" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <BookOpen size={16} color={isWithdrawn ? 'var(--text-secondary)' : '#10b981'} />
                      {p.bankName}
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      {!isWithdrawn && <button className="btn-edit" title="Sửa sổ" onClick={() => handleEdit(p)}><Edit3 size={14} /></button>}
                      <button className="btn-delete" title="Xóa sổ" onClick={() => handleDelete(p.id)}><Trash2 size={14} /></button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                    <span className="debt-badge" style={{ 
                      background: isWithdrawn ? 'rgba(255,255,255,0.05)' : info.isMatured ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                      color: isWithdrawn ? 'var(--text-secondary)' : info.isMatured ? 'var(--accent-green)' : '#3b82f6'
                    }}>
                      {isWithdrawn ? 'Đã tất toán' : info.isMatured ? 'Đã đến hạn 🔔' : 'Đang gửi'}
                    </span>
                    <span className="debt-badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                      Kỳ hạn: {p.term}
                    </span>
                    <span className="debt-badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                      Lãi suất: {p.interestRate}%/năm
                    </span>
                  </div>

                  <div className="savings-amounts" style={{ marginBottom: '0.75rem' }}>
                    <div>
                      <span className="savings-label">Tiền gửi gốc:</span> 
                      <strong style={{ float: 'right', color: 'var(--text-primary)' }}>{formatVND(p.depositAmount)}</strong>
                    </div>
                    {isWithdrawn ? (
                      <>
                        <div>
                          <span className="savings-label">Lãi thực nhận:</span> 
                          <strong style={{ float: 'right', color: '#10b981' }}>{formatVND(p.actualInterest || 0)}</strong>
                        </div>
                        <div>
                          <span className="savings-label">Tổng nhận:</span> 
                          <strong style={{ float: 'right', color: '#10b981' }}>{formatVND(p.depositAmount + (p.actualInterest || 0))}</strong>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <span className="savings-label">Lãi dự kiến:</span> 
                          <strong style={{ float: 'right', color: '#3b82f6' }}>{formatVND(projInterest)}</strong>
                        </div>
                        <div>
                          <span className="savings-label">Tổng nhận khi đáo hạn:</span> 
                          <strong style={{ float: 'right', color: '#10b981' }}>{formatVND(p.depositAmount + projInterest)}</strong>
                        </div>
                      </>
                    )}
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.2rem', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '0.375rem', marginBottom: '0.75rem' }}>
                    <div><strong>Ngày gửi:</strong> {fmtDate(p.startDate)}</div>
                    <div><strong>Ngày đáo hạn:</strong> {fmtDate(matDate)}</div>
                    {isWithdrawn && p.withdrawalDate && (
                      <div><strong>Ngày tất toán:</strong> {fmtDate(p.withdrawalDate)}</div>
                    )}
                    {!isWithdrawn && p.term !== 'Không kỳ hạn' && (
                      <div><strong>Đáo hạn:</strong> {p.maturityMethod}</div>
                    )}
                    {p.note && <div><strong>Ghi chú:</strong> {p.note}</div>}
                  </div>

                  {!isWithdrawn && (
                    <div style={{ marginTop: 'auto' }}>
                      {p.term !== 'Không kỳ hạn' && (
                        <div style={{ marginBottom: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                            <span>Tiến trình gửi</span>
                            <span>{info.pct.toFixed(0)}%</span>
                          </div>
                          <div className="debt-progress-bar">
                            <div className="debt-progress-fill" style={{ width: `${info.pct}%`, background: info.pct === 100 ? 'var(--accent-green)' : '#3b82f6' }} />
                          </div>
                          {info.daysRemaining !== null && info.daysRemaining > 0 && (
                            <div style={{ fontSize: '0.7rem', color: '#f59e0b', marginTop: '0.2rem', textAlign: 'right' }}>
                              Còn {info.daysRemaining} ngày nữa đáo hạn
                            </div>
                          )}
                        </div>
                      )}

                      {withdrawId !== p.id ? (
                        <button className="savings-deposit-btn" style={{ borderColor: '#10b981', color: '#10b981', background: 'rgba(16, 185, 129, 0.05)' }} onClick={() => handleWithdrawClick(p)}>
                          <Check size={14} /> Tất toán sổ
                        </button>
                      ) : (
                        <div className="finance-form inline-edit" style={{ padding: '0.75rem', marginTop: '0.5rem' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                            {info.isMatured ? "Tất toán đúng hạn" : "Tất toán trước hạn (Lãi giảm)"}
                          </div>
                          <span className="form-label" style={{ fontSize: '0.65rem' }}>Tiền lãi nhận thực tế (VNĐ):</span>
                          <input type="number" className="input-field" style={{ padding: '0.35rem' }} value={actualInterestInput} onChange={e => setActualInterestInput(e.target.value)} />
                          <div className="finance-form-actions" style={{ marginTop: '0.5rem' }}>
                            <button className="btn-submit small" onClick={() => handleWithdrawSubmit(p.id)}><Check size={12} /> Xác nhận</button>
                            <button className="btn-cancel small" onClick={() => setWithdrawId(null)}><X size={12} /> Hủy</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {isWithdrawn && (
                    <div className="savings-completed-badge" style={{ marginTop: 'auto', textAlign: 'center', fontSize: '0.85rem' }}>
                      🏦 Đã tất toán tài khoản
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })
        )}
      </div>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================
export default function FinanceDashboard({ uid }) {
  const [activeTab, setActiveTab] = useState('transactions');
  const [transactions, setTransactions] = useState([]);
  const [cashOnHand, setCashOnHand] = useState(0);
  const [debts, setDebts] = useState([]);
  const [savings, setSavings] = useState([]);
  const [passbooks, setPassbooks] = useState([]);

  // States for Master Balance edit at parent
  const [isEditingCash, setIsEditingCash] = useState(false);
  const [cashInput, setCashInput] = useState('');

  const handleSaveCash = (e) => {
    e.preventDefault();
    const amount = Number(cashInput);
    if (isNaN(amount) || amount < 0) {
      alert('Vui lòng nhập số tiền hợp lệ.');
      return;
    }
    setCashOnHand(amount);
    saveCashOnHand(uid, amount);
    setIsEditingCash(false);
  };

  useEffect(() => {
    if (!uid) return;
    const unsub1 = subscribeTransactions(uid, setTransactions);
    const unsub2 = subscribeDebts(uid, setDebts);
    const unsub3 = subscribeSavings(uid, setSavings);
    const unsub4 = subscribePassbooks(uid, setPassbooks);
    const unsub5 = subscribeCashOnHand(uid, setCashOnHand);
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); };
  }, [uid]);

  return (
    <div className="finance-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem', overflowY: 'auto', boxSizing: 'border-box', width: '100%' }}>
      {/* Master Cash Balance Card - Tiền Nhàn Rỗi */}
      <div 
        className="finance-card" 
        style={{ 
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(99, 102, 241, 0.06) 100%)', 
          border: '1px solid rgba(139, 92, 246, 0.25)', 
          borderRadius: '1rem', 
          padding: '1.25rem 1.5rem', 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: '0 8px 32px 0 rgba(139, 92, 246, 0.05)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          width: '100%',
          boxSizing: 'border-box'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ background: 'rgba(139, 92, 246, 0.12)', padding: '0.75rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a78bfa' }}>
            <Wallet size={28} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              Tổng Tiền Nhàn Rỗi
            </div>
            {isEditingCash ? (
              <form onSubmit={handleSaveCash} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                <input
                  type="number"
                  value={cashInput}
                  onChange={(e) => setCashInput(e.target.value)}
                  className="input-field"
                  placeholder="Nhập số tiền..."
                  style={{ padding: '0.4rem 0.75rem', fontSize: '1.1rem', width: '200px', boxSizing: 'border-box', height: '36px', borderRadius: '6px' }}
                  autoFocus
                  min="0"
                />
                <button type="submit" className="btn-submit" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', borderRadius: '6px', height: '36px', cursor: 'pointer' }}>Lưu</button>
                <button type="button" onClick={() => setIsEditingCash(false)} style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', borderRadius: '6px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', height: '36px', cursor: 'pointer' }}>Hủy</button>
              </form>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{formatVND(cashOnHand)}</div>
                <button
                  onClick={() => {
                    setCashInput(cashOnHand.toString());
                    setIsEditingCash(true);
                  }}
                  title="Chỉnh sửa số tiền nhàn rỗi"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.4rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', width: '28px', height: '28px' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                >
                  <Edit3 size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '320px', lineHeight: 1.4 }}>
          💡 Đây là tổng ví tiền mặt nhàn rỗi của bạn, tự động cộng thêm khi thu nhập và trừ đi khi chi tiêu.
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="finance-tabs" style={{ width: '100%', boxSizing: 'border-box' }}>
        <button className={`finance-tab-btn ${activeTab === 'transactions' ? 'active' : ''}`} onClick={() => setActiveTab('transactions')}>
          <DollarSign size={16} /> Chi Tiêu & Thu Nhập
        </button>
        <button className={`finance-tab-btn ${activeTab === 'debts' ? 'active' : ''}`} onClick={() => setActiveTab('debts')}>
          <CreditCard size={16} /> Quản Lý Nợ
        </button>
        <button className={`finance-tab-btn ${activeTab === 'savings' ? 'active' : ''}`} onClick={() => setActiveTab('savings')}>
          <PiggyBank size={16} /> Mục Tiêu Tiết Kiệm
        </button>
        <button className={`finance-tab-btn ${activeTab === 'passbooks' ? 'active' : ''}`} onClick={() => setActiveTab('passbooks')}>
          <BookOpen size={16} /> Sổ Tiết Kiệm
        </button>
      </div>

      {/* Content */}
      {activeTab === 'transactions' && (
        <TransactionsTab 
          transactions={transactions} 
          setTransactions={setTransactions} 
          cashOnHand={cashOnHand}
          onUpdateCashOnHand={(amount) => {
            setCashOnHand(amount);
            saveCashOnHand(uid, amount);
          }}
          uid={uid} 
        />
      )}
      {activeTab === 'debts' && (
        <DebtsTab 
          debts={debts} 
          setDebts={setDebts} 
          transactions={transactions}
          setTransactions={setTransactions}
          cashOnHand={cashOnHand}
          onUpdateCashOnHand={(amount) => {
            setCashOnHand(amount);
            saveCashOnHand(uid, amount);
          }}
          uid={uid} 
        />
      )}
      {activeTab === 'savings' && <SavingsTab savings={savings} setSavings={setSavings} uid={uid} />}
      {activeTab === 'passbooks' && (
        <PassbooksTab 
          passbooks={passbooks} 
          setPassbooks={setPassbooks} 
          transactions={transactions} 
          setTransactions={setTransactions} 
          cashOnHand={cashOnHand}
          onUpdateCashOnHand={(amount) => {
            setCashOnHand(amount);
            saveCashOnHand(uid, amount);
          }}
          uid={uid} 
        />
      )}
    </div>
  );
}
