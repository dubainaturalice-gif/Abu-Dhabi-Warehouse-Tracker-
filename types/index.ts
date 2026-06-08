export interface User {
  id: number;
  username: string;
  role: 'admin' | 'employee';
}

export interface Product {
  id: number;
  name: string;
  category: string;
  sort_order: number;
}

export interface StockRecord {
  id?: number;
  product_id: number;
  product_name: string;
  category: string;
  sort_order: number;
  date: string;
  opening: number;
  recv_dubai: number;
  recv_umq: number;
  dispatch: number;
  closing: number;
}

export interface MonthlyProductSummary {
  product_id: number;
  product_name: string;
  category: string;
  sort_order: number;
  opening: number;
  total_recv_dubai: number;
  total_recv_umq: number;
  total_dispatch: number;
  closing: number;
}

export interface YearlyMonthSummary {
  month: number;
  month_name: string;
  total_recv_dubai: number;
  total_recv_umq: number;
  total_dispatch: number;
  opening: number;
  closing: number;
  days_with_data: number;
}
