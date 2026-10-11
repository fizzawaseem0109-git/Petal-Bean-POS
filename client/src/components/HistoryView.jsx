import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/index.js';
import { usePos } from '../context/PosContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { fmtDate, plural } from '../utils/format.js';
import { exportSales } from '../utils/exports.js';

const PAGE = 50;

export default function HistoryView({ onViewReceipt }) {
  const { settings, money } = usePos();
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState({ bills: 0, revenue: 0, cash: 0, card: 0 });
  const [status, setStatus] = useState({ loading: true, error: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus({ loading: true, error: '' });
    try {
      const [list, sum] = await Promise.all([api.getOrders({ page: 1, limit: PAGE }), api.getSalesSummary()]);
      setOrders(list.data);
      setTotal(list.total);
      setPage(1);
      setSummary(sum);
      setStatus({ loading: false, error: '' });
    } catch (e) {
      setStatus({ loading: false, error: e.message });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    setBusy(true);
    try {
      const r = await api.getOrders({ page: page + 1, limit: PAGE });
      setOrders((o) => [...o, ...r.data]);
      setPage(page + 1);
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };

  const doExport = async (type) => {
    if (!total) return toast('No sales to export yet');
    setBusy(true);
    try {
      const all = (await api.getOrders({ all: 'true' })).data;
      await exportSales(type, all, settings);
      toast(`Sales history exported as ${type.toUpperCase()}`);
    } catch (e) {
      toast(e.message || 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  const { loading, error } = status;
  const n = summary.bills;

  return (
    <section className="view" id="view-history">
      <div className="view-head">
        <div>
          <h2>Sales history</h2>
          <p className="muted" id="salesCount">{n ? plural(n, 'bill') : loading ? 'Loading…' : 'No sales yet'}</p>
        </div>
        <div className="actions">
          <button className="btn btn-mint" id="salesCsvBtn" disabled={busy || loading} onClick={() => doExport('csv')}>Export CSV</button>
          <button className="btn btn-peach" id="salesPdfBtn" disabled={busy || loading} onClick={() => doExport('pdf')}>Export PDF</button>
        </div>
      </div>

      <div className="stats" id="stats">
        <div className="stat" style={{ background: 'var(--lilac)' }}><b>{n}</b><span>Bills</span></div>
        <div className="stat" style={{ background: 'var(--peach)' }}><b>{money(summary.revenue)}</b><span>Total sales</span></div>
        <div className="stat" style={{ background: 'var(--mint)' }}><b>{money(summary.cash)}</b><span>Cash</span></div>
        <div className="stat" style={{ background: 'var(--sky)' }}><b>{money(summary.card)}</b><span>Card</span></div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Bill no.</th><th>Date</th><th>Customer</th><th>Items</th><th>Payment</th><th>Total</th><th></th></tr>
          </thead>
          <tbody id="salesTable">
            {orders.length ? (
              orders.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.billNo}</strong></td>
                  <td>{fmtDate(s.date)}</td>
                  <td>{s.customer}</td>
                  <td>{s.items.reduce((a, i) => a + i.qty, 0)}</td>
                  <td><span className={`pill ${s.method === 'Cash' ? 'pill-cash' : 'pill-card'}`}>{s.method}</span></td>
                  <td><strong>{money(s.total)}</strong></td>
                  <td><button className="link-btn" onClick={() => onViewReceipt(s)}>View receipt</button></td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="7">
                {error ? (
                  <div className="empty"><span className="empty-ico">⚠️</span>{error}<br /><button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={load}>Try again</button></div>
                ) : loading ? (
                  <div className="empty"><span className="empty-ico">⏳</span>Loading sales…</div>
                ) : (
                  <div className="empty"><span className="empty-ico">🧾</span>Completed bills appear here. Go to Sell to create one.</div>
                )}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {orders.length < total && (
        <div className="load-more">
          <button className="btn btn-ghost" disabled={busy} onClick={loadMore}>Load more ({total - orders.length} older)</button>
        </div>
      )}
    </section>
  );
}
