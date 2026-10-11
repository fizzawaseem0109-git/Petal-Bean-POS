import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/index.js';
import { usePos } from '../context/PosContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { fmtDate, plural } from '../utils/format.js';
import { exportCustomers } from '../utils/exports.js';

export default function CustomersView() {
  const { settings, money } = usePos();
  const toast = useToast();
  const [state, setState] = useState({ loading: true, error: '', data: [], total: 0 });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const r = await api.getCustomers();
      setState({ loading: false, error: '', data: r.data, total: r.total });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.message }));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const { data, total, loading, error } = state;

  const doExport = async (type) => {
    if (!total) return toast('No customers to export yet');
    setBusy(true);
    try {
      const all = (await api.getCustomers({ limit: 5000 })).data;
      await exportCustomers(type, all, settings);
      toast(`Customers exported as ${type.toUpperCase()}`);
    } catch (e) {
      toast(e.message || 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="view" id="view-customers">
      <div className="view-head">
        <div>
          <h2>Customers</h2>
          <p className="muted" id="customerCount">{total ? plural(total, 'customer') : loading ? 'Loading…' : 'No customers yet'}</p>
        </div>
        <div className="actions">
          <button className="btn btn-mint" id="custCsvBtn" disabled={busy || loading} onClick={() => doExport('csv')}>Export CSV</button>
          <button className="btn btn-peach" id="custPdfBtn" disabled={busy || loading} onClick={() => doExport('pdf')}>Export PDF</button>
        </div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Phone</th><th>Orders</th><th>Total spent</th><th>Last visit</th></tr>
          </thead>
          <tbody id="customerTable">
            {data.length ? (
              data.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.phone}</td>
                  <td>{c.orders}</td>
                  <td>{money(c.totalSpent)}</td>
                  <td>{fmtDate(c.lastVisit)}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="5">
                {error ? (
                  <div className="empty"><span className="empty-ico">⚠️</span>{error}<br /><button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={load}>Try again</button></div>
                ) : loading ? (
                  <div className="empty"><span className="empty-ico">⏳</span>Loading customers…</div>
                ) : (
                  <div className="empty"><span className="empty-ico">👥</span>Customers appear here after their first bill.</div>
                )}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
