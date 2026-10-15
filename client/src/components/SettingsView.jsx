import { useState } from 'react';
import { api } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { usePos } from '../context/PosContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const pctText = (rate) => String(Math.round(rate * 10000) / 100); // 0.0825 -> "8.25"
const fromSettings = (s) => ({ shopName: s.shopName, shopAddress: s.shopAddress, shopPhone: s.shopPhone, currency: s.currency, tax: pctText(s.taxRate) });

export default function SettingsView({ onChangePassword }) {
  const { user } = useAuth();
  const { settings, applySettings } = usePos();
  const toast = useToast();
  const canEdit = Boolean(user.permissions?.includes('settings:manage')); // admins only; the server enforces it too
  const [f, setF] = useState(() => fromSettings(settings));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const dirty = JSON.stringify(f) !== JSON.stringify(fromSettings(settings));

  const set = (key) => (e) => { setF((p) => ({ ...p, [key]: e.target.value })); setError(''); setSaved(false); };

  const problem = () => {
    if (!f.shopName.trim()) return 'Café name is required.';
    if (f.shopName.trim().length > 60) return 'Café name can be at most 60 characters.';
    if (f.shopAddress.trim().length > 120) return 'Address can be at most 120 characters.';
    if (f.shopPhone.trim().length > 30) return 'Phone number can be at most 30 characters.';
    if (!f.currency.trim()) return 'Currency is required.';
    if (f.currency.trim().length > 8) return 'Currency can be at most 8 characters.';
    const tax = f.tax.trim();
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(tax)) return 'Enter the tax as a number like 5 or 8.25.';
    if (Number(tax) > 100) return 'Tax must be between 0 and 100.';
    return '';
  };

  const save = async (e) => {
    e.preventDefault();
    if (busy || !canEdit) return;
    const msg = problem();
    if (msg) { setError(msg); return; }
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const res = await api.updateSettings({
        shopName: f.shopName.trim(),
        shopAddress: f.shopAddress.trim(),
        shopPhone: f.shopPhone.trim(),
        currency: f.currency.trim(),
        taxRate: Math.round(Number(f.tax.trim()) * 100) / 10000, // 8.25 % -> 0.0825
      });
      applySettings(res);          // the whole app (bill panel, receipts) switches to the saved values
      setF(fromSettings(res));
      setSaved(true);
      toast('Settings saved');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const discard = () => { setF(fromSettings(settings)); setError(''); setSaved(false); };

  return (
    <section className="view settings" id="view-settings">
      <div className="view-head"><h2>Settings</h2></div>

      <form onSubmit={save} noValidate>
        <div className="set-card" style={{ marginBottom: 16 }}>
          <h3>General</h3>
          <p className="set-sub">{canEdit ? 'Your café name and currency.' : 'Only an admin can change these settings.'}</p>
          <label className="field">
            <span>Café name</span>
            <input value={f.shopName} onChange={set('shopName')} maxLength={60} disabled={!canEdit || busy} />
          </label>
          <label className="field">
            <span>Currency</span>
            <input value={f.currency} onChange={set('currency')} maxLength={8} disabled={!canEdit || busy} />
            <p className="field-hint">Only changes the label shown on prices. Existing bills are not converted.</p>
          </label>
        </div>

        <div className="set-card" style={{ marginBottom: 16 }}>
          <h3>Billing</h3>
          <p className="set-sub">New bills use these settings. Bills already made keep the tax they were created with.</p>
          <label className="field">
            <span>Tax (%)</span>
            <input value={f.tax} onChange={set('tax')} inputMode="decimal" maxLength={6} disabled={!canEdit || busy} />
            <p className="field-hint">Use 0 for no tax. Example: 5 or 8.25.</p>
          </label>
          <label className="field">
            <span>Address on receipts</span>
            <input value={f.shopAddress} onChange={set('shopAddress')} maxLength={120} disabled={!canEdit || busy} />
          </label>
          <label className="field">
            <span>Phone on receipts</span>
            <input value={f.shopPhone} onChange={set('shopPhone')} maxLength={30} disabled={!canEdit || busy} />
          </label>
        </div>

        {canEdit && (
          <div className="set-actions" style={{ marginBottom: 16 }}>
            <button type="submit" className="btn btn-primary" disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save changes'}</button>
            <button type="button" className="btn btn-ghost" onClick={discard} disabled={busy || !dirty}>Discard</button>
            {saved && !dirty && <span className="form-ok" role="status">Saved ✓</span>}
          </div>
        )}
        <p className="form-error" role="alert">{error}</p>
      </form>

      <div className="set-card">
        <h3>Account &amp; security</h3>
        <p className="set-sub">Your sign-in details.</p>
        <dl className="set-account">
          <dt>Name</dt><dd>{user.name || '—'}</dd>
          <dt>Email</dt><dd>{user.email}</dd>
          <dt>Role</dt><dd><span className={`role-pill role-${user.role}`}>{user.role === 'admin' ? 'Admin' : 'Cashier'}</span></dd>
        </dl>
        <button type="button" className="btn btn-ghost" onClick={onChangePassword}>🔑 Change password</button>
      </div>
    </section>
  );
}