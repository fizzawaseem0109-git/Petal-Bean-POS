import { useEffect, useRef, useState } from 'react';
import { api } from '../api/index.js';import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function LoginScreen() {
  const { login } = useAuth();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [accounts, setAccounts] = useState([]); // demo account picker (empty = hidden)
  const [picked, setPicked] = useState('');
  const emailRef = useRef(null);
  const passRef = useRef(null);
  const wrapRef = useRef(null);

  const shake = () => {
    const el = wrapRef.current;
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth; // restart the CSS animation
    el.classList.add('shake');
  };

   useEffect(() => {
    let live = true;
    api.getDemoAccounts().then((r) => { if (live) setAccounts(r.accounts || []); }).catch(() => {}); // any failure = no picker, normal login
    return () => { live = false; };
  }, []);

  // Only fills the email box and moves to the password box. Nothing is signed in until the password is typed and checked by the server.
 const pick = (e) => {
    const email = e.target.value;
    setPicked(email);
    if (!email) return;
    emailRef.current.value = email;
    setError('');
    passRef.current?.focus();
  };
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const email = emailRef.current.value.trim();
    if (!email) {
      setError('Enter your email first.');
      emailRef.current.focus();
      return;
    }
    if (!password) {
      setError('Enter your password.');
      passRef.current.focus();
      return;
    }
    setBusy(true);
    try {
      await login(email, password); // the password lives only in this component's state
      toast('Till opened');
    } catch (err) {
      setError(err.status === 0 ? err.message : err.message || 'Email or password is incorrect. Try again.');
      if (err.status !== 0) shake();
      setPassword('');
      setBusy(false);
      passRef.current?.focus();
    }
  };

  return (
    <section id="loginScreen" className="login">
      <form className="login-card" onSubmit={submit} noValidate>
        <div className="login-brand">
          <span className="logo-mark" aria-hidden="true">🌸</span>
          <div>
            <h1>Petal &amp; Bean</h1>
            <p>Sign in to open the till</p>
          </div>
        </div>

        
        {accounts.length > 0 && (
          <label className="field demo-pick">
            <span>Demo account</span>
            <select id="demoAccount" value={picked} onChange={pick}>
              <option value="">Choose an account…</option>
              {accounts.map((a) => (
                <option key={a.email} value={a.email}>{a.name || a.email} · {a.role === 'admin' ? 'Admin' : 'Cashier'}</option>
              ))}
            </select>
          </label>
      )}
        <label className="field">
          <span>Email</span>
          <input
            id="loginEmail" ref={emailRef} type="email" placeholder="you@email.com" autoComplete="username"
             onChange={() => { setError(''); setPicked(''); }}          />
        </label>

        <div className="field">
          <label htmlFor="loginPassword"><span>Password</span></label>
          <div className="pw-wrap" ref={wrapRef}>
            <input
              id="loginPassword" ref={passRef} type={show ? 'text' : 'password'} value={password} maxLength={72}
              autoComplete="current-password" onChange={(e) => { setPassword(e.target.value); setError(''); }}
            />
            <button
              type="button" className="pw-toggle" onClick={() => setShow((s) => !s)}
              aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}
            >{show ? 'Hide' : 'Show'}</button>
          </div>
        </div>
        <p className="login-error" id="loginError" role="alert">{error}</p>

        <button type="submit" className="btn btn-primary btn-block" id="loginBtn" disabled={busy}>
          {busy ? 'Opening…' : 'Open till'}
        </button>
      </form>
    </section>
  );
}