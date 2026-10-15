import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/index.js';
import { makeMoney } from '../utils/format.js';
import { useAuth } from './AuthContext.jsx';

// Shop settings (name, tax, currency, categories) + the product list. Replaces data.js.
const PosContext = createContext(null);
export const usePos = () => useContext(PosContext);

export function PosProvider({ children }) {
  const { logout } = useAuth();
  const [settings, setSettings] = useState(null);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [s, p] = await Promise.all([api.getSettings(), api.getProducts()]);
      setSettings(s);
      setProducts(p.data);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const refreshProducts = useCallback(async () => {
    try { setProducts((await api.getProducts()).data); } catch { /* keep what we have */ }
  }, []);
    // Re-read shop settings (e.g. another till changed the tax rate)
  const refreshSettings = useCallback(async () => {
    try { setSettings(await api.getSettings()); } catch { /* keep what we have */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const value = useMemo(() => {
    if (!settings) return null;
    return {
      settings,
      products,
      money: makeMoney(settings.currency),
      catOf: (id) => settings.categories.find((c) => c.id === id) || { id, name: id, color: 'var(--lilac)' },
      productOf: (id) => products.find((p) => p.id === id),
      refreshProducts,
      refreshSettings,
      applySettings: setSettings, // the Settings screen hands over the server's reply after a save
    };
  }, [settings, products, refreshProducts, refreshSettings]);

  if (!value) {
    return (
      <section className="login">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <span className="logo-mark" aria-hidden="true">🌸</span>
          {error ? (
            <>
              <p className="login-error" role="alert" style={{ margin: '14px 0' }}>{error}</p>
              <div className="btn-row">
                <button className="btn btn-ghost" onClick={logout}>Log out</button>
                <button className="btn btn-primary" onClick={load}>Try again</button>
              </div>
            </>
          ) : (
            <p className="muted" style={{ marginTop: 12 }}>Opening the till…</p>
          )}
        </div>
      </section>
    );
  }
  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
}
