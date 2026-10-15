import { useEffect, useRef, useState } from 'react';
import { useNotifications } from '../hooks/useNotifications.js';
import { useToast } from '../context/ToastContext.jsx';

const ICON = { sale: '🧾', low_stock: '⚠️', out_of_stock: '🚫', staff: '🪪' };

// "just now", "5 min ago", "3 h ago", "2 d ago", then the date
function timeAgo(iso) {
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(iso).toLocaleDateString();
}

// Bell in the header strip: unread badge + a dropdown panel (a bottom sheet on phones).
export default function NotificationBell() {
  const toast = useToast();
  const { items, unread, loading, error, reload, refresh, markRead, markAllRead, dismiss, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);

  // Click / tap outside closes the panel
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

  const toggle = () => {
    if (!open) refresh(); // opening always shows fresh alerts
    setOpen((o) => !o);
  };
  const onKeyDown = (e) => {
    if (e.key === 'Escape' && open) {
      e.stopPropagation();
      setOpen(false);
      btnRef.current?.focus();
    }
  };

  // Single alert: only speak up if something went wrong.
  const quiet = async (action) => {
    const problem = await action();
    if (problem) toast(problem);
  };
  // Whole list: disable the buttons while it runs, then say what happened.
  const bulk = async (action, done) => {
    setBusy(true);
    const problem = await action();
    setBusy(false);
    toast(problem || done);
  };

  const label = `Notifications${unread ? `, ${unread} unread` : ''}`;
  const showError = Boolean(error);

  return (
    <div className="notif" ref={wrapRef} onKeyDown={onKeyDown}>
      <button
        ref={btnRef} type="button" className={`hdr-btn${open ? ' active' : ''}`}
        aria-label={label} title="Notifications" aria-haspopup="dialog" aria-expanded={open} aria-controls="notifPanel"
        onClick={toggle}
      >
        <span aria-hidden="true">🔔</span>
        {unread > 0 && <span className="notif-badge" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div id="notifPanel" className="notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-head">
            <h3>Notifications</h3>
            <div className="notif-actions">
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy || unread === 0} onClick={() => bulk(markAllRead, 'All notifications marked as read')}>
                Mark all read
              </button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy || items.length === 0} onClick={() => bulk(clearAll, 'Notifications cleared')}>
                Clear all
              </button>
            </div>
          </div>

          {showError && items.length > 0 && (
            <div className="notif-error" role="alert">
              <span>{error}</span>
              <button type="button" className="link-btn" onClick={reload}>Try again</button>
            </div>
          )}

          {loading && items.length === 0 ? (
            <div className="empty" role="status"><span className="empty-ico">⏳</span>Loading notifications…</div>
          ) : showError && items.length === 0 ? (
            <div className="empty" role="alert">
              <span className="empty-ico">⚠️</span>{error}<br />
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={reload}>Try again</button>
            </div>
          ) : items.length === 0 ? (
            <div className="empty"><span className="empty-ico">🎉</span>You&apos;re all caught up.<br />New alerts will show up here.</div>
          ) : (
            <ul className="notif-list">
              {items.map((n) => (
                <li key={n.id} className={`notif-item${n.read ? '' : ' unread'}`}>
                  <span className={`notif-ico t-${n.type}`} aria-hidden="true">{ICON[n.type] || '🔔'}</span>
                  <div className="notif-body">
                    <div className="notif-title">
                      {!n.read && <span className="notif-dot" aria-label="Unread" />}
                      <span>{n.title}</span>
                    </div>
                    {n.message && <p className="notif-msg">{n.message}</p>}
                    <div className="notif-meta">
                      <time dateTime={n.createdAt} title={new Date(n.createdAt).toLocaleString()}>{timeAgo(n.createdAt)}</time>
                      {!n.read && <button type="button" className="link-btn" onClick={() => quiet(() => markRead(n.id))}>Mark as read</button>}
                    </div>
                  </div>
                  <button type="button" className="notif-x" aria-label={`Dismiss: ${n.title}`} title="Dismiss" onClick={() => quiet(() => dismiss(n.id))}>✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}