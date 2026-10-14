import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/index.js';
import { getToken, setToken, setUnauthorizedHandler } from '../api/http.js';
import { useToast } from './ToastContext.jsx';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(Boolean(getToken())); // is a saved session still valid?

  const clear = useCallback(() => { setToken(null); setUser(null); }, []);

  // Refreshing the page keeps you signed in (until the token expires or the tab is closed).
  useEffect(() => {
    if (!getToken()) return;
    api.me().then((r) => setUser(r.user)).catch(clear).finally(() => setChecking(false));
  }, [clear]);

  // Token expired while using the till → back to the login screen
  useEffect(() => {
    setUnauthorizedHandler(() => { clear(); toast('Session expired. Please log in again.'); });
  }, [clear, toast]);

  const login = useCallback(async (email, pin) => {
    const res = await api.login(email, pin);
    setToken(res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => { clear(); toast('Logged out'); }, [clear, toast]);

  // Change my own PIN: the server returns a fresh token for THIS session (other sessions are logged out).
  const changePin = useCallback(async (currentPin, newPin) => {
    const res = await api.changePin(currentPin, newPin);
    setToken(res.token);
    setUser(res.user);
  }, []);

  return <AuthContext.Provider value={{ user, checking, login, logout, changePin }}>{children}</AuthContext.Provider>;
}
