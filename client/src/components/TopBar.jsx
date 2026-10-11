const TABS = [
  { id: 'sell', icon: '🛒', label: 'Sell' },
  { id: 'customers', icon: '👥', label: 'Customers' },
  { id: 'history', icon: '🧾', label: 'Sales history' },
  { id: 'inventory', icon: '📦', label: 'Inventory' }, // new in the MERN version
];

export default function TopBar({ view, onView, email, onLogout }) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo-mark sm" aria-hidden="true">🌸</span>
        <span>Petal &amp; Bean</span>
      </div>
      <nav className="tabs" id="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`tab${view === t.id ? ' active' : ''}`} data-view={t.id} onClick={() => onView(t.id)}>
            <span className="tab-ico">{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
      </nav>
      <div className="user-box">
        <span className="user-email" id="userEmail">{email}</span>
        <button className="btn btn-ghost btn-sm" id="logoutBtn" onClick={onLogout}>Log out</button>
      </div>
    </header>
  );
}
