import { useState } from 'react';
import Modal from './Modal.jsx';
import { api } from '../api/index.js';

const MODES = [
  { id: 'add', label: 'Add stock' },
  { id: 'remove', label: 'Remove' },
  { id: 'set', label: 'Set count' },
];

export default function StockModal({ product, onClose, onSaved }) {
  const [mode, setMode] = useState('add');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const n = qty === '' ? null : Number(qty);
  const preview = n === null || Number.isNaN(n) ? null : mode === 'add' ? product.stock + n : mode === 'remove' ? product.stock - n : n;

  const save = async () => {
    if (n === null || !Number.isInteger(n) || n < 0) return setError('Enter a whole number, 0 or more.');
    if (mode !== 'set' && n === 0) return setError('Enter a quantity above 0.');
    if (preview < 0) return setError(`You only have ${product.stock} in stock.`);
    const body =
      mode === 'add' ? { delta: n, reason: 'restock' }
      : mode === 'remove' ? { delta: -n, reason: 'adjustment' }
      : { set: n };
    if (note.trim()) body.note = note.trim();
    setBusy(true);
    try {
      const r = await api.adjustStock(product.id, body);
      onSaved(r.data);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} labelledBy="stockTitle">
      <div className="modal-head">
        <h3 id="stockTitle">Adjust stock</h3>
        <button className="modal-x" aria-label="Close" onClick={onClose}>✕</button>
      </div>
      <div className="pay-total">
        <span>{product.icon} {product.name}</span>
        <strong>{product.stock}</strong>
      </div>
      <div className="chips" style={{ marginBottom: 14 }}>
        {MODES.map((m) => (
          <button key={m.id} className={`chip${mode === m.id ? ' active' : ''}`} onClick={() => { setMode(m.id); setError(''); }}>{m.label}</button>
        ))}
      </div>
      <label className="field">
        <span>{mode === 'set' ? 'Counted on the shelf' : 'Quantity'}</span>
        <input type="number" min="0" step="1" inputMode="numeric" autoFocus value={qty}
          onChange={(e) => { setQty(e.target.value); setError(''); }} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
      </label>
      <label className="field">
        <span>Note (optional)</span>
        <input type="text" maxLength={200} placeholder="e.g. morning delivery" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {preview !== null && preview >= 0 && <div className="change-row">New stock: <strong>{preview}</strong></div>}
      <p className="form-error" role="alert">{error}</p>
      <div className="btn-row">
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </Modal>
  );
}
