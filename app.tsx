import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { User, View, ProductDef } from './types';
import { initDB, getProducts } from './utils/db';
import { Login } from './components/Login';
import { Sidebar } from './components/Sidebar';
import { DailyEntry } from './components/DailyEntry';
import { MonthlySummary } from './components/MonthlySummary';
import { YearlySummary } from './components/YearlySummary';
import { UserManagement } from './components/UserManagement';

const App: React.FC = () => {
  const [ready, setReady]     = useState(false);
  const [initErr, setInitErr] = useState('');
  const [user, setUser]       = useState<User | null>(null);
  const [view, setView]       = useState<View>('daily');
  const [products, setProducts] = useState<ProductDef[]>([]);

  useEffect(() => {
    (async () => {
      try {
        await initDB();
        const prods = await getProducts();
        setProducts(prods);
        setReady(true);
      } catch (e: any) {
        console.error('Init failed:', e);
        setInitErr(String(e?.message ?? 'Initialization failed'));
      }
    })();
  }, []);

  const handleLogin = (u: User) => {
    setUser(u);
    setView('daily');
  };

  const handleLogout = () => {
    setUser(null);
  };

  // Loading screen
  if (!ready) {
    return (
      <div className="min-h-screen bg-base-100 flex flex-col items-center justify-center gap-4">
        {initErr ? (
          <div className="alert alert-error max-w-sm">
            <span className="text-sm">{initErr}</span>
          </div>
        ) : (
          <>
            <span className="loading loading-spinner loading-lg text-primary" />
            <p className="text-sm text-base-content/50">Initializing database…</p>
          </>
        )}
      </div>
    );
  }

  // Login screen
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // Main app
  return (
    <div className="flex h-screen bg-base-100 overflow-hidden">
      <Sidebar
        user={user}
        currentView={view}
        onViewChange={setView}
        onLogout={handleLogout}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        {view === 'daily'   && <DailyEntry user={user} products={products} />}
        {view === 'monthly' && <MonthlySummary />}
        {view === 'yearly'  && <YearlySummary />}
        {view === 'users' && user.role === 'admin' && <UserManagement />}
        {view === 'users' && user.role !== 'admin' && (
          <div className="flex-1 flex items-center justify-center text-base-content/30 text-sm">
            Admin access required.
          </div>
        )}
      </main>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<App />);
