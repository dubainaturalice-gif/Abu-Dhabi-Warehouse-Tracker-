export interface User {
  id: number;
  username: string;
  role: 'admin' | 'employee';
}

export interface StockRecord {
  date: string;        // YYYY-MM-DD
  product: string;
  category: string;
  opening: number;
  recv_dubai: number;
  recv_umq: number;
  dispatch: number;
  closing: number;
  updated_by?: string;
  updated_at?: string;
}

export interface ProductDef {
  product: string;
  category: string;
  sort_order: number;
}

export interface MonthlyStat {
  month: string;       // YYYY-MM
  label: string;
  total_recv_dubai: number;
  total_recv_umq: number;
  total_recv: number;
  total_dispatch: number;
  last_closing: number;
  days_entered: number;
}

export type View = 'daily' | 'monthly' | 'yearly' | 'users';
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
