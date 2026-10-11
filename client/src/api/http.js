// Tiny fetch wrapper: adds the login token, turns errors into readable messages.
const BASE = import.meta.env.VITE_API_URL || ''; // empty = same origin (Vite proxy in dev, Express in production)
const TOKEN_KEY = 'pb_token';

let token = sessionStorage.getItem(TOKEN_KEY);
let onUnauthorized = () => {};

export const getToken = () => token;
export function setToken(t) {
  token = t;
  if (t) sessionStorage.setItem(TOKEN_KEY, t);
  else sessionStorage.removeItem(TOKEN_KEY);
}
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export class ApiError extends Error {
  constructor(message, status = 0, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function http(path, { method = 'GET', body, params } = {}) {
  const qs = params
    ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString()
    : '';
  let res;
  try {
    res = await fetch(`${BASE}/api${path}${qs}`, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Can't reach the server. Check that the backend is running.", 0);
  }

  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }

  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized(); // session expired while using the app
    throw new ApiError(data?.message || `Request failed (${res.status})`, res.status, data?.details);
  }
  return data;
}
