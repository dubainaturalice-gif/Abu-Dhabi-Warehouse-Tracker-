import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, FileDown, TrendingUp, RefreshCw } from 'lucide-react';
import { MonthlyStat } from '../types';
import { getYearlyData, getAvailableYears } from '../utils/db';

export const YearlySummary: React.FC = () => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData]   = useState<MonthlyStat[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, y] = await Promise.all([getYearlyData(year), getAvailableYears()]);
      setData(d);
      const allYears = Array.from(new Set([...y, year])).sort((a, b) => b - a);
      setYears(allYears);
    } catch (e) { console.error('Yearly load failed:', e); }
    finally { setLoading(false); }
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const totals = data.reduce((a, m) => ({
    recv_dubai: a.recv_dubai + m.total_recv_dubai,
    recv_umq:   a.recv_umq   + m.total_recv_umq,
    recv:       a.recv       + m.total_recv,
    dispatch:   a.dispatch   + m.total_dispatch,
    days:       a.days       + m.days_entered,
  }), { recv_dubai: 0, recv_umq: 0, recv: 0, dispatch: 0, days: 0 });

  const maxRecv = Math.max(...data.map(m => m.total_recv), 1);

  const exportPDF = async () => {
    const title = `Year ${year} - Annual Report`;
    const payload = { type: 'yearly', output: `/tmp/yearly_${year}.pdf`, title, data };
    try {
      await window.tasklet.writeFileToDisk('/tmp/pdf_in.json', JSON.stringify(payload));
      const r = await window.tasklet.runCommand(
        `uv run --with fpdf2 python3 /tasklet/agent/home/apps/abudhabi-warehouse-tracker/generate_pdf.py < /tmp/pdf_in.json`
      );
      if (r.exitCode !== 0) throw new Error(r.log);
      const b64 = await window.tasklet.runCommand(`base64 /tmp/yearly_${year}.pdf`);
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${b64.log.trim()}`;
      link.download = `NaturalIce_Yearly_${year}.pdf`;
      link.click();
    } catch (e) { console.error('PDF export failed:', e); }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="bg-base-200 border-b border-base-300 px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-primary" />
          <div className="flex items-center gap-2 ml-1">
            <button onClick={() => setYear(y => y - 1)} className="btn btn-ghost btn-sm btn-circle"><ChevronLeft size={15} /></button>
            <div className="text-center w-28">
              <div className="font-bold text-base-content text-lg">{year}</div>
              <div className="text-xs text-base-content/40">Annual Report</div>
            </div>
            <button onClick={() => setYear(y => y + 1)} className="btn btn-ghost btn-sm btn-circle"><ChevronRight size={15} /></button>
          </div>
          {/* Year quick-select */}
          {years.length > 1 && (
            <select
              className="select select-sm select-bordered bg-base-100 ml-2"
              value={year}
              onChange={e => setYear(Number(e.target.value))}
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn btn-ghost btn-sm btn-circle" title="Reload"><RefreshCw size={13} /></button>
          <button onClick={exportPDF} className="btn btn-outline btn-sm gap-1.5 border-primary/30 text-primary hover:bg-primary hover:text-primary-content">
            <FileDown size={13} />Export PDF
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-3 p-4 border-b border-base-300 flex-shrink-0 bg-base-100">
        {[
          { label: 'Total Recv Dubai', value: totals.recv_dubai, cls: 'text-info' },
          { label: 'Total Recv UMQ',   value: totals.recv_umq,   cls: 'text-info' },
          { label: 'Total Dispatch',   value: totals.dispatch,   cls: 'text-warning' },
          { label: 'Days Entered',     value: totals.days,       cls: 'text-success' },
        ].map(k => (
          <div key={k.label} className="bg-base-200 rounded-xl p-3 text-center">
            <div className={`text-2xl font-extrabold tabular-nums ${k.cls}`}>{k.value.toLocaleString()}</div>
            <div className="text-xs text-base-content/40 font-medium mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 gap-3 text-base-content/40">
            <span className="loading loading-spinner loading-md text-primary" />
            <span className="text-sm">Loading yearly data…</span>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-base-content/30">
            <TrendingUp size={32} />
            <span className="text-sm">No data for {year}</span>
          </div>
        ) : (
          <>
            {/* Mini bar chart */}
            <div className="bg-base-200 rounded-xl p-4 mb-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-3">Monthly Received Stock</h3>
              <div className="flex items-end gap-1 h-24">
                {data.map(m => {
                  const pct = Math.round((m.total_recv / maxRecv) * 100);
                  const label = m.label.split(' ')[0];
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group">
                      <div className="text-xs font-bold text-base-content/40 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{fontSize:'9px'}}>{m.total_recv.toLocaleString()}</div>
                      <div className="w-full bg-primary/80 rounded-t transition-all hover:bg-primary" style={{height:`${Math.max(pct, 4)}%`}} />
                      <span className="text-base-content/40" style={{fontSize:'9px'}}>{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Table */}
            <div className="bg-base-200 rounded-xl overflow-hidden">
              <table className="table table-sm w-full">
                <thead className="bg-base-300">
                  <tr>
                    <th className="text-xs font-semibold text-base-content/50 pl-4">Month</th>
                    <th className="text-center text-xs font-semibold text-base-content/50">Recv Dubai</th>
                    <th className="text-center text-xs font-semibold text-base-content/50">Recv UMQ</th>
                    <th className="text-center text-xs font-semibold text-base-content/50">Total Recv</th>
                    <th className="text-center text-xs font-semibold text-base-content/50">Dispatch</th>
                    <th className="text-center text-xs font-semibold text-base-content/50">Last Closing</th>
                    <th className="text-center text-xs font-semibold text-base-content/50">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((m, i) => (
                    <tr key={m.month} className="hover:bg-base-300/40 border-b border-base-300/40">
                      <td className="pl-4 font-semibold text-sm text-base-content/80 py-2">{m.label}</td>
                      <td className="text-center text-sm tabular-nums text-info">{m.total_recv_dubai.toLocaleString()}</td>
                      <td className="text-center text-sm tabular-nums text-info">{m.total_recv_umq.toLocaleString()}</td>
                      <td className="text-center text-sm font-bold tabular-nums text-info">{m.total_recv.toLocaleString()}</td>
                      <td className="text-center text-sm tabular-nums text-warning">{m.total_dispatch.toLocaleString()}</td>
                      <td className="text-center text-sm tabular-nums text-success">{m.last_closing.toLocaleString()}</td>
                      <td className="text-center text-xs text-base-content/50">{m.days_entered}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-primary/30 bg-primary/5 font-bold">
                    <td className="pl-4 py-2 text-xs font-extrabold uppercase tracking-wider text-primary">Total {year}</td>
                    <td className="text-center text-sm font-bold tabular-nums text-info">{totals.recv_dubai.toLocaleString()}</td>
                    <td className="text-center text-sm font-bold tabular-nums text-info">{totals.recv_umq.toLocaleString()}</td>
                    <td className="text-center text-sm font-bold tabular-nums text-info">{totals.recv.toLocaleString()}</td>
                    <td className="text-center text-sm font-bold tabular-nums text-warning">{totals.dispatch.toLocaleString()}</td>
                    <td className="text-center text-sm tabular-nums text-base-content/30">—</td>
                    <td className="text-center text-xs font-bold text-success">{totals.days}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
