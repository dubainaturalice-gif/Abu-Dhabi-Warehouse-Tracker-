import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, FileDown, BarChart3, RefreshCw } from 'lucide-react';
import { StockRecord } from '../types';
import { getMonthlyData } from '../utils/db';

interface MonthlySummaryProps {}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MSHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export const MonthlySummary: React.FC<MonthlySummaryProps> = () => {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-indexed
  const [records, setRecords] = useState<StockRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMonthlyData(year, month);
      setRecords(data);
    } catch (e) { console.error('Monthly load failed:', e); }
    finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  // Group by category
  const grouped = records.reduce<Array<{ cat: string; items: StockRecord[] }>>((acc, rec) => {
    const g = acc.find(x => x.cat === rec.category);
    if (g) g.items.push(rec);
    else acc.push({ cat: rec.category, items: [rec] });
    return acc;
  }, []);

  const tot = records.reduce((a, r) => ({
    opening: a.opening + r.opening,
    recv_dubai: a.recv_dubai + r.recv_dubai,
    recv_umq: a.recv_umq + r.recv_umq,
    dispatch: a.dispatch + r.dispatch,
    closing: a.closing + r.closing,
  }), { opening: 0, recv_dubai: 0, recv_umq: 0, dispatch: 0, closing: 0 });

  const exportPDF = async () => {
    const title = `${MSHORT[month - 1]} ${year} - Monthly Summary`;
    const payload = { type: 'monthly', output: `/tmp/monthly_${year}_${month}.pdf`, title, records };
    try {
      await window.tasklet.writeFileToDisk('/tmp/pdf_in.json', JSON.stringify(payload));
      const r = await window.tasklet.runCommand(
        `uv run --with fpdf2 python3 /tasklet/agent/home/apps/abudhabi-warehouse-tracker/generate_pdf.py < /tmp/pdf_in.json`
      );
      if (r.exitCode !== 0) throw new Error(r.log);
      const b64 = await window.tasklet.runCommand(`base64 /tmp/monthly_${year}_${month}.pdf`);
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${b64.log.trim()}`;
      link.download = `NaturalIce_Monthly_${year}_${String(month).padStart(2,'0')}.pdf`;
      link.click();
    } catch (e) { console.error('PDF export failed:', e); }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="bg-base-200 border-b border-base-300 px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-primary" />
          <div className="flex items-center gap-2 ml-1">
            <button onClick={prevMonth} className="btn btn-ghost btn-sm btn-circle"><ChevronLeft size={15} /></button>
            <div className="text-center w-40">
              <div className="font-bold text-base-content text-base">{MONTHS[month - 1]} {year}</div>
              <div className="text-xs text-base-content/40">Monthly Report</div>
            </div>
            <button onClick={nextMonth} className="btn btn-ghost btn-sm btn-circle"><ChevronRight size={15} /></button>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn btn-ghost btn-sm btn-circle" title="Reload"><RefreshCw size={13} /></button>
          <button onClick={exportPDF} className="btn btn-outline btn-sm gap-1.5 border-primary/30 text-primary hover:bg-primary hover:text-primary-content">
            <FileDown size={13} />Export PDF
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 divide-x divide-base-300 border-b border-base-300 flex-shrink-0 bg-base-200">
        {[
          { label: 'Opening',    value: tot.opening,    cls: tot.opening === 0 ? 'text-error' : 'text-base-content' },
          { label: 'Recv Dubai', value: tot.recv_dubai, cls: 'text-info' },
          { label: 'Recv UMQ',   value: tot.recv_umq,   cls: 'text-info' },
          { label: 'Dispatch',   value: tot.dispatch,   cls: 'text-warning' },
          { label: 'Closing',    value: tot.closing,    cls: tot.closing === 0 ? 'text-error' : 'text-success' },
        ].map(s => (
          <div key={s.label} className="py-2 px-3 text-center">
            <div className={`text-xl font-extrabold tabular-nums ${s.cls}`}>{s.value.toLocaleString()}</div>
            <div className="text-xs text-base-content/40 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 gap-3 text-base-content/40">
            <span className="loading loading-spinner loading-md text-primary" />
            <span className="text-sm">Loading monthly data…</span>
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-base-content/30">
            <BarChart3 size={32} />
            <span className="text-sm">No data for {MONTHS[month - 1]} {year}</span>
            <span className="text-xs">Enter daily stock to see monthly totals</span>
          </div>
        ) : (
          <table className="table table-sm w-full">
            <thead className="sticky top-0 z-10 bg-base-200 border-b border-base-300">
              <tr>
                <th className="text-left text-xs font-semibold text-base-content/50 pl-4 py-2">Product</th>
                {['Opening','Recv Dubai','Recv UMQ','Dispatch','Closing'].map(h => (
                  <th key={h} className="text-center text-xs font-semibold text-base-content/50 py-2 w-24">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grouped.map(({ cat, items }) => (
                <React.Fragment key={cat}>
                  <tr className="border-b border-base-300">
                    <td colSpan={6} className="py-1.5 px-4 bg-base-300/50">
                      <span className="text-xs font-bold uppercase tracking-widest text-primary">
                        {cat.replace(/\u2014|\u2013/g, '–')}
                      </span>
                    </td>
                  </tr>
                  {items.map(rec => (
                    <tr key={rec.product} className="hover:bg-base-200/60 border-b border-base-300/40">
                      <td className="pl-4 text-sm font-medium text-base-content/80 py-1.5">{rec.product}</td>
                      <td className={`text-center text-sm tabular-nums font-semibold ${rec.opening === 0 ? 'text-error' : 'text-base-content/70'}`}>{rec.opening.toLocaleString()}</td>
                      <td className="text-center text-sm tabular-nums text-info">{rec.recv_dubai.toLocaleString()}</td>
                      <td className="text-center text-sm tabular-nums text-info">{rec.recv_umq.toLocaleString()}</td>
                      <td className="text-center text-sm tabular-nums text-warning">{rec.dispatch.toLocaleString()}</td>
                      <td className={`text-center text-sm font-bold tabular-nums ${rec.closing === 0 ? 'text-error' : 'text-success'}`}>{rec.closing.toLocaleString()}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
              <tr className="border-t-2 border-primary/30 bg-primary/5">
                <td className="pl-4 py-2 text-xs font-extrabold uppercase tracking-wider text-primary">Grand Total</td>
                <td className={`text-center text-sm font-bold tabular-nums ${tot.opening === 0 ? 'text-error' : ''}`}>{tot.opening.toLocaleString()}</td>
                <td className="text-center text-sm font-bold tabular-nums text-info">{tot.recv_dubai.toLocaleString()}</td>
                <td className="text-center text-sm font-bold tabular-nums text-info">{tot.recv_umq.toLocaleString()}</td>
                <td className="text-center text-sm font-bold tabular-nums text-warning">{tot.dispatch.toLocaleString()}</td>
                <td className={`text-center text-sm font-bold tabular-nums ${tot.closing === 0 ? 'text-error' : 'text-success'}`}>{tot.closing.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
