import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/supabase';
import { authFromRequest } from '@/lib/auth';

// GET /api/users  (admin only)
export async function GET(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  const { data } = await supabase.from('app_users').select('id, username, role, created_at').order('id');
  return NextResponse.json(data || []);
}

// POST /api/users  { username, password, role }  (admin only)
export async function POST(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  const { username, password, role } = await req.json();
  if (!username || !password || !role) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  const hash = await bcrypt.hash(password, 10);
  const { error } = await supabase.from('app_users').insert({ username, password_hash: hash, role });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// PUT /api/users  { id, password }  (admin only)
export async function PUT(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  const { id, password } = await req.json();
  if (!id || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  const hash = await bcrypt.hash(password, 10);
  await supabase.from('app_users').update({ password_hash: hash }).eq('id', id);
  return NextResponse.json({ ok: true });
}

// DELETE /api/users?id=X  (admin only)
export async function DELETE(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await supabase.from('app_users').delete().eq('id', id);
  return NextResponse.json({ ok: true });
}
