
const NAV = [
  { id: 'sell', icon: '🛒', label: 'Sell', roles: ['admin', 'cashier'] },
  { id: 'customers', icon: '👥', label: 'Customers', roles: ['admin'] },
  { id: 'history', icon: '🧾', label: 'Sales history', cashierLabel: 'My bills', roles: ['admin', 'cashier'] },
  { id: 'inventory', icon: '📦', label: 'Inventory', roles: ['admin'] },
    { id: 'staff', icon: '🪪', label: 'Staff', roles: ['admin'] },
];

export default function Sidebar({ view, onView, user, onChangePin, onLogout }) {
    const items = NAV.filter((n) => n.roles.includes(user.role));
  const display = user.name || user.email;
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

      <div className="side-user">
        <div className="side-avatar" aria-hidden="true">{display.charAt(0).toUpperCase()}</div>
        <div className="side-who">
          <strong title={user.email}>{display}</strong>
          <span className={`role-pill role-${user.role}`}>{user.role === 'admin' ? 'Admin' : 'Cashier'}</span>
        </div>
                <button className="btn btn-ghost btn-sm side-pin" onClick={onChangePin} aria-label="Change my PIN" title="Change my PIN">
          <span aria-hidden="true">🔑</span><span className="side-pin-label"> Change PIN</span>
        </button>
        <button className="btn btn-ghost btn-sm side-logout" onClick={onLogout}>Log out</button>
      </div>
    </aside>
  );
}