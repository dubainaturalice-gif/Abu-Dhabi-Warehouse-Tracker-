'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { StockRecord } from '@/types';

const CATEGORIES = ['ICE PRODUCTS — FROM DUBAI', 'JELAT ICE CREAM', 'ICE POP'];
const CAT_COLORS: Record<string, string> = {
  'ICE PRODUCTS — FROM DUBAI': '#0d9488',
  'JELAT ICE CREAM': '#7c3aed',
  'ICE POP': '#f97316',
};

function fmtDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayOfYear(d: Date) {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

export default function DailyEntry() {
  const { user, token } = useAuth();
  const [date, setDate] = useState(() => fmtDate(new Date()));
  const [records, setRecords] = useState<StockRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockedFields, setLockedFields] = useState<Set<string>>(new Set());
  const [showReset, setShowReset] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordsRef = useRef<StockRecord[]>([]);
  const isAdmin = user?.role === 'admin';

  const headers = (token: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });

  const loadDay = useCallback(async (d: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const [stockRes, lockRes] = await Promise.all([
        fetch(`/api/stock?date=${d}`, { headers: headers(token) }),
        fetch(`/api/lock?date=${d}`, { headers: headers(token) }),
      ]);
      const stockData = await stockRes.json();
      const lockData  = await lockRes.json();
      setRecords(stockData);
      recordsRef.current = stockData;
      setIsLocked(lockData.locked);
      // Rebuild lockedFields from saved data
      if (lockData.locked) {
        const lf = new Set<string>();
        for (const r of (stockData as StockRecord[])) {
          if (r.recv_dubai > 0) lf.add(`${r.product_id}_recv_dubai`);
          if (r.recv_umq   > 0) lf.add(`${r.product_id}_recv_umq`);
          if (r.dispatch   > 0) lf.add(`${r.product_id}_dispatch`);
        }
        setLockedFields(lf);
      } else {
        setLockedFields(new Set());
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadDay(date); }, [date, loadDay]);

  const saveRecords = useCallback(async (recs: StockRecord[]) => {
    if (!token) return;
    setSaving(true);
    try {
      await fetch('/api/stock', {
        method: 'POST',
        headers: headers(token),
        body: JSON.stringify({ date, records: recs }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }, [token, date]);

  const flushSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    saveRecords(recordsRef.current);
  }, [saveRecords]);

  const scheduleSave = useCallback((recs: StockRecord[]) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveRecords(recs), 3000);
  }, [saveRecords]);

  const changeField = (productId: number, field: 'opening' | 'recv_dubai' | 'recv_umq' | 'dispatch', value: number) => {
    const updated = records.map(r => {
      if (r.product_id !== productId) return r;
      const upd = { ...r, [field]: value };
      upd.closing = upd.opening + upd.recv_dubai + upd.recv_umq - upd.dispatch;
      return upd;
    });
    setRecords(updated);
    recordsRef.current = updated;
    scheduleSave(updated);
  };

  const handleSaveClose = async () => {
    flushSave();
    // Snapshot locked fields
    const lf = new Set<string>();
    for (const r of recordsRef.current) {
      if (r.recv_dubai > 0) lf.add(`${r.product_id}_recv_dubai`);
      if (r.recv_umq   > 0) lf.add(`${r.product_id}_recv_umq`);
      if (r.dispatch   > 0) lf.add(`${r.product_id}_dispatch`);
    }
    setLockedFields(lf);
    setIsLocked(true);
    await fetch('/api/lock', {
      method: 'POST',
      headers: headers(token!),
      body: JSON.stringify({ date }),
    });
  };

  const handleUnlock = async () => {
    await fetch(`/api/lock?date=${date}`, { method: 'DELETE', headers: headers(token!) });
    setIsLocked(false);
    setLockedFields(new Set());
  };

  const handleReset = async () => {
    const updated = records.map(r => ({
      ...r, recv_dubai: 0, recv_umq: 0, dispatch: 0, closing: r.opening,
    }));
    setRecords(updated);
    recordsRef.current = updated;
    await saveRecords(updated);
    setShowReset(false);
  };

  const handleDateChange = (delta: number) => {
    flushSave();
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    setDate(fmtDate(d));
  };

  const dayNum = dayOfYear(new Date(date + 'T00:00:00'));
  const dateObj = new Date(date + 'T00:00:00');
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const fullDate = dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });

  // Tab navigation
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const editableFields = isAdmin
    ? ['opening', 'recv_dubai', 'recv_umq', 'dispatch']
    : ['recv_dubai', 'recv_umq', 'dispatch'];

  const handleKeyDown = (e: React.KeyboardEvent, productId: number, field: string) => {
    const allProducts = records.map(r => r.product_id);
    const fields = editableFields;
    const pIdx = allProducts.indexOf(productId);
    const fIdx = fields.indexOf(field);

    if (e.key === 'Tab' || e.key === 'ArrowRight') {
      e.preventDefault();
      const nextF = fields[fIdx + 1];
      const nextP = nextF ? productId : allProducts[pIdx + 1];
      const nextField = nextF || fields[0];
      if (nextP || nextF) {
        const key = `${nextP || allProducts[pIdx + 1]}_${nextField}`;
        inputRefs.current[key]?.focus();
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevF = fields[fIdx - 1];
      if (prevF) inputRefs.current[`${productId}_${prevF}`]?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextP = allProducts[pIdx + 1];
      if (nextP) inputRefs.current[`${nextP}_${field}`]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevP = allProducts[pIdx - 1];
      if (prevP) inputRefs.current[`${prevP}_${field}`]?.focus();
    }
  };

  const grouped = CATEGORIES.map(cat => ({
    cat,
    rows: records.filter(r => r.category === cat),
  }));

  const totals = {
    opening:    records.reduce((s, r) => s + r.opening,    0),
    recv_dubai: records.reduce((s, r) => s + r.recv_dubai, 0),
    recv_umq:   records.reduce((s, r) => s + r.recv_umq,   0),
    dispatch:   records.reduce((s, r) => s + r.dispatch,   0),
    closing:    records.reduce((s, r) => s + r.closing,    0),
  };

  const cellVal = (v: number) =>
    v === 0 ? <span style={{ color: '#ef4444', fontWeight: 700 }}>0</span>
             : <span>{v.toLocaleString()}</span>;

  const renderInput = (r: StockRecord, field: 'opening' | 'recv_dubai' | 'recv_umq' | 'dispatch') => {
    const key = `${r.product_id}_${field}`;
    const val = r[field];
    const canEdit = isAdmin || (field !== 'opening');
    const fieldLocked = isLocked && lockedFields.has(key);

    if (!canEdit || fieldLocked) {
      return (
        <span style={{ fontWeight: fieldLocked ? 700 : 400, color: val === 0 ? '#ef4444' : '#e2e8f0' }}>
          {val.toLocaleString()}
        </span>
      );
    }

    return (
      <input
        ref={el => { inputRefs.current[key] = el; }}
        type="number"
        min={0}
        value={val === 0 ? '' : val}
        placeholder="0"
        onChange={e => changeField(r.product_id, field, parseInt(e.target.value) || 0)}
        onKeyDown={e => handleKeyDown(e, r.product_id, field)}
        onFocus={e => e.target.select()}
        className="stock-input"
        style={{ color: val === 0 ? '#ef4444' : '#e2e8f0', fontWeight: val === 0 ? 700 : 400 }}
      />
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">Daily Stock Entry</h1>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: '#0d9488', color: '#fff' }}>
              Day {dayNum}
            </span>
            {isLocked && (
              <span className="locked-badge">🔒 Locked</span>
            )}
          </div>
          <p className="text-slate-400 text-sm mt-0.5">{dayName}, {fullDate}</p>
        </div>

        {/* Date nav */}
        <div className="flex items-center gap-2">
          <button onClick={() => handleDateChange(-1)} className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all">‹</button>
          <input
            type="date"
            value={date}
            onChange={e => { flushSave(); setDate(e.target.value); }}
            className="text-sm text-white px-3 py-1.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-teal-500"
            style={{ background: '#0f1f36', borderColor: '#1a2f4a' }}
          />
          <button onClick={() => handleDateChange(1)} className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all">›</button>
          <button onClick={() => { flushSave(); setDate(fmtDate(new Date())); }}
            className="text-xs px-3 py-1.5 rounded-lg text-teal-400 border border-teal-500/30 hover:bg-teal-500/10 transition-all">
            Today
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-slate-500 animate-pulse">Saving…</span>}
          {saved  && <span className="text-xs text-teal-400">✓ Saved</span>}

          {!isAdmin && (
            <button onClick={handleSaveClose}
              className="text-sm font-medium px-4 py-2 rounded-lg transition-all"
              style={{ background: '#0d9488', color: '#fff' }}>
              💾 Save &amp; Close
            </button>
          )}

          {isAdmin && isLocked && (
            <button onClick={handleUnlock}
              className="text-sm px-3 py-2 rounded-lg border border-orange-500/40 text-orange-400 hover:bg-orange-500/10 transition-all">
              🔓 Unlock
            </button>
          )}

          {isAdmin && !isLocked && (
            <button onClick={() => setShowReset(true)}
              className="text-sm px-3 py-2 rounded-lg border text-red-400 border-red-500/30 hover:bg-red-500/10 transition-all">
              Reset Day
            </button>
          )}
        </div>
      </div>

      {/* Reset confirm */}
      {showReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-2xl p-6 max-w-sm w-full mx-4 text-center" style={{ background: '#0f1f36', border: '1px solid #1a2f4a' }}>
            <div className="text-3xl mb-3">⚠️</div>
            <h3 className="text-white font-semibold mb-2">Reset Day?</h3>
            <p className="text-slate-400 text-sm mb-5">This will zero out all movements. Opening stock stays.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setShowReset(false)} className="px-4 py-2 rounded-lg text-sm text-slate-300 border border-slate-600 hover:bg-white/5">Cancel</button>
              <button onClick={handleReset} className="px-4 py-2 rounded-lg text-sm text-white bg-red-600 hover:bg-red-700">Reset</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1a2f4a' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ background: '#0A1628' }}>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide w-48">Product</th>
                  <th className="px-3 py-3 text-xs font-semibold text-center uppercase tracking-wide" style={{ color: '#60a5fa' }}>Opening</th>
                  <th className="px-3 py-3 text-xs font-semibold text-center uppercase tracking-wide" style={{ color: '#34d399' }}>Recv Dubai</th>
                  <th className="px-3 py-3 text-xs font-semibold text-center uppercase tracking-wide" style={{ color: '#a78bfa' }}>Recv UMQ</th>
                  <th className="px-3 py-3 text-xs font-semibold text-center uppercase tracking-wide" style={{ color: '#fb923c' }}>Dispatch</th>
                  <th className="px-3 py-3 text-xs font-semibold text-center uppercase tracking-wide" style={{ color: '#facc15' }}>Closing</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map(({ cat, rows }, gi) => (
                  rows.length > 0 && (
                    <>
                      {/* Category header */}
                      <tr key={`cat-${gi}`}>
                        <td colSpan={6} className="px-4 py-2 text-xs font-bold uppercase tracking-widest"
                          style={{ background: CAT_COLORS[cat] + '25', color: CAT_COLORS[cat], borderTop: `2px solid ${CAT_COLORS[cat]}40` }}>
                          {cat}
                        </td>
                      </tr>
                      {rows.map((r, ri) => (
                        <tr key={r.product_id}
                          style={{ background: ri % 2 === 0 ? '#0f1f36' : '#0A1628', borderBottom: '1px solid #1a2f4a1a' }}
                          className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-2 text-xs font-medium text-slate-300">{r.product_name}</td>
                          <td className="px-2 py-1 text-center">{renderInput(r, 'opening')}</td>
                          <td className="px-2 py-1 text-center">{renderInput(r, 'recv_dubai')}</td>
                          <td className="px-2 py-1 text-center">{renderInput(r, 'recv_umq')}</td>
                          <td className="px-2 py-1 text-center">{renderInput(r, 'dispatch')}</td>
                          <td className="px-2 py-2 text-center text-sm font-semibold">
                            {cellVal(r.closing)}
                          </td>
                        </tr>
                      ))}
                    </>
                  )
                ))}

                {/* Totals row */}
                <tr style={{ background: '#d97706', borderTop: '2px solid #f59e0b' }}>
                  <td className="px-4 py-2.5 text-xs font-bold text-white uppercase tracking-wide">TOTALS</td>
                  {(['opening','recv_dubai','recv_umq','dispatch','closing'] as const).map(f => (
                    <td key={f} className="px-3 py-2.5 text-center text-sm font-bold text-white">
                      {totals[f].toLocaleString()}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
