'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { YearlyMonthSummary } from '@/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export default function YearlySummary() {
  const { token } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<YearlyMonthSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/yearly?year=${year}`, { headers: { Authorization: `Bearer ${token}` } });
      setData(await res.json());
    } finally { setLoading(false); }
  }, [token, year]);

  useEffect(() => { load(); }, [load]);

  const totals = {
    recv_dubai: data.reduce((s, r) => s + r.total_recv_dubai, 0),
    recv_umq:   data.reduce((s, r) => s + r.total_recv_umq,   0),
    dispatch:   data.reduce((s, r) => s + r.total_dispatch,   0),
    days:       data.reduce((s, r) => s + r.days_with_data,   0),
  };

  const chartData = data.map(m => ({
    name: m.month_name,
    'Recv Dubai': m.total_recv_dubai,
    'Recv UMQ':   m.total_recv_umq,
    'Dispatched': m.total_dispatch,
  }));

  const handlePDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFillColor(10, 22, 40);
    doc.rect(0, 0, 297, 25, 'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(16);
    doc.setFont('helvetica','bold');
    doc.text(`ABU DHABI WAREHOUSE \u2014 YEARLY OVERVIEW ${year}`, 15, 12);
    doc.setFontSize(10);
    doc.setFont('helvetica','normal');
    doc.setTextColor(148,163,184);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 297 - 15, 20, { align: 'right' });

    // KPI
    const kpis = [
      { label: 'Total Recv Dubai', value: totals.recv_dubai,   color: [20,184,166] as [number,number,number] },
      { label: 'Total Recv UMQ',   value: totals.recv_umq,     color: [124,58,237] as [number,number,number] },
      { label: 'Total Dispatched', value: totals.dispatch,     color: [249,115,22] as [number,number,number] },
      { label: 'Days with Data',   value: totals.days,         color: [59,130,246] as [number,number,number] },
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

    autoTable(doc, {
      startY: 55,
      head: [['Month', 'Opening', 'Recv Dubai', 'Recv UMQ', 'Dispatched', 'Closing', 'Days']],
      body: data.map(m => [m.month_name, m.opening, m.total_recv_dubai, m.total_recv_umq, m.total_dispatch, m.closing, m.days_with_data]),
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3, halign: 'center' },
      headStyles: { fillColor: [10,22,40], textColor: [148,163,184], fontStyle: 'bold' },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
      alternateRowStyles: { fillColor: [240,253,252] },
      footStyles: { fillColor: [217,119,6], textColor: [255,255,255], fontStyle: 'bold' },
      foot: [['TOTAL', '', totals.recv_dubai, totals.recv_umq, totals.dispatch, '', totals.days]],
      margin: { left: 15, right: 15 },
    });

    doc.save(`warehouse-yearly-${year}.pdf`);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Yearly Overview</h1>
          <p className="text-slate-500 text-sm mt-0.5">Month-by-month breakdown for {year}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setYear(y => y - 1)} className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-all border border-slate-200" title="Previous Year"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
          <select value={year} onChange={e => setYear(+e.target.value)}
            className="text-sm text-slate-700 px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500">
            {[2024,2025,2026,2027,2028].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => setYear(y => y + 1)} className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-all border border-slate-200" title="Next Year"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
          <button onClick={handlePDF}
            className="text-sm font-medium px-4 py-2 rounded-lg border"
            style={{ background: '#1e3a5f', color: '#fff', borderColor: '#1e3a5f' }}>
            📄 Export PDF
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Recv Dubai', val: totals.recv_dubai, color: '#14b8a6', icon: '🚚' },
          { label: 'Total Recv UMQ',   val: totals.recv_umq,   color: '#a78bfa', icon: '📥' },
          { label: 'Total Dispatched', val: totals.dispatch,   color: '#f97316', icon: '📤' },
          { label: 'Days with Data',   val: totals.days,       color: '#60a5fa', icon: '📅' },
        ].map(k => (
          <div key={k.label} className="rounded-xl p-4 bg-white shadow-sm" style={{ border: `1px solid ${k.color}30` }}>
            <div className="flex items-center gap-2 mb-2">
              <span>{k.icon}</span>
              <span className="text-xs text-slate-500">{k.label}</span>
            </div>
            <div className="text-2xl font-bold" style={{ color: k.color }}>
              {k.val.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Bar Chart */}
      <div className="rounded-xl p-5 mb-6 bg-white shadow-sm" style={{ border: '1px solid #e2e8f0' }}>
        <h3 className="text-sm font-semibold text-slate-600 mb-4">Monthly Movement Chart</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#334155' }} />
            <Legend wrapperStyle={{ color: '#64748b', fontSize: 12 }} />
            <Bar dataKey="Recv Dubai" fill="#14b8a6" radius={[3,3,0,0]} />
            <Bar dataKey="Recv UMQ"   fill="#a78bfa" radius={[3,3,0,0]} />
            <Bar dataKey="Dispatched" fill="#f97316" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
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
                  {['Month','Opening','Recv Dubai','Recv UMQ','Dispatched','Closing','Days'].map((h,i) => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide border-b border-slate-200 ${i === 0 ? 'text-left' : 'text-center'}`}
                      style={{ color: ['#475569','#3b82f6','#0d9488','#7c3aed','#f97316','#d97706','#64748b'][i] }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((m, i) => (
                  <tr key={m.month}
                    style={{ background: i % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}
                    className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 text-sm font-semibold text-slate-800">{m.month_name}</td>
                    <td className="px-4 py-2.5 text-center text-sm">{m.opening > 0 ? m.opening.toLocaleString() : <span style={{color:'#ef4444',fontWeight:700}}>0</span>}</td>
                    <td className="px-4 py-2.5 text-center text-sm" style={{color:'#0d9488'}}>{m.total_recv_dubai.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-center text-sm" style={{color:'#7c3aed'}}>{m.total_recv_umq.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-center text-sm" style={{color:'#f97316'}}>{m.total_dispatch.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-center text-sm font-semibold">{m.closing > 0 ? m.closing.toLocaleString() : <span style={{color:'#ef4444',fontWeight:700}}>0</span>}</td>
                    <td className="px-4 py-2.5 text-center text-sm text-slate-500">{m.days_with_data}</td>
                  </tr>
                ))}
                <tr style={{ background: '#d97706', borderTop: '2px solid #f59e0b' }}>
                  <td className="px-4 py-2.5 text-xs font-bold text-white uppercase">TOTAL</td>
                  <td className="px-4 py-2.5 text-center font-bold text-white">—</td>
                  <td className="px-4 py-2.5 text-center font-bold text-white">{totals.recv_dubai.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-center font-bold text-white">{totals.recv_umq.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-center font-bold text-white">{totals.dispatch.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-center font-bold text-white">—</td>
                  <td className="px-4 py-2.5 text-center font-bold text-white">{totals.days}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
