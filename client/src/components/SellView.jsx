import { useEffect, useState } from 'react';
import { usePos } from '../context/PosContext.jsx';

export default function SellView({ cart, onCheckout }) {
  const { products, settings, money, catOf } = usePos();
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [cartOpen, setCartOpen] = useState(false); // mobile bottom sheet

  const { lines, totals, count } = cart;
  useEffect(() => { if (!count) setCartOpen(false); }, [count]);

  const q = search.toLowerCase();
  const list = products.filter((p) => (category === 'all' || p.category === category) && p.name.toLowerCase().includes(q));
  const chips = [{ id: 'all', name: 'All' }, ...settings.categories];

  return (
    <section className="view view-sell" id="view-sell">
      <div className="catalog">
        <div className="catalog-head">
          <input className="search" id="searchInput" type="search" placeholder="Search products" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="chips" id="categoryChips">
            {chips.map((c) => (
              <button key={c.id} className={`chip${category === c.id ? ' active' : ''}`} data-cat={c.id} onClick={() => setCategory(c.id)}>{c.name}</button>
            ))}
          </div>
        </div>

        <div className="product-grid" id="productGrid">
          {!list.length ? (
            <div className="empty" style={{ gridColumn: '1/-1' }}>
              <span className="empty-ico">🔍</span>
              {products.length ? <>No products match “{search}”. Try another name or pick “All”.</> : <>No products on the menu yet. Add some in the Inventory tab.</>}
            </div>
          ) : (
            list.map((p) => {
              const inCart = lines.find((l) => l.productId === p.id);
              const soldOut = p.stockStatus === 'out';
              return (
                <button
                  key={p.id}
                  className={`product${soldOut ? ' soldout' : ''}`}
                  data-id={p.id}
                  aria-label={soldOut ? `${p.name} (sold out)` : `Add ${p.name}`}
                  disabled={soldOut}
                  onClick={() => cart.add(p.id)}
                >
                  {inCart && <span className="product-badge">{inCart.qty}</span>}
                  <div className="product-art" style={{ background: catOf(p.category).color }}>{p.icon}</div>
                  <div className="product-name">{p.name}</div>
                  <div className="product-price">{money(p.price)}</div>
                  {p.stockStatus === 'out' && <div className="product-stock out">Sold out</div>}
                  {p.stockStatus === 'low' && <div className="product-stock low">Only {p.stock} left</div>}
                </button>
              );
            })
          )}
        </div>
      </div>

      <aside className={`cart${cartOpen ? ' open' : ''}`} id="cartPanel">
        <div className="cart-head">
          <h2>Current bill</h2>
          <button className="btn btn-ghost btn-sm" id="clearCartBtn" onClick={() => count && cart.clear()}>Clear</button>
          <button className="cart-close" id="cartCloseBtn" aria-label="Close bill" onClick={() => setCartOpen(false)}>✕</button>
        </div>
                <div className={`cart-items${lines.length ? '' : ' is-empty'}`} id="cartItems">
          {!lines.length ? (
            <div className="cart-empty">
              <svg viewBox="0 0 96 96" fill="none" aria-hidden="true">
                <circle cx="48" cy="48" r="44" fill="#f3effa" />
                <path d="M28 40h40l-4 26a6 6 0 0 1-6 5H38a6 6 0 0 1-6-5l-4-26z" fill="#e3d7fa" stroke="#7b61c9" strokeWidth="3" strokeLinejoin="round" />
                <path d="M38 40c0-8 4-14 10-14s10 6 10 14" stroke="#7b61c9" strokeWidth="3" strokeLinecap="round" />
                <circle cx="42" cy="52" r="2.5" fill="#7b61c9" /><circle cx="54" cy="52" r="2.5" fill="#7b61c9" />
                <path d="M43 59c3 3 7 3 10 0" stroke="#7b61c9" strokeWidth="3" strokeLinecap="round" />
              </svg>
              No items added yet. Select products from the menu to start the bill.
            </div>
          ) : (
            lines.map(({ product: p, qty }) => (
              <div className="cart-item" key={p.id}>
                <div className="ci-icon" style={{ background: catOf(p.category).color }}>{p.icon}</div>
                <div>
                  <div className="ci-name">{p.name}</div>
                  <div className="ci-price">{money(p.price)} × {qty} = {money(p.price * qty)}</div>
                </div>
                <div className="qty">
                  <button aria-label={`Remove one ${p.name}`} onClick={() => cart.changeQty(p.id, -1)}>−</button>
                  <span>{qty}</span>
                  <button aria-label={`Add one ${p.name}`} onClick={() => cart.changeQty(p.id, 1)}>+</button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="cart-totals">
          <div className="row"><span>Subtotal</span><span id="subtotal">{money(totals.subtotal)}</span></div>
          <div className="row"><span id="taxLabel">Tax ({Math.round(settings.taxRate * 100)}%)</span><span id="tax">{money(totals.tax)}</span></div>
          <div className="row total"><span>Total</span><span id="total">{money(totals.total)}</span></div>
        </div>
        <button className="btn btn-primary btn-block btn-lg" id="checkoutBtn" disabled={!count} onClick={() => { onCheckout(); }}>Create bill</button>
      </aside>

      <button className={`cart-fab${count ? '' : ' hide'}`} id="cartFab" onClick={() => setCartOpen(true)}>
        <span>View bill</span>
        <span className="fab-count" id="fabCount">{count}</span>
        <span className="fab-total" id="fabTotal">{money(totals.total)}</span>
      </button>
    </section>
  );
}
