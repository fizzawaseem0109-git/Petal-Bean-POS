import { useState } from 'react';
import Modal from './Modal.jsx';
import { api } from '../api/index.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PIN_RE = /^\d{4,6}$/;

// Admin creates a staff account. The PIN stays in this component's state only: never logged or stored.
export default function AddStaffModal({ onClose, onSaved }) {
  const [f, setF] = useState({ name: '', email: '', role: 'cashier', pin: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.value })); setError(''); };
  const setPin = (e) => {
    const pin = e.target.value.replace(/\D/g, '').slice(0, 6); // digits only, max 6
    setF((x) => ({ ...x, pin }));
    setError('');
  };

  const save = async () => {
    const name = f.name.trim();
    const email = f.email.trim();
    if (!name) return setError('Enter a name.');
    if (!EMAIL_RE.test(email)) return setError('Enter a valid email address.');
    if (!PIN_RE.test(f.pin)) return setError('PIN must be 4 to 6 digits.');
    setBusy(true);
    try {
      const r = await api.createStaff({ name, email, role: f.role, pin: f.pin });
      onSaved(r.data);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} labelledBy="addStaffTitle">
      <div className="modal-head">
        <h3 id="addStaffTitle">Add staff member</h3>
        <button className="modal-x" aria-label="Close" onClick={onClose}>✕</button>
      </div>
      <label className="field"><span>Name</span><input autoFocus type="text" maxLength={60} value={f.name} onChange={set('name')} placeholder="e.g. Ayesha Khan" /></label>
      <label className="field"><span>Email (their login)</span><input type="email" maxLength={120} autoComplete="off" value={f.email} onChange={set('email')} placeholder="name@email.com" /></label>
      <div className="field-row">
        <label className="field">
          <span>Role</span>
          <select value={f.role} onChange={set('role')}><option value="cashier">Cashier</option><option value="admin">Admin</option></select>
        </label>
        <label className="field">
          <span>PIN (4–6 digits)</span>
          <input
            type="password" inputMode="numeric" autoComplete="new-password" maxLength={6}
            value={f.pin} onChange={setPin} onKeyDown={(e) => { if (e.key === 'Enter' && !busy) save(); }}
          />
        </label>
      </div>
      <p className="form-error" role="alert">{error}</p>
      <div className="btn-row">
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Adding…' : 'Add staff member'}</button>
      </div>
    </Modal>
  );
}