import { useEffect, useRef, useState } from 'react';

const NAV = [
  { id: 'sell', icon: '🛒', label: 'Sell', roles: ['admin', 'cashier'] },
  { id: 'customers', icon: '👥', label: 'Customers', roles: ['admin'] },
  { id: 'history', icon: '🧾', label: 'Sales history', cashierLabel: 'My bills', roles: ['admin', 'cashier'] },
  { id: 'inventory', icon: '📦', label: 'Inventory', roles: ['admin'] },
  { id: 'staff', icon: '🪪', label: 'Staff', roles: ['admin'] },
  { id: 'performance', icon: '📈', label: 'Staff performance', roles: ['admin'] },
];

// Avatar + name + role + chevron. Click (ya Enter / Space / ↓) se menu khulta hai: Change Password, Log out.
function ProfileMenu({ user, onChangePassword, onLogout }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const itemRefs = useRef([]);
  const pendingFocus = useRef(null); // menu khulne ke baad kis item par focus jaye (null = button par hi rahe)
  const display = user.name || user.email;
  const roleLabel = user.role === 'admin' ? 'Admin' : 'Cashier';

  const items = () => itemRefs.current.filter(Boolean);
  const focusItem = (i) => { const list = items(); if (list.length) list[(i + list.length) % list.length].focus(); };
  const closeAndRefocus = () => { setOpen(false); triggerRef.current?.focus(); };

  // Keyboard se khola ho to focus menu ke andar le jao
  useEffect(() => {
    if (open && pendingFocus.current !== null) focusItem(pendingFocus.current);
  }, [open]);

  // Bahar click / tap par band karo
  useEffect(() => {
    if (!open) return undefined;
    const onOutside = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('touchstart', onOutside);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('touchstart', onOutside);
    };
  }, [open]);

  const onTriggerClick = (e) => {
    if (open) return setOpen(false);
    pendingFocus.current = e.detail === 0 ? 0 : null; // detail 0 = keyboard se click hua
    setOpen(true);
  };

  const onTriggerKey = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = e.key === 'ArrowDown' ? 0 : -1;
      if (open) focusItem(idx);
      else { pendingFocus.current = idx; setOpen(true); }
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      closeAndRefocus();
    }
  };

  const onMenuKey = (e) => {
    const list = items();
    const at = list.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); focusItem(at + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusItem(at - 1); }
    else if (e.key === 'Home') { e.preventDefault(); focusItem(0); }
    else if (e.key === 'End') { e.preventDefault(); focusItem(-1); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeAndRefocus(); }
    else if (e.key === 'Tab') setOpen(false);
  };

  const choose = (action) => () => { setOpen(false); action(); };

  return (
    <div className="side-user" ref={wrapRef}>
      <button
        ref={triggerRef} type="button" id="profileBtn" className={`side-profile${open ? ' open' : ''}`}
        aria-haspopup="menu" aria-expanded={open} aria-controls="profileMenu"
        aria-label={`Account menu for ${display}, ${roleLabel}`}
        onClick={onTriggerClick} onKeyDown={onTriggerKey}
      >
        <span className="side-avatar" aria-hidden="true">{display.charAt(0).toUpperCase()}</span>
        <span className="side-who">
          <strong title={user.email}>{display}</strong>
          <span className={`role-pill role-${user.role}`}>{roleLabel}</span>
        </span>
        <span className="side-chev" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 8l5 5 5-5" />
          </svg>
        </span>
      </button>

      {open && (
        <div id="profileMenu" className="side-menu" role="menu" aria-labelledby="profileBtn" onKeyDown={onMenuKey}>
          <div className="side-menu-head" role="none">
            <strong title={user.email}>{display}</strong>
            <span className={`role-pill role-${user.role}`}>{roleLabel}</span>
          </div>
          <button type="button" role="menuitem" className="side-menu-item" ref={(el) => { itemRefs.current[0] = el; }} onClick={choose(onChangePassword)}>
            <span aria-hidden="true">🔑</span> Change Password
          </button>
          <button type="button" role="menuitem" className="side-menu-item danger" ref={(el) => { itemRefs.current[1] = el; }} onClick={choose(onLogout)}>
            <span aria-hidden="true">🚪</span> Log out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ view, onView, user, onChangePin, onLogout }) {
  const items = NAV.filter((n) => n.roles.includes(user.role));
  return (
    <aside className="sidebar">
      <div className="brand side-brand">
        <span className="logo-mark sm" aria-hidden="true">🌸</span>
        <span className="side-brand-name">Petal &amp; Bean</span>
      </div>

      <nav className="side-nav" aria-label="Main">
        {items.map((n) => (
          <button
            key={n.id}
            className={`side-link${view === n.id ? ' active' : ''}`}
            aria-current={view === n.id ? 'page' : undefined}
            onClick={() => onView(n.id)}
          >
            <span className="side-ico" aria-hidden="true">{n.icon}</span>
            <span className="side-label">{user.role === 'cashier' && n.cashierLabel ? n.cashierLabel : n.label}</span>
          </button>
        ))}
      </nav>

      <ProfileMenu user={user} onChangePassword={onChangePin} onLogout={onLogout} />
    </aside>
  );
}