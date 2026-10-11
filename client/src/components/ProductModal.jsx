import { useState } from 'react';
import Modal from './Modal.jsx';
import { api } from '../api/index.js';
import { usePos } from '../context/PosContext.jsx';

// Add a new product, or edit an existing one (stock itself is changed with "Adjust stock" so every change is logged).
export default function ProductModal({ product, onClose, onSaved }) {
  const { settings } = usePos();
  const editing = Boolean(product);
  const [f, setF] = useState({
    name: product?.name ?? '',
    price: product?.price ?? '',
    category: product?.category ?? settings.categories[0].id,
    icon: product?.icon ?? '🍽️',
    stock: 0,
    lowStockAt: product?.lowStockAt ?? 5,
    trackStock: product?.trackStock ?? true,
    active: product?.active ?? true,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.value })); setError(''); };

  const save = async () => {
    const price = Number(f.price);
    if (!f.name.trim()) return setError('Enter a product name.');
    if (f.price === '' || Number.isNaN(price) || price < 0) return setError('Enter a valid price.');
    const body = {
      name: f.name.trim(), price, category: f.category, icon: f.icon.trim() || '🍽️',
      lowStockAt: Number(f.lowStockAt) || 0, trackStock: String(f.trackStock) === 'true',
    };
    if (editing) body.active = String(f.active) === 'true';
    else body.stock = Number(f.stock) || 0;
    setBusy(true);
    try {
      const r = editing ? await api.updateProduct(product.id, body) : await api.createProduct(body);
      onSaved(r.data, editing);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} labelledBy="productTitle">
      <div className="modal-head">
        <h3 id="productTitle">{editing ? 'Edit product' : 'Add product'}</h3>
        <button className="modal-x" aria-label="Close" onClick={onClose}>✕</button>
      </div>
      <label className="field"><span>Name</span><input autoFocus type="text" maxLength={80} value={f.name} onChange={set('name')} placeholder="e.g. Mocha" /></label>
      <div className="field-row">
        <label className="field"><span>Price ({settings.currency})</span><input type="number" min="0" step="1" inputMode="decimal" value={f.price} onChange={set('price')} /></label>
        <label className="field"><span>Icon (emoji)</span><input type="text" maxLength={8} value={f.icon} onChange={set('icon')} /></label>
      </div>
      <label className="field">
        <span>Category</span>
        <select value={f.category} onChange={set('category')}>
          {settings.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <div className="field-row">
        {!editing && <label className="field"><span>Opening stock</span><input type="number" min="0" step="1" inputMode="numeric" value={f.stock} onChange={set('stock')} /></label>}
        <label className="field"><span>Low-stock alert at</span><input type="number" min="0" step="1" inputMode="numeric" value={f.lowStockAt} onChange={set('lowStockAt')} /></label>
      </div>
      <div className="field-row">
        <label className="field">
          <span>Track stock</span>
          <select value={String(f.trackStock)} onChange={set('trackStock')}><option value="true">Yes</option><option value="false">No (always available)</option></select>
        </label>
        {editing && (
          <label className="field">
            <span>On the menu</span>
            <select value={String(f.active)} onChange={set('active')}><option value="true">Yes</option><option value="false">No (hidden)</option></select>
          </label>
        )}
      </div>
      <p className="form-error" role="alert">{error}</p>
      <div className="btn-row">
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add product'}</button>
      </div>
    </Modal>
  );
}
