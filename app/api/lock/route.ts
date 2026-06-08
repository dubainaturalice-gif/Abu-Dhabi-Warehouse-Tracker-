import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { authFromRequest } from '@/lib/auth';

// GET /api/lock?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const date = req.nextUrl.searchParams.get('date');
  if (!date) return NextResponse.json({ locked: false });
  const { data } = await supabase.from('locked_days').select('id, locked_by, locked_at').eq('date', date).maybeSingle();
  return NextResponse.json({ locked: !!data, info: data });
}

// POST /api/lock  { date }
export async function POST(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const { date } = await req.json();
  await supabase.from('locked_days').upsert({ date, locked_by: user.username, locked_at: new Date().toISOString() }, { onConflict: 'date' });
  return NextResponse.json({ ok: true });
}

// DELETE /api/lock?date=YYYY-MM-DD  (admin only)
export async function DELETE(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  const date = req.nextUrl.searchParams.get('date');
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 });
  await supabase.from('locked_days').delete().eq('date', date);
  return NextResponse.json({ ok: true });
}
