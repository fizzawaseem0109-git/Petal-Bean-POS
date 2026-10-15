import { useState } from 'react';
import Modal from './Modal.jsx';
import { api } from '../api/index.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PW = 8; // the server also enforces 8–72 characters and refuses easy passwords

// Admin creates a staff account. The PIN stays in this component's state only: never logged or stored.
export default function AddStaffModal({ onClose, onSaved }) {
  const [f, setF] = useState({ name: '', email: '', role: 'cashier', pin: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
    const [show, setShow] = useState(false);
  const set = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.value })); setError(''); };
  

  const save = async () => {
    const name = f.name.trim();
    const email = f.email.trim();
    if (!name) return setError('Enter a name.');
    if (!EMAIL_RE.test(email)) return setError('Enter a valid email address.');
    if (f.pin.length < MIN_PW) return setError('Password must be at least 8 characters.');
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
      </div>
              <div className="field">
          <label htmlFor="staffPassword"><span>Password (8+ characters)</span></label>
          <div className="pw-wrap">
            <input
              id="staffPassword" type={show ? 'text' : 'password'} autoComplete="new-password" maxLength={72}
              value={f.pin} onChange={set('pin')} onKeyDown={(e) => { if (e.key === 'Enter' && !busy) save(); }}
            />
            <button
              type="button" className="pw-toggle" onClick={() => setShow((s) => !s)}
              aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}
            >{show ? 'Hide' : 'Show'}</button>
          </div>
        </div>
      <p className="form-error" role="alert">{error}</p>
      <div className="btn-row">
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Adding…' : 'Add staff member'}</button>
      </div>
    </Modal>
  );
}