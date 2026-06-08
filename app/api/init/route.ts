import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/supabase';

const PRODUCTS = [
  { name: '1 KG TUBE',        category: 'ICE PRODUCTS — FROM DUBAI', sort_order: 0 },
  { name: '2 KG TUBE',        category: 'ICE PRODUCTS — FROM DUBAI', sort_order: 1 },
  { name: '10 KG CRUSH',      category: 'ICE PRODUCTS — FROM DUBAI', sort_order: 2 },
  { name: '10 KG TUBE',       category: 'ICE PRODUCTS — FROM DUBAI', sort_order: 3 },
  { name: '10 KG HOSHIZAKI',  category: 'ICE PRODUCTS — FROM DUBAI', sort_order: 4 },
  { name: '10 KG SOLID ICE',  category: 'ICE PRODUCTS — FROM DUBAI', sort_order: 5 },
  { name: '10 KG TOKYO ICE',  category: 'ICE PRODUCTS — FROM DUBAI', sort_order: 6 },
  { name: '25 KG CRUSH',      category: 'ICE PRODUCTS — FROM DUBAI', sort_order: 7 },
  { name: 'POOL ICE BLOCK',   category: 'ICE PRODUCTS — FROM DUBAI', sort_order: 8 },
  { name: 'SMALL ICE BLOCK',  category: 'ICE PRODUCTS — FROM DUBAI', sort_order: 9 },
  { name: 'LONG ICE BLOCK',   category: 'ICE PRODUCTS — FROM DUBAI', sort_order: 10 },
  { name: 'DRY ICE',          category: 'ICE PRODUCTS — FROM DUBAI', sort_order: 11 },
  { name: 'ICE CUP',          category: 'ICE PRODUCTS — FROM DUBAI', sort_order: 12 },
  { name: 'JELAT STRAWBERRY', category: 'JELAT ICE CREAM',           sort_order: 13 },
  { name: 'JELAT MANGO',      category: 'JELAT ICE CREAM',           sort_order: 14 },
  { name: 'JELAT PISTACHIO',  category: 'JELAT ICE CREAM',           sort_order: 15 },
  { name: 'JELAT VANILLA',    category: 'JELAT ICE CREAM',           sort_order: 16 },
  { name: 'JELAT CHOCOLATE',  category: 'JELAT ICE CREAM',           sort_order: 17 },
  { name: 'JELAT CARAMEL',    category: 'JELAT ICE CREAM',           sort_order: 18 },
  { name: 'ICE POP PINEAPPLE',  category: 'ICE POP',                 sort_order: 19 },
  { name: 'ICE POP ORANGE',     category: 'ICE POP',                 sort_order: 20 },
  { name: 'ICE POP MANGO',      category: 'ICE POP',                 sort_order: 21 },
  { name: 'ICE POP STRAWBERRY', category: 'ICE POP',                 sort_order: 22 },
];

export async function POST(req: NextRequest) {
  try {
    // Seed products
    for (const p of PRODUCTS) {
      await supabase.from('products').upsert(p, { onConflict: 'name' });
    }

    // Seed default users
    const adminHash = await bcrypt.hash('admin123', 10);
    const empHash   = await bcrypt.hash('emp123', 10);

    await supabase.from('app_users').upsert(
      { username: 'admin',      password_hash: adminHash, role: 'admin' },
      { onConflict: 'username' }
    );
    await supabase.from('app_users').upsert(
      { username: 'employee01', password_hash: empHash,   role: 'employee' },
      { onConflict: 'username' }
    );

    return NextResponse.json({ ok: true, message: 'Database initialised successfully' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
