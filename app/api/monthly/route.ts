import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { authFromRequest } from '@/lib/auth';

// GET /api/monthly?year=YYYY&month=MM
export async function GET(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const year  = req.nextUrl.searchParams.get('year');
  const month = req.nextUrl.searchParams.get('month');
  if (!year || !month) return NextResponse.json({ error: 'year and month required' }, { status: 400 });

  const monthStr = `${year}-${month.padStart(2,'0')}`;
  const firstDay = `${monthStr}-01`;
  const lastDay  = `${monthStr}-31`; // Supabase will cap to actual last day

  // Get all products
  const { data: products } = await supabase.from('products').select('*').order('sort_order');
  if (!products?.length) return NextResponse.json([]);

  // Get all stock rows for this month
  const { data: rows } = await supabase
    .from('stock')
    .select('product_id, date, opening, recv_dubai, recv_umq, dispatch, closing')
    .gte('date', firstDay)
    .lte('date', lastDay)
    .order('date', { ascending: true });

  // Group by product
  const byProduct: Record<number, typeof rows> = {};
  for (const r of (rows || [])) {
    if (!byProduct[r.product_id]) byProduct[r.product_id] = [];
    byProduct[r.product_id]!.push(r);
  }

  // Find first real opening per product (value > 0)
  const prevCloseMap: Record<number, number> = {};
  const productIds = products.map(p => p.id);
  const { data: prevRows } = await supabase
    .from('stock')
    .select('product_id, closing, date')
    .in('product_id', productIds)
    .lt('date', firstDay)
    .order('date', { ascending: false });

  for (const r of (prevRows || [])) {
    if (prevCloseMap[r.product_id] === undefined) prevCloseMap[r.product_id] = r.closing;
  }

  const result = products.map(p => {
    const pRows = byProduct[p.id] || [];
    let opening = 0;
    // First real opening (value > 0)
    const firstReal = pRows.find(r => r.opening > 0);
    if (firstReal) opening = firstReal.opening;
    else if (prevCloseMap[p.id] !== undefined) opening = prevCloseMap[p.id];

    const total_recv_dubai = pRows.reduce((s, r) => s + r.recv_dubai, 0);
    const total_recv_umq   = pRows.reduce((s, r) => s + r.recv_umq,   0);
    const total_dispatch   = pRows.reduce((s, r) => s + r.dispatch,   0);

    // Closing = last day's closing
    const lastRow = pRows.length ? pRows[pRows.length - 1] : null;
    const closing = lastRow?.closing ?? opening;

    return {
      product_id: p.id, product_name: p.name,
      category: p.category, sort_order: p.sort_order,
      opening, total_recv_dubai, total_recv_umq, total_dispatch, closing,
    };
  });

  return NextResponse.json(result);
}
