import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { authFromRequest } from '@/lib/auth';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// GET /api/yearly?year=YYYY
export async function GET(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const year = req.nextUrl.searchParams.get('year');
  if (!year) return NextResponse.json({ error: 'year required' }, { status: 400 });

  const { data: rows } = await supabase
    .from('stock')
    .select('product_id, date, opening, recv_dubai, recv_umq, dispatch, closing')
    .gte('date', `${year}-01-01`)
    .lte('date', `${year}-12-31`)
    .order('date', { ascending: true });

  const monthly: Record<number, {
    total_recv_dubai: number; total_recv_umq: number; total_dispatch: number;
    opening: number; closing: number; days: Set<string>;
    firstOpen: number | null; lastClose: number | null;
  }> = {};

  for (let m = 1; m <= 12; m++) {
    monthly[m] = { total_recv_dubai: 0, total_recv_umq: 0, total_dispatch: 0, opening: 0, closing: 0, days: new Set(), firstOpen: null, lastClose: null };
  }

  for (const r of (rows || [])) {
    const m = parseInt(r.date.split('-')[1], 10);
    const mo = monthly[m];
    mo.total_recv_dubai += r.recv_dubai;
    mo.total_recv_umq   += r.recv_umq;
    mo.total_dispatch   += r.dispatch;
    mo.days.add(r.date);
    if (r.opening > 0 && mo.firstOpen === null) mo.firstOpen = r.opening;
    mo.lastClose = r.closing;
  }

  const result = Array.from({length: 12}, (_, i) => {
    const m  = i + 1;
    const mo = monthly[m];
    return {
      month:      m,
      month_name: MONTH_NAMES[i],
      total_recv_dubai:  mo.total_recv_dubai,
      total_recv_umq:    mo.total_recv_umq,
      total_dispatch:    mo.total_dispatch,
      opening:    mo.firstOpen ?? 0,
      closing:    mo.lastClose ?? 0,
      days_with_data: mo.days.size,
    };
  });

  return NextResponse.json(result);
}
