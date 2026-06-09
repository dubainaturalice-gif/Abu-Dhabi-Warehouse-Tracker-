'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { StockRecord } from '@/types';

const CATEGORIES = ['ICE PRODUCTS \u2014 FROM DUBAI', 'JELAT ICE CREAM', 'ICE POP'];

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
  const [exporting, setExporting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordsRef = useRef<StockRecord[]>([]);
  const isAdmin = user?.role === 'admin';

  const headers = (tk: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` });

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

  const exportPDF = async () => {
    setExporting(true);
    try {
      const jsPDFMod = await import('jspdf');
      const jsPDF = jsPDFMod.default;
      await import('jspdf-autotable');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = 210;
      const margin = 12;
      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(10, 22, 40);
      doc.text('NATURAL ICE  |  ABU DHABI WAREHOUSE', pageW / 2, 13, { align: 'center' });
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(13, 148, 136);
      doc.text(`DAILY STOCK REPORT  |  ${dayName.toUpperCase()}, ${date}`, pageW / 2, 19, { align: 'center' });
      doc.setDrawColor(13, 148, 136);
      doc.setLineWidth(0.4);
      doc.line(margin, 22, pageW - margin, 22);
      const kpis = [
        { label: 'Total Recv Dubai', value: totals.recv_dubai, color: [13, 148, 136] as [number, number, number] },
        { label: 'Total Recv UMQ',   value: totals.recv_umq,   color: [249, 115, 22] as [number, number, number] },
        { label: 'Total Dispatched', value: totals.dispatch,   color: [249, 115, 22] as [number, number, number] },
        { label: 'Total Closing Stk',value: totals.closing,    color: [249, 115, 22] as [number, number, number] },
      ];
      const kpiY = 24; const kpiH = 16; const gap = 2;
      const kpiW = (pageW - 2 * margin - gap * 3) / 4;
      kpis.forEach((k, i) => {
        const x = margin + i * (kpiW + gap);
        doc.setFillColor(...k.color);
        doc.roundedRect(x, kpiY, kpiW, kpiH, 1.5, 1.5, 'F');
        doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
        doc.text(k.value.toString(), x + kpiW / 2, kpiY + 8, { align: 'center' });
        doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
        doc.text(k.label, x + kpiW / 2, kpiY + 13, { align: 'center' });
      });
      const catColors: Record<string, [number, number, number]> = {
        'ICE PRODUCTS \u2014 FROM DUBAI': [13, 148, 136],
        'JELAT ICE CREAM': [99, 102, 241],
        'ICE POP': [234, 88, 12],
      };
      const bodyRows: object[][] = [];
      CATEGORIES.forEach(cat => {
        const catRows = records.filter(r => r.category === cat);
        if (!catRows.length) return;
        if (cat !== 'ICE PRODUCTS \u2014 FROM DUBAI') {
          const cc = catColors[cat] || [13, 148, 136];
          bodyRows.push([{ content: cat, colSpan: 6, styles: { fillColor: cc, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, halign: 'left', cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 2 } } }]);
        }
        catRows.forEach((r, ri) => {
          const bg = ri % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
          const cell = (v: number) => ({ content: v.toString(), styles: { fillColor: bg, textColor: v === 0 ? [220, 38, 38] : [15, 23, 42], fontStyle: v === 0 ? 'bold' : 'normal', halign: 'center', fontSize: 8 } });
          bodyRows.push([
            { content: r.product_name, styles: { fillColor: bg, textColor: [30, 41, 59], fontSize: 7.5, halign: 'left', cellPadding: { top: 2, bottom: 2, left: 4, right: 2 } } },
            cell(r.opening), cell(r.recv_dubai), cell(r.recv_umq), cell(r.dispatch), cell(r.closing),
          ]);
        });
      });
      const totalFields: (keyof typeof totals)[] = ['opening', 'recv_dubai', 'recv_umq', 'dispatch', 'closing'];
      bodyRows.push([
        { content: 'GRAND TOTAL', styles: { fillColor: [13, 148, 136], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, halign: 'left', cellPadding: { top: 3, bottom: 3, left: 4, right: 2 } } },
        ...totalFields.map(f => ({ content: totals[f].toString(), styles: { fillColor: [13, 148, 136], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, halign: 'center', cellPadding: { top: 3, bottom: 3 } } })),
      ]);
      (doc as any).autoTable({
        startY: kpiY + kpiH + 4,
        margin: { left: margin, right: margin },
        theme: 'plain',
        head: [[
          { content: 'PRODUCT',    styles: { halign: 'left',   fillColor: [10, 22, 40], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, cellPadding: { top: 3, bottom: 3, left: 4, right: 2 } } },
          { content: 'OPENING',    styles: { halign: 'center', fillColor: [10, 22, 40], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 } },
          { content: 'RECV DUBAI', styles: { halign: 'center', fillColor: [10, 22, 40], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 } },
          { content: 'RECV UMQ',   styles: { halign: 'center', fillColor: [10, 22, 40], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 } },
          { content: 'DISPATCH',   styles: { halign: 'center', fillColor: [10, 22, 40], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 } },
          { content: 'CLOSING',    styles: { halign: 'center', fillColor: [10, 22, 40], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 } },
        ]],
        body: bodyRows,
        columnStyles: { 0: { cellWidth: 52 }, 1: { cellWidth: 22 }, 2: { cellWidth: 27 }, 3: { cellWidth: 22 }, 4: { cellWidth: 27 }, 5: { cellWidth: 'auto' } },
        didDrawPage: (data: any) => {
          doc.setFillColor(10, 22, 40);
          doc.rect(0, 285, 210, 12, 'F');
          doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(255, 255, 255);
          doc.text(`Page ${data.pageNumber}  |  Natural Ice - Abu Dhabi Warehouse Tracker`, pageW / 2, 292, { align: 'center' });
        },
      });
      doc.save(`Abu_Dhabi_Daily_${date}.pdf`);
    } finally { setExporting(false); }
  };

  const cellVal = (v: number) =>
    v === 0 ? <span style={{ color: '#ef4444', fontWeight: 700 }}>0</span>
             : <span style={{ color: '#1e293b' }}>{v.toLocaleString()}</span>;

  const renderInput = (r: StockRecord, field: 'opening' | 'recv_dubai' | 'recv_umq' | 'dispatch') => {
    const key = `${r.product_id}_${field}`;
    const val = r[field];
    const canEdit = isAdmin || (field !== 'opening');
    const fieldLocked = isLocked && lockedFields.has(key);
    if (!canEdit || fieldLocked) {
      return <span style={{ fontWeight: fieldLocked ? 700 : 400, color: val === 0 ? '#ef4444' : '#1e293b' }}>{val.toLocaleString()}</span>;
    }
    return (
      <input ref={el => { inputRefs.current[key] = el; }} type="number" min={0}
        value={val === 0 ? '' : val} placeholder="0"
        onChange={e => changeField(r.product_id, field, parseInt(e.target.value) || 0)}
        onKeyDown={e => handleKeyDown(e, r.product_id, field)}
        onFocus={e => e.target.select()}
        className="stock-input"
        style={{ color: val === 0 ? '#ef4444' : '#1e293b', fontWeight: val === 0 ? 700 : 400 }}
      />
    );
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-800">Daily Stock Entry</h1>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full text-white" style={{ background: '#0d9488' }}>Day {dayNum}</span>
            {isLocked && <span className="locked-badge">\ud83d\udd12 Locked</span>}
          </div>
          <p className="text-slate-500 text-sm mt-0.5">{dayName}, {fullDate}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleDateChange(-1)} className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-all border border-slate-200">\u2039</button>
          <input type="date" value={date} onChange={e => { flushSave(); setDate(e.target.value); }}
            className="text-sm text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
          <button onClick={() => handleDateChange(1)} className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-all border border-slate-200">\u203a</button>
          <button onClick={() => { flushSave(); setDate(fmtDate(new Date())); }}
            className="text-xs px-3 py-1.5 rounded-lg font-medium border border-teal-200 text-teal-600 hover:bg-teal-50 transition-all">Today</button>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-slate-400 animate-pulse">Saving\u2026</span>}
          {saved  && <span className="text-xs text-teal-600 font-medium">\u2713 Saved</span>}
          <button onClick={exportPDF} disabled={exporting || loading}
            className="text-sm font-medium px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 border"
            style={{ background: '#1e3a5f', color: '#fff', borderColor: '#1e3a5f', opacity: exporting ? 0.7 : 1 }}>
            {exporting ? '\u23f3' : '\ud83d\udcc4'} {exporting ? 'Generating\u2026' : 'Export PDF'}
          </button>
          {!isAdmin && (
            <button onClick={handleSaveClose} className="text-sm font-medium px-4 py-2 rounded-lg transition-all text-white" style={{ background: '#0d9488' }}>
              \ud83d\udcbe Save &amp; Close
            </button>
          )}
          {isAdmin && isLocked && (
            <button onClick={handleUnlock} className="text-sm px-3 py-2 rounded-lg border border-orange-200 text-orange-600 hover:bg-orange-50 transition-all">\ud83d\udd13 Unlock</button>
          )}
          {isAdmin && !isLocked && (
            <button onClick={() => setShowReset(true)} className="text-sm px-3 py-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-all">Reset Day</button>
          )}
        </div>
      </div>

      {showReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="rounded-2xl p-6 max-w-sm w-full mx-4 text-center bg-white shadow-xl border border-slate-200">
            <div className="text-3xl mb-3">\u26a0\ufe0f</div>
            <h3 className="text-slate-800 font-semibold mb-2">Reset Day?</h3>
            <p className="text-slate-500 text-sm mb-5">This will zero out all movements. Opening stock stays.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setShowReset(false)} className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50">Cancel</button>
              <button onClick={handleReset} className="px-4 py-2 rounded-lg text-sm text-white bg-red-500 hover:bg-red-600">Reset</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden bg-white shadow-sm" style={{ border: '1px solid #e2e8f0' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ background: '#0A1628' }}>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wide w-48">Product</th>
                  <th className="px-3 py-3 text-xs font-semibold text-center uppercase tracking-wide" style={{ color: '#60a5fa' }}>Opening</th>
                  <th className="px-3 py-3 text-xs font-semibold text-center uppercase tracking-wide" style={{ color: '#34d399' }}>Recv Dubai</th>
                  <th className="px-3 py-3 text-xs font-semibold text-center uppercase tracking-wide" style={{ color: '#a78bfa' }}>Recv UMQ</th>
                  <th className="px-3 py-3 text-xs font-semibold text-center uppercase tracking-wide" style={{ color: '#fb923c' }}>Dispatch</th>
                  <th className="px-3 py-3 text-xs font-semibold text-center uppercase tracking-wide" style={{ color: '#facc15' }}>Closing</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map(({ cat, rows }) => {
                  const catBannerColors: Record<string, string> = {
                    'JELAT ICE CREAM': '#6366f1',
                    'ICE POP': '#ea580c',
                  };
                  const bannerBg = catBannerColors[cat];
                  return (
                    <React.Fragment key={cat}>
                      {bannerBg && (
                        <tr><td colSpan={6} style={{ background: bannerBg, padding: '6px 16px' }} className="text-xs font-bold text-white uppercase tracking-wide">{cat}</td></tr>
                      )}
                      {rows.map((r, ri) => (
                        <tr key={r.product_id}
                          style={{ background: ri % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}
                          className="hover:bg-teal-50/40 transition-colors">
                          <td className="px-4 py-2 text-xs font-medium text-slate-700">{r.product_name}</td>
                          <td className="px-2 py-1 text-center">{renderInput(r, 'opening')}</td>
                          <td className="px-2 py-1 text-center">{renderInput(r, 'recv_dubai')}</td>
                          <td className="px-2 py-1 text-center">{renderInput(r, 'recv_umq')}</td>
                          <td className="px-2 py-1 text-center">{renderInput(r, 'dispatch')}</td>
                          <td className="px-2 py-2 text-center text-sm font-semibold">{cellVal(r.closing)}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
                <tr style={{ background: '#0d9488', borderTop: '2px solid #0f766e' }}>
                  <td className="px-4 py-2.5 text-xs font-bold text-white uppercase tracking-wide">GRAND TOTAL</td>
                  {(['opening','recv_dubai','recv_umq','dispatch','closing'] as const).map(f => (
                    <td key={f} className="px-3 py-2.5 text-center text-sm font-bold text-white">{totals[f].toLocaleString()}</td>
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
