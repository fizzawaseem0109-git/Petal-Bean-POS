import { useState } from 'react';
import Modal from './Modal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const PIN_RE = /^\d{4,6}$/;

// Any logged-in user changes their OWN PIN. PINs live only in this component's state: never logged or stored.
export default function ChangePinModal({ onClose }) {
  const { changePin } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const digits = (set) => (e) => { set(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); };

  const save = async () => {
    if (!PIN_RE.test(current)) return setError('Enter your current PIN (4 to 6 digits).');
    if (!PIN_RE.test(next)) return setError('New PIN must be 4 to 6 digits.');
    if (next !== confirm) return setError('The new PIN and confirmation do not match.');
    if (next === current) return setError('Choose a PIN that is different from your current one.');
    setBusy(true);
    try {
      await changePin(current, next); // server gives this session a fresh token; other devices are signed out
      onClose();
      toast('PIN changed. Other devices were signed out.');
    } catch (e) {
      setError(e.message);
      setCurrent('');
      setBusy(false);
    }
  };

  const pinInput = (value, set, extra = {}) => (
    <input type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={value} onChange={digits(set)} {...extra} />
  );

  return (
    <Modal onClose={busy ? () => {} : onClose} labelledBy="changePinTitle">
      <div className="modal-head">
        <h3 id="changePinTitle">Change my PIN</h3>
        <button className="modal-x" aria-label="Close" onClick={onClose} disabled={busy}>✕</button>
      </div>
      <label className="field"><span>Current PIN</span>{pinInput(current, setCurrent, { autoFocus: true })}</label>
      <div className="field-row">
        <label className="field"><span>New PIN (4–6 digits)</span>{pinInput(next, setNext)}</label>
        <label className="field">
          <span>Confirm new PIN</span>
          {pinInput(confirm, setConfirm, { onKeyDown: (e) => { if (e.key === 'Enter' && !busy) save(); } })}
        </label>
      </div>
      <p className="form-error" role="alert">{error}</p>
      <div className="btn-row">
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Change PIN'}</button>
      </div>
    </Modal>
  );
}