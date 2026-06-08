import { User, StockRecord, ProductDef, MonthlyStat } from '../types';

const esc = (s: string | number): string =>
  typeof s === 'number' ? String(s) : String(s).replace(/'/g, "''");

// ─── DB Init ──────────────────────────────────────────────────────────────────
// Minimises SQL calls: batch inserts + single statements wherever possible.

export async function initDB(): Promise<void> {
  // sqlExec supports ONE statement at a time — separate calls required
  await window.tasklet.sqlExec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee',
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  await window.tasklet.sqlExec(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
  )`);

  await window.tasklet.sqlExec(`CREATE TABLE IF NOT EXISTS stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    product TEXT NOT NULL,
    category TEXT NOT NULL,
    opening REAL DEFAULT 0,
    recv_dubai REAL DEFAULT 0,
    recv_umq REAL DEFAULT 0,
    dispatch REAL DEFAULT 0,
    closing REAL DEFAULT 0,
    updated_by TEXT DEFAULT '',
    updated_at TEXT DEFAULT '',
    UNIQUE(date, product)
  )`);

  // Locked days — employees cannot edit after saving
  await window.tasklet.sqlExec(`CREATE TABLE IF NOT EXISTS locked_days (
    date TEXT PRIMARY KEY,
    locked_by TEXT DEFAULT '',
    locked_at TEXT DEFAULT (datetime('now'))
  )`);

  // Default users — single bulk INSERT (1 call, INSERT OR IGNORE = safe to repeat)
  await window.tasklet.sqlExec(
    `INSERT OR IGNORE INTO users (username, password, role) VALUES
      ('admin', 'admin123', 'admin'),
      ('employee01', 'emp123', 'employee')`
  );

  // Seed products from JSON — ONE bulk insert
  const cnt = await window.tasklet.sqlQuery('SELECT COUNT(*) as c FROM products');
  if (Number((cnt[0] as any).c) === 0) {
    const raw = await window.tasklet.readFileFromDisk(
      '/tasklet/agent/home/apps/abudhabi-warehouse-tracker/abudhabi_data.json'
    );
    const data = JSON.parse(raw);
    const firstDayKey = data.day_order[0];
    const firstDayRecords: any[] = data.days[firstDayKey].records;

    // Build one multi-row INSERT instead of N individual inserts
    const vals = firstDayRecords
      .map((rec, i) => `('${esc(rec.product)}', '${esc(rec.category)}', ${i})`)
      .join(',\n      ');
    await window.tasklet.sqlExec(
      `INSERT OR IGNORE INTO products (product, category, sort_order) VALUES\n      ${vals}`
    );
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function authenticate(username: string, password: string): Promise<User | null> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT id, username, role FROM users WHERE username='${esc(username)}' AND password='${esc(password)}'`
  );
  if (!rows.length) return null;
  const r = rows[0] as any;
  return { id: r.id, username: r.username, role: r.role };
}

// ─── User Management ──────────────────────────────────────────────────────────

export async function getUsers(): Promise<Array<{ id: number; username: string; role: string; created_at: string }>> {
  const rows = await window.tasklet.sqlQuery('SELECT id, username, role, created_at FROM users ORDER BY id');
  return rows as any[];
}

export async function createUser(username: string, password: string, role: string): Promise<void> {
  await window.tasklet.sqlExec(
    `INSERT INTO users (username, password, role) VALUES ('${esc(username)}', '${esc(password)}', '${esc(role)}')`
  );
}

export async function updatePassword(id: number, password: string): Promise<void> {
  await window.tasklet.sqlExec(`UPDATE users SET password='${esc(password)}' WHERE id=${id}`);
}

export async function deleteUser(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM users WHERE id=${id}`);
}

// ─── Products ─────────────────────────────────────────────────────────────────

export async function getProducts(): Promise<ProductDef[]> {
  const rows = await window.tasklet.sqlQuery(
    'SELECT product, category, sort_order FROM products ORDER BY sort_order'
  );
  return rows as any[];
}

// ─── Date Helpers ─────────────────────────────────────────────────────────────

export function fmtDate(d: Date): string {
  // Use local date parts (not UTC) so GMT+4 users see the correct date
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function prevDateStr(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return fmtDate(d);
}

function nextDateStr(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return fmtDate(d);
}

function isLastDayOfMonth(dateStr: string): boolean {
  const d = new Date(dateStr + 'T00:00:00');
  const next = new Date(d);
  next.setDate(d.getDate() + 1);
  return next.getMonth() !== d.getMonth();
}

function firstDayNextMonth(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return fmtDate(next);
}

// ─── Stock CRUD ───────────────────────────────────────────────────────────────

export async function getStockForDate(date: string, products: ProductDef[]): Promise<StockRecord[]> {
  // 1 SQL call to get existing records
  const rows = await window.tasklet.sqlQuery(
    `SELECT s.*, p.sort_order FROM stock s
     JOIN products p ON p.product = s.product
     WHERE s.date='${date}' ORDER BY p.sort_order`
  );

  // ── Check which products are missing (handles partial-seed from race conditions) ──
  const existingSet = new Set((rows as any[]).map((r: any) => r.product as string));
  const missingProducts = products.filter(p => !existingSet.has(p.product));

  if (missingProducts.length === 0 && rows.length > 0) {
    // All products present — return as-is
    return (rows as any[]).map(r => ({
      date: r.date,
      product: r.product,
      category: r.category,
      opening: Number(r.opening),
      recv_dubai: Number(r.recv_dubai),
      recv_umq: Number(r.recv_umq),
      dispatch: Number(r.dispatch),
      closing: Number(r.closing),
      updated_by: r.updated_by,
      updated_at: r.updated_at,
    }));
  }

  // ── Some or all products missing — find the most recent previous closing ──
  // Looks back to ANY previous date so skipped days / month / year boundaries are handled
  const prevRows = await window.tasklet.sqlQuery(
    `SELECT product, closing FROM stock
     WHERE date = (
       SELECT MAX(date) FROM stock WHERE date < '${date}'
     )`
  );
  const prevClosing: Record<string, number> = {};
  for (const r of prevRows as any[]) prevClosing[r.product] = Number(r.closing);

  // Build INSERT only for missing products
  if (missingProducts.length > 0) {
    const vals = missingProducts
      .map(p => {
        const opening = prevClosing[p.product] ?? 0;
        return `('${date}', '${esc(p.product)}', '${esc(p.category)}', ${opening}, 0, 0, 0, ${opening})`;
      })
      .join(',\n       ');
    await window.tasklet.sqlExec(
      `INSERT OR IGNORE INTO stock (date, product, category, opening, recv_dubai, recv_umq, dispatch, closing)
       VALUES\n       ${vals}`
    );
  }

  // ── Re-fetch all rows now that gaps are filled ──
  const allRows = await window.tasklet.sqlQuery(
    `SELECT s.*, p.sort_order FROM stock s
     JOIN products p ON p.product = s.product
     WHERE s.date='${date}' ORDER BY p.sort_order`
  );

  return (allRows as any[]).map(r => ({
    date: r.date,
    product: r.product,
    category: r.category,
    opening: Number(r.opening),
    recv_dubai: Number(r.recv_dubai),
    recv_umq: Number(r.recv_umq),
    dispatch: Number(r.dispatch),
    closing: Number(r.closing),
    updated_by: r.updated_by,
    updated_at: r.updated_at,
  }));
}

export async function saveStock(records: StockRecord[], updatedBy: string): Promise<void> {
  if (!records.length) return;
  const date = records[0].date;
  const now = new Date().toISOString();
  const u = esc(updatedBy);

  // ── Call 1: bulk INSERT OR REPLACE for current day ───────────────────────────
  const stockVals = records
    .map(rec =>
      `('${date}', '${esc(rec.product)}', '${esc(rec.category)}', ${rec.opening}, ${rec.recv_dubai}, ${rec.recv_umq}, ${rec.dispatch}, ${rec.closing}, '${u}', '${now}')`
    )
    .join(',\n    ');

  await window.tasklet.sqlExec(
    `INSERT OR REPLACE INTO stock (date, product, category, opening, recv_dubai, recv_umq, dispatch, closing, updated_by, updated_at)
    VALUES\n    ${stockVals}`
  );

  // ── Call 2: fetch ALL future records (any movement status) ────────────────────
  const inList = records.map(rec => `'${esc(rec.product)}'`).join(',');
  const futureRows = await window.tasklet.sqlQuery(
    `SELECT date, product, recv_dubai, recv_umq, dispatch
     FROM stock WHERE date > '${date}' AND product IN (${inList})
     ORDER BY date`
  ) as any[];

  if (!futureRows.length) return;

  // ── JS cascade: propagate closing → next day opening, re-calc closing ─────────
  // This correctly handles days WITH and WITHOUT movements in one pass.
  const prevClose: Record<string, number> = {};
  for (const rec of records) prevClose[rec.product] = rec.closing;

  // Group by date (already sorted)
  const dateGroups: Record<string, any[]> = {};
  for (const r of futureRows) {
    if (!dateGroups[r.date]) dateGroups[r.date] = [];
    dateGroups[r.date].push(r);
  }

  const updates: Array<{ date: string; product: string; opening: number; closing: number }> = [];
  for (const d of Object.keys(dateGroups).sort()) {
    for (const r of dateGroups[d]) {
      const newOpening = prevClose[r.product] ?? 0;
      const newClosing = newOpening + Number(r.recv_dubai) + Number(r.recv_umq) - Number(r.dispatch);
      prevClose[r.product] = newClosing;
      updates.push({ date: d, product: r.product, opening: newOpening, closing: newClosing });
    }
  }

  if (!updates.length) return;

  // ── Call 3: bulk cascade UPDATE — all future days in 1 statement ──────────────
  const openCases  = updates.map(upd => `WHEN date='${upd.date}' AND product='${esc(upd.product)}' THEN ${upd.opening}`).join(' ');
  const closeCases = updates.map(upd => `WHEN date='${upd.date}' AND product='${esc(upd.product)}' THEN ${upd.closing}`).join(' ');
  const dateIn     = [...new Set(updates.map(upd => `'${upd.date}'`))].join(',');

  await window.tasklet.sqlExec(
    `UPDATE stock SET
      opening = CASE ${openCases} ELSE opening END,
      closing = CASE ${closeCases} ELSE closing END
    WHERE date IN (${dateIn}) AND product IN (${inList})`
  );
}

export async function getDaysWithData(year: number, month: number): Promise<string[]> {
  const m = `${year}-${String(month).padStart(2, '0')}`;
  const rows = await window.tasklet.sqlQuery(
    `SELECT DISTINCT date FROM stock WHERE date LIKE '${m}-%' AND (recv_dubai>0 OR recv_umq>0 OR dispatch>0) ORDER BY date`
  );
  return (rows as any[]).map(r => r.date);
}

// ─── Monthly Aggregation ──────────────────────────────────────────────────────

export async function getMonthlyData(year: number, month: number): Promise<StockRecord[]> {
  const m = `${year}-${String(month).padStart(2, '0')}`;

  // hasData filter: ignore navigation-only zero rows when finding first/last real day
  const hasData = `(opening > 0 OR recv_dubai > 0 OR recv_umq > 0 OR dispatch > 0 OR closing > 0)`;

  // ── 1. Aggregate movements — LEFT JOIN ensures ALL products appear even with no stock rows ──
  const rows = await window.tasklet.sqlQuery(`
    SELECT p.product, p.category,
      COALESCE(SUM(s.recv_dubai), 0) as recv_dubai,
      COALESCE(SUM(s.recv_umq),   0) as recv_umq,
      COALESCE(SUM(s.dispatch),   0) as dispatch,
      COUNT(DISTINCT s.date) as days, p.sort_order
    FROM products p
    LEFT JOIN stock s ON s.product = p.product AND s.date LIKE '${m}-%'
    GROUP BY p.product, p.category ORDER BY p.sort_order
  `);
  if (!rows.length) return [];

  // ── 2. First & last day with REAL data (not navigation-only zero rows) ──
  const firstDateRow = await window.tasklet.sqlQuery(
    `SELECT MIN(date) as d FROM stock WHERE date LIKE '${m}-%' AND ${hasData}`
  );
  const lastDateRow = await window.tasklet.sqlQuery(
    `SELECT MAX(date) as d FROM stock WHERE date LIKE '${m}-%' AND ${hasData}`
  );
  const firstDay = (firstDateRow[0] as any)?.d as string | undefined;
  const lastDay  = (lastDateRow[0]  as any)?.d as string | undefined;

  // ── 3. Opening = from first real day; if product missing there, carry-forward from before month ──
  const openMap: Record<string, number> = {};
  const closeMap: Record<string, number> = {};

  if (firstDay) {
    const oRows = await window.tasklet.sqlQuery(`SELECT product, opening FROM stock WHERE date='${firstDay}'`);
    for (const r of oRows as any[]) openMap[r.product] = Number(r.opening);
  }

  // For any product not in openMap, look for its last known closing before this month
  const missingOpen = (rows as any[]).filter(r => openMap[r.product] === undefined).map((r: any) => `'${r.product.replace(/'/g,"''")}'`);
  if (missingOpen.length) {
    const fallbackRows = await window.tasklet.sqlQuery(
      `SELECT product, closing FROM stock
       WHERE date < '${m}-01' AND product IN (${missingOpen.join(',')})
       ORDER BY date DESC`
    );
    // Take the most recent closing per product
    for (const r of fallbackRows as any[]) {
      if (openMap[r.product] === undefined) openMap[r.product] = Number(r.closing);
    }
  }

  if (lastDay) {
    const cRows = await window.tasklet.sqlQuery(`SELECT product, closing FROM stock WHERE date='${lastDay}'`);
    for (const r of cRows as any[]) closeMap[r.product] = Number(r.closing);
  }

  return (rows as any[]).map(r => ({
    date: m,
    product: r.product,
    category: r.category,
    opening:    openMap[r.product]  ?? 0,
    recv_dubai: Number(r.recv_dubai),
    recv_umq:   Number(r.recv_umq),
    dispatch:   Number(r.dispatch),
    closing:    closeMap[r.product] ?? 0,
  }));
}

// ─── Yearly Aggregation ───────────────────────────────────────────────────────

export async function getYearlyData(year: number): Promise<MonthlyStat[]> {
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Monthly totals — 1 call
  const rows = await window.tasklet.sqlQuery(`
    SELECT substr(date,1,7) as month,
      SUM(recv_dubai) as recv_dubai, SUM(recv_umq) as recv_umq, SUM(dispatch) as dispatch,
      COUNT(DISTINCT date) as days
    FROM stock WHERE date LIKE '${year}-%'
    GROUP BY substr(date,1,7) ORDER BY month
  `);

  if (!rows.length) return [];

  // Last closing per month — uses last day with actual non-zero data
  const closingRows = await window.tasklet.sqlQuery(`
    SELECT substr(s.date,1,7) as month, SUM(s.closing) as last_closing
    FROM stock s
    WHERE s.date LIKE '${year}-%'
      AND s.date = (
        SELECT MAX(s2.date) FROM stock s2
        WHERE substr(s2.date,1,7)=substr(s.date,1,7)
          AND (s2.opening > 0 OR s2.recv_dubai > 0 OR s2.recv_umq > 0 OR s2.dispatch > 0 OR s2.closing > 0)
      )
    GROUP BY substr(s.date,1,7)
  `);
  const closingMap: Record<string, number> = {};
  for (const r of closingRows as any[]) closingMap[r.month] = Number(r.last_closing) || 0;

  return (rows as any[]).map(r => {
    const mNum = parseInt((r.month as string).split('-')[1]);
    return {
      month: r.month,
      label: `${MONTH_NAMES[mNum - 1]} ${year}`,
      total_recv_dubai: Number(r.recv_dubai) || 0,
      total_recv_umq: Number(r.recv_umq) || 0,
      total_recv: (Number(r.recv_dubai) || 0) + (Number(r.recv_umq) || 0),
      total_dispatch: Number(r.dispatch) || 0,
      last_closing: closingMap[r.month] ?? 0,
      days_entered: Number(r.days) || 0,
    };
  });
}

export async function getAvailableYears(): Promise<number[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT DISTINCT substr(date,1,4) as y FROM stock ORDER BY y DESC`
  );
  const years = (rows as any[]).map(r => Number(r.y)).filter(y => !isNaN(y));
  if (!years.length) years.push(new Date().getFullYear());
  return years;
}

// ─── Day Lock ─────────────────────────────────────────────────────────────────

export async function isDayLocked(date: string): Promise<boolean> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT 1 FROM locked_days WHERE date='${esc(date)}'`
  );
  return rows.length > 0;
}

export async function lockDay(date: string, username: string): Promise<void> {
  await window.tasklet.sqlExec(
    `INSERT OR REPLACE INTO locked_days (date, locked_by, locked_at)
     VALUES ('${esc(date)}', '${esc(username)}', datetime('now'))`
  );
}

export async function unlockDay(date: string): Promise<void> {
  await window.tasklet.sqlExec(
    `DELETE FROM locked_days WHERE date='${esc(date)}'`
  );
}
