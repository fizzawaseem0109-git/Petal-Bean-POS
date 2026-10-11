import { useCallback, useMemo, useState } from 'react';
import { usePos } from '../context/PosContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { round2 } from '../utils/format.js';

// The bill. Same behaviour as the original cart; totals here are for display,
// the server recalculates them from the database when the bill is paid.
export function useCart() {
  const { products, settings } = usePos();
  const toast = useToast();
  const [cart, setCart] = useState([]); // { productId, qty }

  const add = useCallback((id) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setCart((prev) => {
      const item = prev.find((c) => c.productId === id);
      const next = (item?.qty || 0) + 1;
      if (p.trackStock && next > p.stock) {
        toast(p.stock <= 0 ? `${p.name} is sold out` : `Only ${p.stock} ${p.name} in stock`);
        return prev;
      }
      return item ? prev.map((c) => (c.productId === id ? { ...c, qty: next } : c)) : [...prev, { productId: id, qty: 1 }];
    });
  }, [products, toast]);

  const changeQty = useCallback((id, delta) => {
    const p = products.find((x) => x.id === id);
    setCart((prev) => {
      const item = prev.find((c) => c.productId === id);
      if (!item) return prev;
      const qty = item.qty + delta;
      if (qty <= 0) return prev.filter((c) => c.productId !== id);
      if (delta > 0 && p?.trackStock && qty > p.stock) {
        toast(`Only ${p.stock} ${p.name} in stock`);
        return prev;
      }
      return prev.map((c) => (c.productId === id ? { ...c, qty } : c));
    });
  }, [products, toast]);

  const clear = useCallback(() => setCart([]), []);

  // Items whose product was removed from the menu meanwhile are dropped from the view
  const lines = useMemo(
    () => cart.map((c) => ({ ...c, product: products.find((p) => p.id === c.productId) })).filter((l) => l.product),
    [cart, products]
  );
  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
    const tax = round2(subtotal * settings.taxRate);
    return { subtotal, tax, total: round2(subtotal + tax) };
  }, [lines, settings.taxRate]);
  const count = lines.reduce((s, l) => s + l.qty, 0);

  return { lines, totals, count, add, changeQty, clear };
}
