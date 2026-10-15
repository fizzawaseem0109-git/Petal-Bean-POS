import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/index.js';

const POLL_MS = 30000; // look for new alerts every 30 seconds while the page is visible

// Everything the bell needs: the list, the unread count, loading / error state and the four actions.
// Each action returns '' when it worked, or a readable error message when it did not.
export function useNotifications() {
  const [state, setState] = useState({ items: [], unread: 0, loading: true, error: '' });
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // Full load: shows the loading state (first open, "Try again").
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const r = await api.getNotifications();
      if (alive.current) setState({ items: r.data, unread: r.unread, loading: false, error: '' });
    } catch (e) {
      if (alive.current) setState((s) => ({ ...s, loading: false, error: e.message }));
    }
  }, []);

  // Quiet refresh: no spinner, and if it fails the screen keeps what it already shows.
  const refresh = useCallback(async () => {
    try {
      const r = await api.getNotifications();
      if (alive.current) setState((s) => ({ ...s, items: r.data, unread: r.unread, loading: false, error: '' }));
    } catch { /* keep what we have */ }
  }, []);

  useEffect(() => {
    load();
    const tick = () => { if (document.visibilityState === 'visible') refresh(); };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [load, refresh]);

  const act = useCallback(async (call, apply) => {
    try {
      const r = await call();
      if (alive.current) setState((s) => apply(s, r));
      return '';
    } catch (e) {
      return e.message;
    }
  }, []);

  const markRead = useCallback((id) => act(
    () => api.markNotificationRead(id),
    (s, r) => ({ ...s, unread: r.unread, items: s.items.map((n) => (n.id === id ? r.data : n)) })
  ), [act]);

  const markAllRead = useCallback(() => act(
    () => api.markAllNotificationsRead(),
    (s) => ({ ...s, unread: 0, items: s.items.map((n) => ({ ...n, read: true })) })
  ), [act]);

  const dismiss = useCallback((id) => act(
    () => api.dismissNotification(id),
    (s, r) => ({ ...s, unread: r.unread, items: s.items.filter((n) => n.id !== id) })
  ), [act]);

  const clearAll = useCallback(() => act(
    () => api.clearNotifications(),
    (s) => ({ ...s, unread: 0, items: [] })
  ), [act]);

  return { ...state, reload: load, refresh, markRead, markAllRead, dismiss, clearAll };
}