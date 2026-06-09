'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { MonthlyProductSummary } from '@/types';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CATEGORIES = ['ICE PRODUCTS — FROM DUBAI', 'JELAT ICE CREAM', 'ICE POP'];
const CAT_COLORS: Record<string, string> = {
  'ICE PRODUCTS — FROM DUBAI': '#0d9488',
  'JELAT ICE CREAM': '#7c3aed',
  'ICE POP': '#f97316',
};

export default function MonthlySummary() {
  const { token } = useAuth();
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data,  setData]  = useState<MonthlyProductSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/monthly?year=${year}&month=${month}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(await res.json());
    } finally { setLoading(false); }
  }, [token, year, month]);

  useEffect(() => { load(); }, [load]);

  const totals = {
    opening:          data.reduce((s, r) => s + r.opening,          0),
    total_recv_dubai: data.reduce((s, r) => s + r.total_recv_dubai, 0),
    total_recv_umq:   data.reduce((s, r) => s + r.total_recv_umq,   0),
    total_dispatch:   data.reduce((s, r) => s + r.total_dispatch,   0),
    closing:          data.reduce((s, r) => s + r.closing,          0),
  };

  const zeroRed = (v: number) =>
    v === 0 ? <span style={{ color: '#ef4444', fontWeight: 700 }}>0</span>
             : <span>{v.toLocaleString()}</span>;

  const handleMonthChange = (delta: number) => {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth < 1) { newMonth = 12; newYear--; }
    if (newMonth > 12) { newMonth = 1; newYear++; }
    setMonth(newMonth);
    setYear(newYear);
  };

  const handlePDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });

    // Header
    doc.setFillColor(10, 22, 40);
    doc.rect(0, 0, 297, 25, 'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(16);
    doc.setFont('helvetica','bold');
    doc.text('ABU DHABI WAREHOUSE \u2014 MONTHLY SUMMARY', 15, 12);
    doc.setFontSize(10);
    doc.setFont('helvetica','normal');
    doc.setTextColor(148,163,184);
    doc.text(`${MONTH_NAMES[month-1]} ${year}`, 15, 20);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 297 - 15, 20, { align: 'right' });

    // KPI row
    const kpis = [
      { label: 'Opening Stock', value: totals.opening, color: [59,130,246] as [number,number,number] },
      { label: 'Recv Dubai', value: totals.total_recv_dubai, color: [20,184,166] as [number,number,number] },
      { label: 'Recv UMQ', value: totals.total_recv_umq, color: [124,58,237] as [number,number,number] },
      { label: 'Dispatched', value: totals.total_dispatch, color: [249,115,22] as [number,number,number] },
      { label: 'Closing Stock', value: totals.closing, color: [217,119,6] as [number,number,number] },
    ];
    const kw = (297 - 30) / kpis.length;
    kpis.forEach((k, i) => {
      const x = 15 + i * kw;
      doc.setFillColor(...k.color);
      doc.roundedRect(x, 30, kw - 4, 18, 2, 2, 'F');
      doc.setTextColor(255,255,255);
      doc.setFontSize(7);
      doc.setFont('helvetica','normal');
      doc.text(k.label, x + (kw - 4)/2, 36, { align: 'center' });
      doc.setFontSize(12);
      doc.setFont('helvetica','bold');
      doc.text(k.value.toLocaleString(), x + (kw - 4)/2, 44, { align: 'center' });
    });

    // Table per category
    let startY = 54;
    for (const cat of CATEGORIES) {
      const rows = data.filter(r => r.category === cat);
      if (!rows.length) continue;
      if (cat !== 'ICE PRODUCTS \u2014 FROM DUBAI') {
        const rgb = cat === 'JELAT ICE CREAM' ? [124,58,237] : [249,115,22];
        doc.setFillColor(...(rgb as [number,number,number]));
        doc.rect(15, startY, 267, 7, 'F');
        doc.setTextColor(255,255,255);
        doc.setFontSize(8);
        doc.setFont('helvetica','bold');
        doc.text(cat, 18, startY + 5);
        startY += 7;
      }

      autoTable(doc, {
        startY,
        head: [['Product', 'Opening', 'Recv Dubai', 'Recv UMQ', 'Dispatched', 'Closing']],
        body: rows.map(r => [r.product_name, r.opening, r.total_recv_dubai, r.total_recv_umq, r.total_dispatch, r.closing]),
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, textColor: [30,41,59], halign: 'center' },
        headStyles: { fillColor: [15,31,54], textColor: [148,163,184], fontStyle: 'bold' },
        columnStyles: { 0: { halign: 'left', cellWidth: 50 } },
        alternateRowStyles: { fillColor: [240,253,252] },
        margin: { left: 15, right: 15 },
      });
      startY = (doc as any).lastAutoTable.finalY + 6;
    }

    doc.save(`warehouse-monthly-${year}-${String(month).padStart(2,'0')}.pdf`);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Monthly Summary</h1>
          <p className="text-slate-500 text-sm mt-0.5">{MONTH_NAMES[month-1]} {year}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleMonthChange(-1)} className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-all border border-slate-200" title="Previous Month"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
          <select value={month} onChange={e => setMonth(+e.target.value)}
            className="text-sm text-slate-700 px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500">
            {MONTH_NAMES.map((n, i) => <option key={i} value={i+1}>{n}</option>)}
          </select>
          <select value={year} onChange={e => setYear(+e.target.value)}
            className="text-sm text-slate-700 px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500">
            {[2024,2025,2026,2027,2028].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => handleMonthChange(1)} className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-all border border-slate-200" title="Next Month"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
          <button onClick={handlePDF}
            className="text-sm font-medium px-4 py-2 rounded-lg transition-all border"
            style={{ background: '#1e3a5f', color: '#fff', borderColor: '#1e3a5f' }}>
            📄 Export PDF
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Opening Stock', val: totals.opening,          color: '#3b82f6', icon: '📦' },
          { label: 'Recv Dubai',    val: totals.total_recv_dubai, color: '#14b8a6', icon: '🚚' },
          { label: 'Recv UMQ',      val: totals.total_recv_umq,   color: '#a78bfa', icon: '📥' },
          { label: 'Dispatched',    val: totals.total_dispatch,   color: '#f97316', icon: '📤' },
          { label: 'Closing Stock', val: totals.closing,          color: '#f59e0b', icon: '🏁' },
        ].map(k => (
          <div key={k.label} className="rounded-xl p-4 bg-white shadow-sm" style={{ border: `1px solid ${k.color}30` }}>
            <div className="flex items-center gap-2 mb-2">
              <span>{k.icon}</span>
              <span className="text-xs text-slate-500">{k.label}</span>
            </div>
            <div className="text-xl font-bold" style={{ color: k.val === 0 ? '#ef4444' : k.color }}>
              {k.val.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden bg-white shadow-sm" style={{ border: '1px solid #e2e8f0' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200">Product</th>
                  <th className="px-3 py-3 text-xs font-semibold text-center uppercase border-b border-slate-200" style={{ color: '#3b82f6' }}>Opening</th>
                  <th className="px-3 py-3 text-xs font-semibold text-center uppercase border-b border-slate-200" style={{ color: '#0d9488' }}>Recv Dubai</th>
                  <th className="px-3 py-3 text-xs font-semibold text-center uppercase border-b border-slate-200" style={{ color: '#7c3aed' }}>Recv UMQ</th>
                  <th className="px-3 py-3 text-xs font-semibold text-center uppercase border-b border-slate-200" style={{ color: '#f97316' }}>Dispatched</th>
                  <th className="px-3 py-3 text-xs font-semibold text-center uppercase border-b border-slate-200" style={{ color: '#d97706' }}>Closing</th>
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map((cat, gi) => {
                  const rows = data.filter(r => r.category === cat);
                  if (!rows.length) return null;
                  return (
                    <React.Fragment key={`cat-${gi}`}>
                      {cat !== 'ICE PRODUCTS \u2014 FROM DUBAI' && (
                        <tr>
                          <td colSpan={6} className="px-4 py-2 text-xs font-bold uppercase tracking-widest"
                            style={{ background: CAT_COLORS[cat] + '15', color: CAT_COLORS[cat], borderTop: `2px solid ${CAT_COLORS[cat]}40` }}>
                            {cat}
                          </td>
                        </tr>
                      )}
                      {rows.map((r, ri) => (
                        <tr key={r.product_id}
                          style={{ background: ri % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                          <td className="px-4 py-2.5 text-xs font-medium text-slate-700">{r.product_name}</td>
                          <td className="px-3 py-2.5 text-center">{zeroRed(r.opening)}</td>
                          <td className="px-3 py-2.5 text-center">{zeroRed(r.total_recv_dubai)}</td>
                          <td className="px-3 py-2.5 text-center">{zeroRed(r.total_recv_umq)}</td>
                          <td className="px-3 py-2.5 text-center">{zeroRed(r.total_dispatch)}</td>
                          <td className="px-3 py-2.5 text-center font-semibold">{zeroRed(r.closing)}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
                {/* Totals */}
                <tr style={{ background: '#d97706', borderTop: '2px solid #f59e0b' }}>
                  <td className="px-4 py-2.5 text-xs font-bold text-white uppercase">TOTALS</td>
                  {[totals.opening, totals.total_recv_dubai, totals.total_recv_umq, totals.total_dispatch, totals.closing].map((v, i) => (
                    <td key={i} className="px-3 py-2.5 text-center text-sm font-bold"
                      style={{ color: v === 0 ? '#fca5a5' : '#fff' }}>
                      {v.toLocaleString()}
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
