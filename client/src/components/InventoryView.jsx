import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { usePos } from '../context/PosContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import StockModal from './StockModal.jsx';
import ProductModal from './ProductModal.jsx';

const STATUS = { ok: ['pill-ok', 'In stock'], low: ['pill-low', 'Low'], out: ['pill-out', 'Out'] };

export default function InventoryView() {
  const { user } = useAuth();
  const { money, catOf, refreshProducts } = usePos();
  const toast = useToast();
  const isAdmin = user.role === 'admin';

  const [inv, setInv] = useState({ data: [], summary: { products: 0, units: 0, low: 0, out: 0 } });
  const [status, setStatus] = useState({ loading: true, error: '' });
  const [stockFor, setStockFor] = useState(null);
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new product, object = edit

  const load = useCallback(async () => {
    setStatus({ loading: true, error: '' });
    try {
      setInv(await api.getInventory());
      setStatus({ loading: false, error: '' });
    } catch (e) {
      setStatus({ loading: false, error: e.message });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const changed = async (msg) => { toast(msg); await Promise.all([load(), refreshProducts()]); };
  const { data, summary } = inv;
  const { loading, error } = status;

  return (
    <section className="view" id="view-inventory">
      <div className="view-head">
        <div>
          <h2>Inventory</h2>
          <p className="muted">{loading ? 'Loading…' : `${summary.products} product${summary.products === 1 ? '' : 's'} on the menu`}</p>
        </div>
        {isAdmin && (
          <div className="actions">
            <button className="btn btn-mint" onClick={() => setEditing(null)}>Add product</button>
          </div>
        )}
      </div>

      <div className="stats">
        <div className="stat" style={{ background: 'var(--lilac)' }}><b>{summary.products}</b><span>Products</span></div>
        <div className="stat" style={{ background: 'var(--sky)' }}><b>{summary.units}</b><span>Units in stock</span></div>
        <div className="stat" style={{ background: 'var(--butter)' }}><b>{summary.low}</b><span>Running low</span></div>
        <div className="stat" style={{ background: 'var(--rose)' }}><b>{summary.out}</b><span>Sold out</span></div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th>{isAdmin && <th></th>}</tr>
          </thead>
          <tbody id="inventoryTable">
            {data.length ? (
              data.map((p) => {
                const [cls, label] = STATUS[p.stockStatus];
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="cell-product">
                        <span className="cell-icon" style={{ background: catOf(p.category).color }}>{p.icon}</span>
                        <strong>{p.name}</strong>
                      </div>
                    </td>
                    <td>{catOf(p.category).name}</td>
                    <td>{money(p.price)}</td>
                    <td>{p.trackStock ? <strong>{p.stock}</strong> : <span className="muted">Not tracked</span>}</td>
                    <td><span className={`pill ${cls}`}>{label}</span></td>
                    {isAdmin && (
                      <td>
                        {p.trackStock && <button className="link-btn" onClick={() => setStockFor(p)}>Adjust stock</button>}
                        {p.trackStock && ' · '}
                        <button className="link-btn" onClick={() => setEditing(p)}>Edit</button>
                      </td>
                    )}
                  </tr>
                );
              })
            ) : (
              <tr><td colSpan={isAdmin ? 6 : 5}>
                {error ? (
                  <div className="empty"><span className="empty-ico">⚠️</span>{error}<br /><button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={load}>Try again</button></div>
                ) : loading ? (
                  <div className="empty"><span className="empty-ico">⏳</span>Loading inventory…</div>
                ) : (
                  <div className="empty"><span className="empty-ico">📦</span>No products yet.</div>
                )}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {stockFor && (
        <StockModal product={stockFor} onClose={() => setStockFor(null)}
          onSaved={(p) => { setStockFor(null); changed(`${p.name}: ${p.stock} in stock`); }} />
      )}
      {editing !== undefined && (
        <ProductModal product={editing} onClose={() => setEditing(undefined)}
          onSaved={(p, wasEdit) => { setEditing(undefined); changed(wasEdit ? `${p.name} updated` : `${p.name} added`); }} />
      )}
    </section>
  );
}
