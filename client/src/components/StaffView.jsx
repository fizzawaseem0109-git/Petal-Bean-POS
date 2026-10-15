import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/index.js';
import { plural } from '../utils/format.js';
import { useToast } from '../context/ToastContext.jsx'; 
import AddStaffModal from './AddStaffModal.jsx';        
import { useAuth } from '../context/AuthContext.jsx';    
import Modal from './Modal.jsx';                         

export default function StaffView() {
      const toast = useToast();
  const [adding, setAdding] = useState(false);
    const { user } = useAuth();
  const [target, setTarget] = useState(null); // staff row waiting for a disable / re-enable confirmation
    const [resetFor, setResetFor] = useState(null); // staff row whose PIN is being reset
  const [state, setState] = useState({ loading: true, error: '', data: [] });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const r = await api.getStaff();
      setState({ loading: false, error: '', data: r.data });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.message }));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const { data, loading, error } = state;

  return (
    <section className="view" id="view-staff">
      <div className="view-head">
        <div>
          <h2>Staff</h2>
          <p className="muted">{data.length ? plural(data.length, 'staff member') : loading ? 'Loading…' : 'No staff yet'}</p>
        </div>
        
        <div className="actions">
          <button className="btn btn-mint" onClick={() => setAdding(true)}>Add staff member</button>
        </div>

      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {data.length ? (
              data.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.name || '—'}</strong></td>
                  <td>{s.email}</td>
                  <td><span className={`role-pill role-${s.role}`}>{s.role === 'admin' ? 'Admin' : 'Cashier'}</span></td>
                  <td><span className={`pill ${s.active ? 'pill-ok' : 'pill-out'}`}>{s.active ? 'Active' : 'Disabled'}</span></td>
                  <td>
                    {s.id === user.id ? (
                      <span className="muted">You</span>
                    ) : (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => setResetFor(s)}>Reset password</button>
                        <button className={`btn btn-sm ${s.active ? 'btn-ghost' : 'btn-mint'}`} onClick={() => setTarget(s)}>
                          {s.active ? 'Disable' : 'Re-enable'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="5">
                {error ? (
                  <div className="empty"><span className="empty-ico">⚠️</span>{error}<br /><button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={load}>Try again</button></div>
                ) : loading ? (
                  <div className="empty"><span className="empty-ico">⏳</span>Loading staff…</div>
                ) : (
                  <div className="empty"><span className="empty-ico">🪪</span>No staff accounts found.</div>
                )}
              </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    {adding && (
        <AddStaffModal
          onClose={() => setAdding(false)}
          onSaved={(u) => { setAdding(false); toast(`${u.name || u.email} added`); load(); }}
        />
      )}
    {target && (
        <StatusConfirm
          staff={target}
          onClose={() => setTarget(null)}
          onDone={(u) => { setTarget(null); toast(`${u.name || u.email} ${u.active ? 're-enabled' : 'disabled'}`); load(); }}
        />
      )}
     {resetFor && (
        <ResetPinModal
          staff={resetFor}
          onClose={() => setResetFor(null)}
          onDone={(u) => { setResetFor(null); toast(`Password reset for ${u.name || u.email}`); load(); }}
        />
      )}
    </section>
  );
}


function StatusConfirm({ staff, onClose, onDone }) {
  const disabling = staff.active;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await api.updateStaff(staff.id, { active: !disabling });
      onDone(r.data);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal onClose={busy ? () => {} : onClose} role="alertdialog" labelledBy="staffStatusTitle" describedBy="staffStatusNote">
      <h3 id="staffStatusTitle">{disabling ? 'Disable this account?' : 'Re-enable this account?'}</h3>
      <p className="logout-user"><strong>{staff.name || staff.email}</strong><br />{staff.email}</p>
      <div className={disabling ? 'danger-note' : 'safe-note'} id="staffStatusNote">
        <span className="danger-ico" aria-hidden="true">{disabling ? '⚠️' : '✅'}</span>
        <div>
          <strong>{disabling ? 'They will be locked out.' : 'They will be able to log in again.'}</strong>
          <p>{disabling
            ? 'They can no longer log in, and anyone using this account is signed out. Their past bills stay in the history.'
            : 'They can log in again with their current password.'}</p>
        </div>
      </div>
      <p className="form-error" role="alert">{error}</p>
      <div className="btn-row">
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className={`btn ${disabling ? 'btn-danger' : 'btn-primary'}`} onClick={run} disabled={busy}>
          {busy ? 'Saving…' : disabling ? 'Disable account' : 'Re-enable account'}
        </button>
      </div>
    </Modal>
  );
}

function ResetPinModal({ staff, onClose, onDone }) {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    if (pw.length < 8) return setError('Password must be at least 8 characters.');
    if (pw !== confirm) return setError('The two passwords do not match.');
    setBusy(true);
    try {
      const r = await api.resetStaffPin(staff.id, pw); // the API field is still called "pin"
      onDone(r.data);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const type = show ? 'text' : 'password';

  return (
    <Modal onClose={busy ? () => {} : onClose} labelledBy="resetPinTitle" describedBy="resetPinNote">
      <div className="modal-head">
        <h3 id="resetPinTitle">Reset password</h3>
        <button className="modal-x" aria-label="Close" onClick={onClose} disabled={busy}>✕</button>
      </div>
      <p className="logout-user"><strong>{staff.name || staff.email}</strong><br />{staff.email}</p>
      <div className="danger-note" id="resetPinNote">
        <span className="danger-ico" aria-hidden="true">⚠️</span>
        <div>
          <strong>They will be signed out.</strong>
          <p>Their old password stops working straight away, and any device using this account is logged out. Tell them the new password in person.</p>
        </div>
      </div>
      <div className="field">
        <label htmlFor="resetPassword"><span>New password (8+ characters)</span></label>
        <div className="pw-wrap">
          <input
            id="resetPassword" autoFocus type={type} autoComplete="new-password" maxLength={72}
            value={pw} onChange={(e) => { setPw(e.target.value); setError(''); }}
          />
          <button
            type="button" className="pw-toggle" onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}
          >{show ? 'Hide' : 'Show'}</button>
        </div>
      </div>
      <label className="field">
        <span>Confirm new password</span>
        <input
          type={type} autoComplete="new-password" maxLength={72}
          value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !busy) run(); }}
        />
      </label>
      <p className="form-error" role="alert">{error}</p>
      <div className="btn-row">
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-primary" onClick={run} disabled={busy}>{busy ? 'Saving…' : 'Reset password'}</button>
      </div>
    </Modal>
  );
}