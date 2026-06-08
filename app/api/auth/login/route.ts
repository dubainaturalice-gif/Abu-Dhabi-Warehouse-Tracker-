import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/supabase';
import { signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });

    const { data: users, error } = await supabase
      .from('app_users')
      .select('id, username, password_hash, role')
      .eq('username', username)
      .limit(1);

    if (error || !users?.length) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

    const user = users[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

    const payload = { id: user.id, username: user.username, role: user.role as 'admin' | 'employee' };
    const token = await signToken(payload);

    return NextResponse.json({ user: payload, token });
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
