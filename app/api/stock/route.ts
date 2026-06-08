import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { authFromRequest } from '@/lib/auth';
import { StockRecord } from '@/types';

// GET /api/stock?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const date = req.nextUrl.searchParams.get('date');
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 });

  // Get all products
  const { data: products } = await supabase
    .from('products').select('*').order('sort_order');
  if (!products?.length) return NextResponse.json([]);

  // Get existing stock rows for this date
  const { data: rows } = await supabase
    .from('stock')
    .select('*, products(name, category, sort_order)')
    .eq('date', date);

  const existingMap = new Map((rows || []).map(r => [r.product_id, r]));
  const missing = products.filter(p => !existingMap.has(p.id));

  if (missing.length > 0) {
    // Find carry-forward closings
    const { data: prevRows } = await supabase
      .from('stock')
      .select('product_id, closing, date')
      .in('product_id', missing.map(p => p.id))
      .lt('date', date)
      .order('date', { ascending: false });

    const prevClose: Record<number, number> = {};
    for (const r of (prevRows || [])) {
      if (prevClose[r.product_id] === undefined) prevClose[r.product_id] = r.closing;
    }

    const inserts = missing.map(p => ({
      product_id: p.id,
      date,
      opening: prevClose[p.id] ?? 0,
      recv_dubai: 0, recv_umq: 0, dispatch: 0,
      closing: prevClose[p.id] ?? 0,
    }));

    if (inserts.length) {
      const { data: inserted } = await supabase.from('stock').insert(inserts).select('*, products(name, category, sort_order)');
      for (const r of (inserted || [])) existingMap.set(r.product_id, r);
    }
  }

  // Build result
  const result: StockRecord[] = products.map(p => {
    const r = existingMap.get(p.id);
    return {
      id: r?.id,
      product_id: p.id,
      product_name: p.name,
      category: p.category,
      sort_order: p.sort_order,
      date,
      opening:    r?.opening    ?? 0,
      recv_dubai: r?.recv_dubai ?? 0,
      recv_umq:   r?.recv_umq   ?? 0,
      dispatch:   r?.dispatch   ?? 0,
      closing:    r?.closing    ?? 0,
    };
  });

  return NextResponse.json(result);
}

// POST /api/stock  body: { date, records: StockRecord[], username }
export async function POST(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { date, records }: { date: string; records: StockRecord[] } = await req.json();
  if (!date || !records?.length) return NextResponse.json({ error: 'Missing data' }, { status: 400 });

  const now = new Date().toISOString();

  // Upsert records for this date
  const upserts = records.map(rec => ({
    product_id: rec.product_id,
    date,
    opening:    rec.opening,
    recv_dubai: rec.recv_dubai,
    recv_umq:   rec.recv_umq,
    dispatch:   rec.dispatch,
    closing:    rec.closing,
    updated_by: user.username,
    updated_at: now,
  }));

  await supabase.from('stock').upsert(upserts, { onConflict: 'product_id,date' });

  // ── Cascade: update all future days ──
  const productIds = records.map(r => r.product_id);

  const { data: futureRows } = await supabase
    .from('stock')
    .select('id, product_id, date, recv_dubai, recv_umq, dispatch')
    .in('product_id', productIds)
    .gt('date', date)
    .order('date', { ascending: true });

  if (futureRows?.length) {
    // Build prev closing map from saved records
    const prevClose: Record<number, number> = {};
    for (const r of records) prevClose[r.product_id] = r.closing;

    // Group future rows by date
    const byDate: Record<string, typeof futureRows> = {};
    for (const r of futureRows) {
      if (!byDate[r.date]) byDate[r.date] = [];
      byDate[r.date].push(r);
    }

    const cascadeUpdates: Array<{ id: number; opening: number; closing: number }> = [];

    for (const d of Object.keys(byDate).sort()) {
      for (const r of byDate[d]) {
        const newOpening = prevClose[r.product_id] ?? 0;
        const newClosing = newOpening + r.recv_dubai + r.recv_umq - r.dispatch;
        prevClose[r.product_id] = newClosing;
        cascadeUpdates.push({ id: r.id, opening: newOpening, closing: newClosing });
      }
    }

    // Batch update in chunks of 50
    const CHUNK = 50;
    for (let i = 0; i < cascadeUpdates.length; i += CHUNK) {
      const chunk = cascadeUpdates.slice(i, i + CHUNK);
      await Promise.all(chunk.map(u =>
        supabase.from('stock').update({ opening: u.opening, closing: u.closing }).eq('id', u.id)
      ));
    }
  }

  return NextResponse.json({ ok: true });
}
