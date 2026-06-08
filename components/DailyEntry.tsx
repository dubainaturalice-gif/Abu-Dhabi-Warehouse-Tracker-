import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, FileDown, CheckCircle, Clock, AlertCircle,
  Snowflake, Droplets, Package, RefreshCw, RotateCcw, Lock, Unlock, Save
} from 'lucide-react';
import { StockRecord, ProductDef, SaveStatus, User } from '../types';
import { getStockForDate, saveStock, getDaysWithData, fmtDate, isDayLocked, lockDay, unlockDay } from '../utils/db';

interface DailyEntryProps {
  user: User;
  products: ProductDef[];
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

const CAT_COLORS: Record<string, string> = {
  'ICE PRODUCTS': 'text-info',
  'JELAT': 'text-secondary',
  'ICE POP': 'text-accent',
};
function catColor(cat: string) {
  for (const [k, v] of Object.entries(CAT_COLORS)) if (cat.toUpperCase().includes(k)) return v;
  return 'text-primary';
}

export const DailyEntry: React.FC<DailyEntryProps> = ({ user, products }) => {
  const today = fmtDate(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [records, setRecords] = useState<StockRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus]   = useState<SaveStatus>('idle');
  const [confirmReset, setConfirmReset] = useState(false);
  const [filledDays, setFilledDays] = useState<string[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  // Which specific cells were locked at the last Save & Close (snapshot of values > 0 at save time)
  type LockedRow = { recv_dubai: boolean; recv_umq: boolean; dispatch: boolean };
  const [lockedFields, setLockedFields] = useState<Record<number, LockedRow>>({});
  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingRef  = useRef(false);   // guard: prevent concurrent loads
  const productsRef = useRef(products); // stable ref so loadRecords doesn't re-create on every render
  const recordsRef  = useRef(records);  // stable ref so flushSave always has latest records
  useEffect(() => { productsRef.current = products; }, [products]);
  useEffect(() => { recordsRef.current = records; }, [records]);

  const loadFilledDays = useCallback(async () => {
    try {
      const days = await getDaysWithData(viewYear, viewMonth + 1);
      setFilledDays(days);
    } catch (e) { /* ignore – non-critical */ }
  }, [viewYear, viewMonth]);

  const loadRecords = useCallback(async (date: string) => {
    if (loadingRef.current) return; // prevent concurrent / retry-loop
    loadingRef.current = true;
    setLoading(true);
    try {
      const [recs, locked] = await Promise.all([
        getStockForDate(date, productsRef.current),
        isDayLocked(date),
      ]);
      setRecords(recs);
      setIsLocked(locked);
      // Snapshot which cells had values > 0 at load time (= last saved state)
      if (locked) {
        const snap: Record<number, { recv_dubai: boolean; recv_umq: boolean; dispatch: boolean }> = {};
        recs.forEach((r, i) => { snap[i] = { recv_dubai: r.recv_dubai > 0, recv_umq: r.recv_umq > 0, dispatch: r.dispatch > 0 }; });
        setLockedFields(snap);
      } else {
        setLockedFields({});
      }
    } catch (e) {
      console.error('Load records failed:', e);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []); // no deps — uses refs, so this never re-creates

  useEffect(() => { loadFilledDays(); }, [loadFilledDays]);
  useEffect(() => { if (selectedDate) loadRecords(selectedDate); }, [selectedDate, loadRecords]);

  // Immediately flush any pending debounce save — call this before navigating away
  const flushSave = useCallback(async () => {
    if (!saveTimer.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = null;
    setSaveStatus('saving');
    try {
      await saveStock(recordsRef.current, user.username);
      setSaveStatus('saved');
      await loadFilledDays();
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (e) {
      console.error('Flush save failed:', e);
      setSaveStatus('error');
    }
  }, [user.username, loadFilledDays]);

  const triggerSave = useCallback((recs: StockRecord[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus('saving');
    saveTimer.current = setTimeout(async () => {
      try {
        await saveStock(recs, user.username);
        setSaveStatus('saved');
        await loadFilledDays();
        setTimeout(() => setSaveStatus('idle'), 2500);
      } catch (e) {
        console.error('Save failed:', e);
        setSaveStatus('error');
      }
    }, 3000);
  }, [user.username, loadFilledDays]);

  const updateCell = (idx: number, field: 'opening' | 'recv_dubai' | 'recv_umq' | 'dispatch', val: number) => {
    setRecords(prev => {
      const next = prev.map((r, i) => {
        if (i !== idx) return r;
        const updated = { ...r, [field]: val < 0 ? 0 : val };
        updated.closing = updated.opening + updated.recv_dubai + updated.recv_umq - updated.dispatch;
        if (updated.closing < 0) updated.closing = 0;
        return updated;
      });
      triggerSave(next);
      return next;
    });
  };

  // Save immediately then navigate — ensures carry-forward is in DB before next day loads
  const changeDate = async (delta: number) => {
    await flushSave();
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    const nd = fmtDate(d);
    setSelectedDate(nd);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const selectDate = async (date: string) => {
    await flushSave();
    setSelectedDate(date);
    const d = new Date(date + 'T00:00:00');
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  // Day strip
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const dayList = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(viewYear, viewMonth, i + 1);
    return { date: fmtDate(d), num: i + 1, day: DAYS[d.getDay()] };
  });

  // Totals
  const tot = records.reduce((a, r) => ({
    opening: a.opening + r.opening,
    recv_dubai: a.recv_dubai + r.recv_dubai,
    recv_umq: a.recv_umq + r.recv_umq,
    dispatch: a.dispatch + r.dispatch,
    closing: a.closing + r.closing,
  }), { opening: 0, recv_dubai: 0, recv_umq: 0, dispatch: 0, closing: 0 });

  // Group by category
  const grouped = records.reduce<Array<{ cat: string; items: Array<{ rec: StockRecord; idx: number }> }>>((acc, rec, idx) => {
    const g = acc.find(x => x.cat === rec.category);
    if (g) g.items.push({ rec, idx });
    else acc.push({ cat: rec.category, items: [{ rec, idx }] });
    return acc;
  }, []);

  // Reset current day: zero out received + dispatched, keep opening
  const resetDay = async () => {
    setConfirmReset(false);
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    const reset = records.map(r => ({
      ...r,
      recv_dubai: 0,
      recv_umq:   0,
      dispatch:   0,
      closing:    r.opening,
    }));
    setRecords(reset);
    recordsRef.current = reset;
    setSaveStatus('saving');
    try {
      await saveStock(reset, user.username);
      setSaveStatus('saved');
      await loadFilledDays();
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (e) {
      console.error('Reset save failed:', e);
      setSaveStatus('error');
    }
  };

  // Save + Lock (Employee: saves immediately and locks the day)
  const handleSave = async () => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    setSaveStatus('saving');
    try {
      await saveStock(recordsRef.current, user.username);
      if (user.role !== 'admin') {
        await lockDay(selectedDate, user.username);
        setIsLocked(true);
        // Snapshot: only cells with value > 0 at this moment get locked
        const snap: Record<number, { recv_dubai: boolean; recv_umq: boolean; dispatch: boolean }> = {};
        recordsRef.current.forEach((r, i) => { snap[i] = { recv_dubai: r.recv_dubai > 0, recv_umq: r.recv_umq > 0, dispatch: r.dispatch > 0 }; });
        setLockedFields(snap);
      }
      setSaveStatus('saved');
      await loadFilledDays();
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (e) {
      console.error('Save failed:', e);
      setSaveStatus('error');
    }
  };

  // Unlock (Admin only)
  const handleUnlock = async () => {
    await unlockDay(selectedDate);
    setIsLocked(false);
    setLockedFields({});
  };

  // PDF export
  const exportPDF = async () => {
    const d = new Date(selectedDate + 'T00:00:00');
    const mName = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
    const title = `${d.getDate()} ${mName} ${d.getFullYear()}`;
    const payload = { type: 'daily', output: `/tmp/daily_${selectedDate}.pdf`, title, records };
    try {
      await window.tasklet.writeFileToDisk('/tmp/pdf_in.json', JSON.stringify(payload));
      const r = await window.tasklet.runCommand(
        `uv run --with fpdf2 python3 /tasklet/agent/home/apps/abudhabi-warehouse-tracker/generate_pdf.py < /tmp/pdf_in.json`
      );
      if (r.exitCode !== 0) throw new Error(r.log);
      const b64 = await window.tasklet.runCommand(`base64 /tmp/daily_${selectedDate}.pdf`);
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${b64.log.trim()}`;
      link.download = `NaturalIce_Abu_Dhabi_Daily_${selectedDate}.pdf`;
      link.click();
    } catch (e) { console.error('PDF export failed:', e); }
  };

  const dateObj = new Date(selectedDate + 'T00:00:00');
  const isToday = selectedDate === today;

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Top header ───────────────────────────────────────── */}
      <div className="bg-base-200 border-b border-base-300 px-5 py-3 flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => changeDate(-1)} className="btn btn-ghost btn-sm btn-circle"><ChevronLeft size={16} /></button>
          <div className="text-center select-none">
            <div className="flex items-center justify-center gap-2">
              <span className="font-bold text-base-content text-base leading-tight">
                {dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              <span className="badge badge-neutral badge-sm font-bold">Day {dateObj.getDate()}</span>
              {isToday && <span className="badge badge-primary badge-sm">Today</span>}
              {isLocked && <span className="badge badge-warning badge-sm gap-1"><Lock size={10} />Locked</span>}
            </div>
          </div>
          <button onClick={() => changeDate(1)} className="btn btn-ghost btn-sm btn-circle"><ChevronRight size={16} /></button>
        </div>

        <div className="flex items-center gap-2">
          {saveStatus === 'saving' && <span className="text-xs text-base-content/40 flex items-center gap-1"><Clock size={11} />Saving…</span>}
          {saveStatus === 'saved'  && <span className="text-xs text-success flex items-center gap-1"><CheckCircle size={11} />Saved</span>}
          {saveStatus === 'error'  && <span className="text-xs text-error flex items-center gap-1"><AlertCircle size={11} />Error</span>}
          <button onClick={() => loadRecords(selectedDate)} className="btn btn-ghost btn-sm btn-circle" title="Reload">
            <RefreshCw size={13} />
          </button>
          {/* Save & Close — always active so employee can re-lock after filling zero cells */}
          <button
            onClick={handleSave}
            className="btn btn-success btn-sm gap-1.5 text-white"
            title={user.role !== 'admin' ? 'Save and lock filled columns' : 'Save now'}
          >
            <Save size={13} />{user.role !== 'admin' ? 'Save & Close' : 'Save Now'}
          </button>
          {/* Unlock — admin only */}
          {isLocked && user.role === 'admin' && (
            <button
              onClick={handleUnlock}
              className="btn btn-outline btn-sm gap-1.5 border-warning/60 text-warning hover:bg-warning hover:text-white"
            >
              <Unlock size={13} />Unlock
            </button>
          )}
          {/* Reset Day — hidden when locked for employees */}
          {!(isLocked && user.role !== 'admin') && (
            <button
              onClick={() => setConfirmReset(true)}
              className="btn btn-outline btn-sm gap-1.5 border-error/40 text-error hover:bg-error hover:text-white"
              title="Reset today's entries to zero"
            >
              <RotateCcw size={13} />Reset Day
            </button>
          )}
          <button onClick={exportPDF} className="btn btn-outline btn-sm gap-1.5 border-primary/30 text-primary hover:bg-primary hover:text-primary-content">
            <FileDown size={13} />Export PDF
          </button>
        </div>
      </div>

      {/* ── Reset confirmation modal ─────────────────────── */}
      {confirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-base-100 rounded-2xl shadow-2xl p-6 w-80 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚠️</span>
              <div>
                <div className="font-bold text-base-content text-base">Reset This Day?</div>
                <div className="text-sm text-base-content/60 mt-0.5">
                  This will set all <span className="font-semibold text-error">Received &amp; Dispatched</span> values to <span className="font-semibold">0</span> for this day. Opening stock stays as-is.
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmReset(false)} className="btn btn-ghost btn-sm">Cancel</button>
              <button onClick={resetDay} className="btn btn-error btn-sm gap-1.5 text-white">
                <RotateCcw size={13} />Yes, Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Month navigation + Day strip ─────────────────────── */}
      <div className="bg-base-200 border-b border-base-300 px-4 pt-2 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => { const pm = viewMonth === 0; setViewMonth(pm ? 11 : viewMonth - 1); if (pm) setViewYear(y => y - 1); }}
            className="btn btn-ghost btn-xs btn-circle"
          ><ChevronLeft size={12} /></button>
          <span className="text-xs font-bold text-base-content/70 w-36 text-center">{MONTHS[viewMonth]} {viewYear}</span>
          <button
            onClick={() => { const nm = viewMonth === 11; setViewMonth(nm ? 0 : viewMonth + 1); if (nm) setViewYear(y => y + 1); }}
            className="btn btn-ghost btn-xs btn-circle"
          ><ChevronRight size={12} /></button>
          <span className="ml-2 text-xs text-base-content/30">{filledDays.length}/{daysInMonth} days entered</span>
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1 scroll-smooth">
          {dayList.map(({ date, num, day }) => {
            const sel = date === selectedDate;
            const filled = filledDays.includes(date);
            const tod = date === today;
            return (
              <button
                key={date}
                onClick={() => selectDate(date)}
                className={`flex-shrink-0 flex flex-col items-center px-2 py-1 rounded-lg transition-all min-w-[34px] ${
                  sel    ? 'bg-primary text-primary-content shadow-md scale-105' :
                  filled ? 'bg-success/15 text-success hover:bg-success/25' :
                  tod    ? 'bg-base-300 text-base-content ring-1 ring-primary/40' :
                           'hover:bg-base-300 text-base-content/40 hover:text-base-content/70'
                }`}
              >
                <span className="font-medium opacity-60" style={{fontSize:'8px'}}>{day}</span>
                <span className="font-bold text-xs">{num}</span>
                {filled && !sel && <span className="w-1 h-1 rounded-full bg-success" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Stats bar ────────────────────────────────────────── */}
      <div className="grid grid-cols-5 divide-x divide-base-300 border-b border-base-300 flex-shrink-0 bg-base-200">
        {[
          { label: 'Opening',    value: tot.opening,    cls: 'text-base-content' },
          { label: 'Recv Dubai', value: tot.recv_dubai, cls: 'text-info' },
          { label: 'Recv UMQ',   value: tot.recv_umq,   cls: 'text-info' },
          { label: 'Dispatch',   value: tot.dispatch,   cls: 'text-warning' },
          { label: 'Closing',    value: tot.closing,    cls: 'text-success' },
        ].map(s => (
          <div key={s.label} className="py-2 px-3 text-center">
            <div className={`text-xl font-extrabold tabular-nums ${s.cls}`}>{s.value.toLocaleString()}</div>
            <div className="text-xs text-base-content/40 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Table ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 gap-3 text-base-content/40">
            <span className="loading loading-spinner loading-md text-primary" />
            <span className="text-sm">Loading stock data…</span>
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-base-content/30">
            <Package size={32} />
            <span className="text-sm">No products configured</span>
          </div>
        ) : (
          <table className="table table-sm w-full">
            <thead className="sticky top-0 z-10 bg-base-200 border-b border-base-300">
              <tr>
                <th className="text-left text-xs font-semibold text-base-content/50 pl-4 py-2 w-64">Product</th>
                {['Opening','Recv Dubai','Recv UMQ','Dispatch','Closing'].map(h => (
                  <th key={h} className="text-center text-xs font-semibold text-base-content/50 py-2 w-24">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grouped.map(({ cat, items }) => (
                <React.Fragment key={cat}>
                  {/* Category header */}
                  <tr className="border-b border-base-300">
                    <td colSpan={6} className="py-1.5 px-4 bg-base-300/50">
                      <span className={`text-xs font-bold uppercase tracking-widest ${catColor(cat)}`}>
                        {cat.replace(/\u2014|\u2013/g, '–')}
                      </span>
                    </td>
                  </tr>
                  {items.map(({ rec, idx }) => (
                    <tr key={rec.product} className="hover:bg-base-200/60 border-b border-base-300/40 transition-colors group">
                      <td className="pl-4 text-sm font-medium text-base-content/80 py-1.5 w-64">{rec.product}</td>

                      {/* Opening: read-only for employees, editable for admin */}
                      <td className="text-center p-0.5 w-24">
                        {user.role !== 'admin' ? (
                          <span className={`block w-full text-center text-sm tabular-nums py-1${rec.opening === 0 ? ' text-error font-bold' : ''}`}>{rec.opening}</span>
                        ) : (
                          <input
                            type="number" min={0}
                            className={`w-full text-center bg-transparent border border-transparent hover:border-base-content/20 focus:border-primary focus:bg-base-100 rounded-md px-1 py-1 text-sm tabular-nums outline-none transition-all${rec.opening === 0 ? ' text-error font-semibold' : ''}`}
                            value={rec.opening === 0 ? 0 : rec.opening}
                            placeholder="0"
                            onChange={e => updateCell(idx, 'opening', Number(e.target.value) || 0)}
                            onFocus={e => e.target.select()}
                          />
                        )}
                      </td>

                      {/* recv_dubai — lock cell only if value > 0 and day is closed (employee) */}
                      <td className="text-center p-0.5 w-24">
                        {isLocked && user.role !== 'admin' && lockedFields[idx]?.recv_dubai ? (
                          <span className="block w-full text-center text-sm tabular-nums text-info font-semibold py-1">{rec.recv_dubai}</span>
                        ) : (
                          <input
                            type="number" min={0}
                            className="w-full text-center bg-transparent border border-transparent hover:border-base-content/20 focus:border-info focus:bg-base-100 rounded-md px-1 py-1 text-sm tabular-nums text-info outline-none transition-all"
                            value={rec.recv_dubai === 0 ? '' : rec.recv_dubai}
                            placeholder="0"
                            onChange={e => updateCell(idx, 'recv_dubai', Number(e.target.value) || 0)}
                            onFocus={e => e.target.select()}
                          />
                        )}
                      </td>

                      {/* recv_umq — lock cell only if value > 0 and day is closed (employee) */}
                      <td className="text-center p-0.5 w-24">
                        {isLocked && user.role !== 'admin' && lockedFields[idx]?.recv_umq ? (
                          <span className="block w-full text-center text-sm tabular-nums text-info font-semibold py-1">{rec.recv_umq}</span>
                        ) : (
                          <input
                            type="number" min={0}
                            className="w-full text-center bg-transparent border border-transparent hover:border-base-content/20 focus:border-info focus:bg-base-100 rounded-md px-1 py-1 text-sm tabular-nums text-info outline-none transition-all"
                            value={rec.recv_umq === 0 ? '' : rec.recv_umq}
                            placeholder="0"
                            onChange={e => updateCell(idx, 'recv_umq', Number(e.target.value) || 0)}
                            onFocus={e => e.target.select()}
                          />
                        )}
                      </td>

                      {/* dispatch — lock cell only if value > 0 and day is closed (employee) */}
                      <td className="text-center p-0.5 w-24">
                        {isLocked && user.role !== 'admin' && lockedFields[idx]?.dispatch ? (
                          <span className="block w-full text-center text-sm tabular-nums text-warning font-semibold py-1">{rec.dispatch}</span>
                        ) : (
                          <input
                            type="number" min={0}
                            className="w-full text-center bg-transparent border border-transparent hover:border-base-content/20 focus:border-warning focus:bg-base-100 rounded-md px-1 py-1 text-sm tabular-nums text-warning outline-none transition-all"
                            value={rec.dispatch === 0 ? '' : rec.dispatch}
                            placeholder="0"
                            onChange={e => updateCell(idx, 'dispatch', Number(e.target.value) || 0)}
                            onFocus={e => e.target.select()}
                          />
                        )}
                      </td>

                      {/* Read-only: closing (auto-calculated) */}
                      <td className="text-center w-24 py-1">
                        <span className={`text-sm font-bold tabular-nums ${rec.closing > 0 ? 'text-success' : 'text-error'}`}>
                          {rec.closing}
                        </span>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}

              {/* Grand total row */}
              <tr className="border-t-2 border-primary/30 bg-primary/5 font-bold">
                <td className="pl-4 py-2 text-xs font-extrabold uppercase tracking-wider text-primary">Grand Total</td>
                <td className="text-center text-sm tabular-nums text-base-content">{tot.opening.toLocaleString()}</td>
                <td className="text-center text-sm tabular-nums text-info">{tot.recv_dubai.toLocaleString()}</td>
                <td className="text-center text-sm tabular-nums text-info">{tot.recv_umq.toLocaleString()}</td>
                <td className="text-center text-sm tabular-nums text-warning">{tot.dispatch.toLocaleString()}</td>
                <td className="text-center text-sm tabular-nums text-success">{tot.closing.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
