import { useState } from 'react';
import Modal from './Modal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

// Any logged-in user changes their OWN password. Passwords live only in this component's state: never logged or stored.
export default function ChangePinModal({ onClose }) {
  const { changePin } = useAuth(); // the API is still named "change-pin"; it now carries a password
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const type = show ? 'text' : 'password';
  const edit = (set) => (e) => { set(e.target.value); setError(''); };

  const save = async () => {
    if (!current) return setError('Enter your current password.');
    if (next.length < 8) return setError('New password must be at least 8 characters.');
    if (next !== confirm) return setError('The new password and confirmation do not match.');
    if (next === current) return setError('Choose a password that is different from your current one.');
    setBusy(true);
    try {
      await changePin(current, next); // server gives this session a fresh token; other devices are signed out
      onClose();
      toast('Password changed. Other devices were signed out.');
    } catch (e) {
      setError(e.message);
      setCurrent('');
      setBusy(false);
    }
  };

  return (
    <Modal onClose={busy ? () => {} : onClose} labelledBy="changePinTitle">
      <div className="modal-head">
        <h3 id="changePinTitle">Change my password</h3>
        <button className="modal-x" aria-label="Close" onClick={onClose} disabled={busy}>✕</button>
      </div>

      <div className="field">
        <label htmlFor="currentPassword"><span>Current password</span></label>
        <div className="pw-wrap">
          <input
            id="currentPassword" autoFocus type={type} autoComplete="current-password" maxLength={72}
            value={current} onChange={edit(setCurrent)}
          />
          <button
            type="button" className="pw-toggle" onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Hide passwords' : 'Show passwords'} aria-pressed={show}
          >{show ? 'Hide' : 'Show'}</button>
        </div>
      </div>
      <label className="field">
        <span>New password (8+ characters)</span>
        <input type={type} autoComplete="new-password" maxLength={72} value={next} onChange={edit(setNext)} />
      </label>
      <label className="field">
        <span>Confirm new password</span>
        <input
          type={type} autoComplete="new-password" maxLength={72} value={confirm} onChange={edit(setConfirm)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !busy) save(); }}
        />
      </label>

      <p className="form-error" role="alert">{error}</p>
      <div className="btn-row">
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
      </div>
    </Modal>
  );
}