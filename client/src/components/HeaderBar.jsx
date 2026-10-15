import { usePos } from '../context/PosContext.jsx';
import NotificationBell from './NotificationBell.jsx';

// Slim strip above every page: the café name (from Settings) on the left, icon buttons on the right.
export default function HeaderBar({ onSettings, settingsActive }) {
  const { settings } = usePos();
  return (
    <header className="app-hdr">
      <span className="app-hdr-name">{settings.shopName}</span>
      <div className="app-hdr-actions">
        <NotificationBell />
        <button
          type="button" className={`hdr-btn${settingsActive ? ' active' : ''}`}
          aria-label="Settings" title="Settings" aria-current={settingsActive ? 'page' : undefined} onClick={onSettings}
        >
          <span aria-hidden="true">⚙️</span>
        </button>
      </div>
    </header>
  );
}