-- =====================================================
-- ABU DHABI WAREHOUSE TRACKER — Supabase Schema
-- Run this in Supabase > SQL Editor
-- =====================================================

-- 1. Products
CREATE TABLE IF NOT EXISTS products (
  id         SERIAL PRIMARY KEY,
  name       TEXT UNIQUE NOT NULL,
  category   TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- 2. Stock movements
CREATE TABLE IF NOT EXISTS stock (
  id          SERIAL PRIMARY KEY,
  product_id  INTEGER REFERENCES products(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  opening     INTEGER NOT NULL DEFAULT 0,
  recv_dubai  INTEGER NOT NULL DEFAULT 0,
  recv_umq    INTEGER NOT NULL DEFAULT 0,
  dispatch    INTEGER NOT NULL DEFAULT 0,
  closing     INTEGER NOT NULL DEFAULT 0,
  updated_by  TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, date)
);

-- 3. Custom users (NOT Supabase Auth)
CREATE TABLE IF NOT EXISTS app_users (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin','employee')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Locked days
CREATE TABLE IF NOT EXISTS locked_days (
  id        SERIAL PRIMARY KEY,
  date      DATE UNIQUE NOT NULL,
  locked_by TEXT,
  locked_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stock_date       ON stock(date);
CREATE INDEX IF NOT EXISTS idx_stock_product_id ON stock(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_pd_date    ON stock(product_id, date);

-- 6. Disable RLS (we use service role key server-side)
ALTER TABLE products    DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock       DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_users   DISABLE ROW LEVEL SECURITY;
ALTER TABLE locked_days DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- After running schema, go to your app URL and call:
-- POST /api/init
-- This seeds products and default users automatically.
-- =====================================================
