import React, { useState, useEffect } from 'react';
import { savePhysicalAssets, subscribePhysicalAssets, subscribeTransactions, saveTransactions, subscribeCashOnHand } from '../firebase';
import { Plus, Edit3, Trash2, Check, X, Home, Car, MapPin, Package } from 'lucide-react';

function formatVND(num) {
  if (!num) return '0 ₫';
  return Number(num).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' ₫';
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const ASSET_TYPES = ['Nhà', 'Đất', 'Xe', 'Khác'];

const TYPE_ICONS = {
  'Nhà': Home,
  'Đất': MapPin,
  'Xe': Car,
  'Khác': Package,
};

const TYPE_COLORS = {
  'Nhà': '#3b82f6',
  'Đất': '#10b981',
  'Xe': '#f59e0b',
  'Khác': '#8b5cf6',
};

const DEFAULT_FORM = {
  name: '',
  assetType: 'Nhà',
  purchasePrice: '',
  currentValue: '',
  purchaseDate: new Date().toISOString().slice(0, 10),
  note: '',
};

export default function PhysicalAssetDashboard({ uid, cashOnHand = 0, onUpdateCashOnHand }) {
  const [assets, setAssets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [mode, setMode] = useState('add'); // 'add' or 'buy'
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribePhysicalAssets(uid, setAssets);
    const unsubTx = subscribeTransactions(uid, setTransactions);
    return () => { unsub(); unsubTx(); };
  }, [uid]);

  const totalValue = assets.reduce((sum, a) => sum + (parseFloat(a.currentValue) || 0), 0);

  const handleOpenAdd = () => {
    setForm(DEFAULT_FORM);
    setEditId(null);
    setMode('add');
    setShowForm(true);
  };

  const handleOpenBuy = () => {
    setForm(DEFAULT_FORM);
    setEditId(null);
    setMode('buy');
    setShowForm(true);
  };

  const handleEdit = (asset) => {
    setForm({
      name: asset.name,
      assetType: asset.assetType,
      purchasePrice: asset.purchasePrice?.toString() || '',
      currentValue: asset.currentValue?.toString() || '',
      purchaseDate: asset.purchaseDate || new Date().toISOString().slice(0, 10),
      note: asset.note || '',
    });
    setEditId(asset.id);
    setMode(asset.acquiredByPurchase ? 'buy' : 'add');
    setShowForm(true);
  };

  const handleSubmit = () => {
    const currentValue = parseFloat(form.currentValue);
    const purchasePrice = parseFloat(form.purchasePrice) || 0;

    if (!form.name || !currentValue) {
      alert('Vui lòng nhập tên tài sản và giá trị hiện tại.');
      return;
    }

    const isBuying = mode === 'buy' && !editId; // only deduct on NEW buy, not edit

    if (isBuying) {
      const cost = purchasePrice || currentValue;
      if (cashOnHand < cost) {
        alert(`Tiền Nhàn Rỗi không đủ.\nHiện có: ${formatVND(cashOnHand)}\nCần: ${formatVND(cost)}`);
        return;
      }
      onUpdateCashOnHand(cashOnHand - cost);

      // Create expense transaction
      const tx = {
        id: genId(),
        type: 'expense',
        amount: cost,
        category: 'Khác',
        note: `Mua tài sản: ${form.name}`,
        date: form.purchaseDate || new Date().toISOString().slice(0, 10),
        isSystem: true,
      };
      const newTxList = [...transactions, tx];
      setTransactions(newTxList);
      saveTransactions(uid, newTxList);
    }

    const entry = {
      id: editId || genId(),
      name: form.name,
      assetType: form.assetType,
      purchasePrice: purchasePrice,
      currentValue: currentValue,
      purchaseDate: form.purchaseDate,
      note: form.note,
      acquiredByPurchase: mode === 'buy',
    };

    let updated;
    if (editId) {
      updated = assets.map(a => a.id === editId ? entry : a);
    } else {
      updated = [...assets, entry];
    }

    setAssets(updated);
    savePhysicalAssets(uid, updated);
    setShowForm(false);
    setEditId(null);
    setForm(DEFAULT_FORM);
  };

  const handleDelete = (id) => {
    const updated = assets.filter(a => a.id !== id);
    setAssets(updated);
    savePhysicalAssets(uid, updated);
    setDeleteConfirmId(null);
  };

  return (
    <div style={{ padding: '1rem', overflowY: 'auto', maxHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>Tài Sản Hiện Hữu</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
            Nhà, đất, xe và các tài sản thực khác
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleOpenAdd}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.6rem 1rem', borderRadius: '0.5rem', border: 'none',
              background: 'rgba(59,130,246,0.15)', color: '#3b82f6',
              cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
            }}
          >
            <Plus size={16} /> Thêm có sẵn
          </button>
          <button
            onClick={handleOpenBuy}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.6rem 1rem', borderRadius: '0.5rem', border: 'none',
              background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff',
              cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
            }}
          >
            <Plus size={16} /> Mua mới
          </button>
        </div>
      </div>

      {/* Summary Card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(20,184,166,0.15), rgba(59,130,246,0.1))',
        border: '1px solid rgba(20,184,166,0.3)', borderRadius: '0.75rem',
        padding: '1.25rem', marginBottom: '1.5rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem',
      }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tổng giá trị tài sản hiện hữu</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#14b8a6', marginTop: '0.25rem' }}>{formatVND(totalValue)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Số tài sản</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{assets.length}</div>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{
          background: 'var(--card-bg)', border: '1px solid var(--border-color)',
          borderRadius: '0.75rem', padding: '1.25rem', marginBottom: '1.5rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
              {editId ? 'Chỉnh Sửa Tài Sản' : mode === 'buy' ? '🛒 Mua Tài Sản Mới (Trừ tiền nhàn rỗi)' : '📋 Thêm Tài Sản Có Sẵn'}
            </h3>
            <button onClick={() => { setShowForm(false); setEditId(null); }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Tên tài sản *</label>
              <input
                className="input-field"
                placeholder="VD: Căn hộ Vinhome, Xe Mazda CX5..."
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Loại tài sản</label>
              <select className="input-field" value={form.assetType} onChange={e => setForm({ ...form, assetType: e.target.value })}>
                {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                {mode === 'buy' ? 'Giá mua (sẽ trừ tiền nhàn rỗi) *' : 'Giá mua ban đầu'}
              </label>
              <input
                className="input-field"
                type="number"
                placeholder="VD: 500000000"
                value={form.purchasePrice}
                onChange={e => setForm({ ...form, purchasePrice: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Giá trị hiện tại *</label>
              <input
                className="input-field"
                type="number"
                placeholder="VD: 600000000"
                value={form.currentValue}
                onChange={e => setForm({ ...form, currentValue: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Ngày ghi nhận</label>
              <input
                className="input-field"
                type="date"
                value={form.purchaseDate}
                onChange={e => setForm({ ...form, purchaseDate: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Ghi chú</label>
              <input
                className="input-field"
                placeholder="Ghi chú tùy chọn..."
                value={form.note}
                onChange={e => setForm({ ...form, note: e.target.value })}
              />
            </div>
          </div>

          {mode === 'buy' && !editId && (
            <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(239,68,68,0.1)', borderRadius: '0.5rem', fontSize: '0.85rem', color: '#ef4444' }}>
              ⚠️ Tiền nhàn rỗi sẽ bị trừ: <strong>{formatVND(parseFloat(form.purchasePrice) || parseFloat(form.currentValue) || 0)}</strong>
              &nbsp;(còn lại: {formatVND(cashOnHand - (parseFloat(form.purchasePrice) || parseFloat(form.currentValue) || 0))})
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setShowForm(false); setEditId(null); }}
              style={{ padding: '0.6rem 1.2rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              Hủy
            </button>
            <button
              onClick={handleSubmit}
              style={{ padding: '0.6rem 1.4rem', borderRadius: '0.5rem', border: 'none', background: 'linear-gradient(135deg, #14b8a6, #0d9488)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}
            >
              {editId ? 'Lưu thay đổi' : mode === 'buy' ? 'Xác nhận Mua' : 'Thêm tài sản'}
            </button>
          </div>
        </div>
      )}

      {/* Asset List */}
      {assets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '0.75rem' }}>
          <Home size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
          <p style={{ margin: 0, fontWeight: 600 }}>Chưa có tài sản hiện hữu nào</p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>Nhấn "Thêm có sẵn" hoặc "Mua mới" để bắt đầu.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {assets.map(asset => {
            const Icon = TYPE_ICONS[asset.assetType] || Package;
            const color = TYPE_COLORS[asset.assetType] || '#8b5cf6';
            const gain = (parseFloat(asset.currentValue) || 0) - (parseFloat(asset.purchasePrice) || 0);
            const gainPct = asset.purchasePrice ? ((gain / asset.purchasePrice) * 100).toFixed(1) : null;
            return (
              <div key={asset.id} style={{
                background: 'var(--card-bg)', border: '1px solid var(--border-color)',
                borderRadius: '0.75rem', padding: '1rem 1.25rem',
                display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
              }}>
                <div style={{ width: 44, height: 44, borderRadius: '0.5rem', background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={22} color={color} />
                </div>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{asset.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                    {asset.assetType} · {asset.purchaseDate}
                    {asset.acquiredByPurchase && <span style={{ marginLeft: '0.5rem', color: '#f59e0b' }}>🛒 Đã mua</span>}
                    {asset.note && <span> · {asset.note}</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', minWidth: '140px' }}>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#14b8a6' }}>{formatVND(asset.currentValue)}</div>
                  {gainPct !== null && (
                    <div style={{ fontSize: '0.78rem', color: gain >= 0 ? '#10b981' : '#ef4444', marginTop: '0.15rem' }}>
                      {gain >= 0 ? '▲' : '▼'} {formatVND(Math.abs(gain))} ({gain >= 0 ? '+' : ''}{gainPct}%)
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                  <button
                    onClick={() => handleEdit(asset)}
                    title="Chỉnh sửa"
                    style={{ background: 'rgba(59,130,246,0.1)', border: 'none', color: '#3b82f6', cursor: 'pointer', borderRadius: '0.4rem', padding: '0.45rem', display: 'flex', alignItems: 'center' }}
                  >
                    <Edit3 size={16} />
                  </button>
                  {deleteConfirmId === asset.id ? (
                    <>
                      <button onClick={() => handleDelete(asset.id)} style={{ background: 'rgba(239,68,68,0.15)', border: 'none', color: '#ef4444', cursor: 'pointer', borderRadius: '0.4rem', padding: '0.45rem', display: 'flex', alignItems: 'center' }}><Check size={16} /></button>
                      <button onClick={() => setDeleteConfirmId(null)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', borderRadius: '0.4rem', padding: '0.45rem', display: 'flex', alignItems: 'center' }}><X size={16} /></button>
                    </>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(asset.id)}
                      title="Xóa"
                      style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: '#ef4444', cursor: 'pointer', borderRadius: '0.4rem', padding: '0.45rem', display: 'flex', alignItems: 'center' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
