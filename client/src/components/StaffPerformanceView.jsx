import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/index.js';
import { usePos } from '../context/PosContext.jsx';
import { fmtDate, plural } from '../utils/format.js';

const PAGE = 25;
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return dayKey(d); };
// Dates are picked in the browser's local time; send whole local days to the server as exact instants.
const startOfDay = (s) => (s ? new Date(`${s}T00:00:00`).toISOString() : undefined);
const endOfDay = (s) => (s ? new Date(`${s}T23:59:59.999`).toISOString() : undefined);

export default function StaffPerformanceView({ onViewReceipt }) {
  const { money } = usePos();
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(dayKey(new Date()));
  const [report, setReport] = useState({ data: [], totals: null });
  const [status, setStatus] = useState({ loading: true, error: '' });
  const [who, setWho] = useState(null); // staff row whose individual sales are open
  const [sales, setSales] = useState({ loading: false, error: '', data: [], total: 0, page: 1, summary: null });
  const reqId = useRef(0); // ignore answers that arrive after the filters changed

  const rangeError = from && to && from > to ? 'The start date must be on or before the end date.' : '';
  const range = () => ({ from: startOfDay(from), to: endOfDay(to) });

  const load = useCallback(async () => {
    if (rangeError) return;
    const mine = ++reqId.current;
    setStatus({ loading: true, error: '' });
    try {
      const r = await api.getStaffReport({ from: startOfDay(from), to: endOfDay(to) });
      if (mine !== reqId.current) return;
      setReport(r);
      setStatus({ loading: false, error: '' });
    } catch (e) {
      if (mine === reqId.current) setStatus({ loading: false, error: e.message });
    }
  }, [from, to, rangeError]);
  useEffect(() => { load(); }, [load]);

  const loadSales = useCallback(async (staff, page = 1) => {
    setSales((s) => ({ ...s, loading: true, error: '', ...(page === 1 ? { data: [], total: 0 } : {}) }));
    try {
      const r = await api.getStaffSales(staff.id, { page, limit: PAGE, ...range() });
      setSales((s) => ({ loading: false, error: '', data: page === 1 ? r.data : [...s.data, ...r.data], total: r.total, page, summary: r.summary }));
    } catch (e) {
      setSales((s) => ({ ...s, loading: false, error: e.message }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  // the open sales list follows the date filters
  useEffect(() => { if (who && !rangeError) loadSales(who, 1); }, [who, loadSales, rangeError]);

  const preset = (days) => { setFrom(days === null ? '' : daysAgo(days)); setTo(days === null ? '' : dayKey(new Date())); };
  const { loading, error } = status;
  const { data, totals } = report;
  const who$ = (s) => s.name || s.email || '—';
  const customersCell = (s) => (s.customers === null ? <span className="muted" title="These bills have no customer link">—</span> : (
    <span title={s.customersPartial ? 'Some bills have no customer link, so this may be low' : undefined}>{s.customers}{s.customersPartial ? '+' : ''}</span>
  ));

  return (
    <section className="view" id="view-performance">
      <div className="view-head">
        <div>
          <h2>Staff performance</h2>
          <p className="muted">{totals ? `${plural(totals.bills, 'completed bill')} in this period` : loading ? 'Loading…' : ''}</p>
        </div>
      </div>

      <div className="report-filters">
        <label className="field"><span>From</span><input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="field"><span>To</span><input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
        <div className="report-presets">
          <button className="btn btn-sm btn-ghost" onClick={() => preset(0)}>Today</button>
          <button className="btn btn-sm btn-ghost" onClick={() => preset(6)}>Last 7 days</button>
          <button className="btn btn-sm btn-ghost" onClick={() => preset(29)}>Last 30 days</button>
          <button className="btn btn-sm btn-ghost" onClick={() => preset(null)}>All time</button>
        </div>
      </div>
      <p className="form-error" role="alert">{rangeError}</p>

      <div className="stats">
        <div className="stat" style={{ background: 'var(--lilac)' }}><b>{totals?.bills ?? 0}</b><span>Completed bills</span></div>
        <div className="stat" style={{ background: 'var(--peach)' }}><b>{money(totals?.sales ?? 0)}</b><span>Total sales</span></div>
        <div className="stat" style={{ background: 'var(--mint)' }}><b>{totals?.customers === null || totals == null ? '—' : `${totals.customers}${totals.customersPartial ? '+' : ''}`}</b><span>Customers served</span></div>
        <div className="stat" style={{ background: 'var(--sky)' }}><b>{data.filter((s) => s.bills > 0).length}</b><span>Staff with sales</span></div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Staff</th><th>Role</th><th>Bills</th><th>Sales</th><th>Customers</th><th>Last sale</th><th></th></tr>
          </thead>
          <tbody>
            {data.length ? data.map((s) => (
              <tr key={s.id || `x-${s.email}`}>
                <td>
                  <strong>{who$(s)}</strong>
                  {s.id && s.active === false && <> <span className="pill pill-out">Disabled</span></>}
                  {s.name && s.email && <div className="muted" style={{ fontSize: 12 }}>{s.email}</div>}
                </td>
                <td>{s.role ? <span className={`role-pill role-${s.role}`}>{s.role === 'admin' ? 'Admin' : 'Cashier'}</span> : <span className="muted">—</span>}</td>
                <td>{s.bills}</td>
                <td><strong>{money(s.sales)}</strong></td>
                <td>{customersCell(s)}</td>
                <td>{s.lastSale ? fmtDate(s.lastSale) : <span className="muted">—</span>}</td>
                <td>{s.id && s.bills > 0 && <button className="link-btn" onClick={() => setWho(s)}>View sales</button>}</td>
              </tr>
            )) : (
              <tr><td colSpan="7">
                {error ? (
                  <div className="empty"><span className="empty-ico">⚠️</span>{error}<br /><button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={load}>Try again</button></div>
                ) : loading ? (
                  <div className="empty"><span className="empty-ico">⏳</span>Loading report…</div>
                ) : (
                  <div className="empty"><span className="empty-ico">📈</span>No staff accounts found.</div>
                )}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="field-hint">Sales include tax. Customers are counted from the customer linked to each bill; “—” means those bills have no link, and “+” means some do not, so the real number may be higher.</p>

      {who && (
        <>
          <div className="view-head report-sub">
            <div>
              <h2 style={{ fontSize: 20 }}>Sales by {who$(who)}</h2>
              <p className="muted">{sales.summary ? `${plural(sales.summary.bills, 'bill')} · ${money(sales.summary.sales)}` : sales.loading ? 'Loading…' : ''}</p>
            </div>
            <div className="actions"><button className="btn btn-sm btn-ghost" onClick={() => setWho(null)}>Close</button></div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Bill no.</th><th>Date</th><th>Customer</th><th>Items</th><th>Payment</th><th>Total</th><th></th></tr></thead>
              <tbody>
                {sales.data.length ? sales.data.map((o) => (
                  <tr key={o.id}>
                    <td><strong>{o.billNo}</strong></td>
                    <td>{fmtDate(o.date)}</td>
                    <td>{o.customer}</td>
                    <td>{o.items.reduce((a, i) => a + i.qty, 0)}</td>
                    <td><span className={`pill ${o.method === 'Cash' ? 'pill-cash' : 'pill-card'}`}>{o.method}</span></td>
                    <td><strong>{money(o.total)}</strong></td>
                    <td><button className="link-btn" onClick={() => onViewReceipt(o)}>View receipt</button></td>
                  </tr>
                )) : (
                  <tr><td colSpan="7">
                    {sales.error ? (
                      <div className="empty"><span className="empty-ico">⚠️</span>{sales.error}<br /><button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => loadSales(who, 1)}>Try again</button></div>
                    ) : sales.loading ? (
                      <div className="empty"><span className="empty-ico">⏳</span>Loading sales…</div>
                    ) : (
                      <div className="empty"><span className="empty-ico">🧾</span>No bills in this period.</div>
                    )}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          {sales.data.length < sales.total && (
            <div className="load-more">
              <button className="btn btn-ghost" disabled={sales.loading} onClick={() => loadSales(who, sales.page + 1)}>
                Load more ({sales.total - sales.data.length} older)
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}