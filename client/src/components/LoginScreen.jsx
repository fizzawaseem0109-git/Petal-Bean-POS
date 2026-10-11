import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'];

export default function LoginScreen() {
  const { login } = useAuth();
  const toast = useToast();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const emailRef = useRef(null);
  const dotsRef = useRef(null);
  const pinRef = useRef('');
  pinRef.current = pin;
  const lockedRef = useRef(false); // keys are ignored while the shake animation plays

  const shake = () => {
    const dots = dotsRef.current;
    if (!dots) return;
    dots.classList.remove('shake');
    void dots.offsetWidth; // restart the CSS animation
    dots.classList.add('shake');
  };

  const tryLogin = useCallback(async () => {
    const email = emailRef.current.value.trim();
    if (!email) {
      setError('Enter your email first.');
      emailRef.current.focus();
      return;
    }
    if (pinRef.current.length < 4) {
      setError('Enter your 4-digit PIN.');
      return;
    }
    if (lockedRef.current) return;
    setBusy(true);
    try {
      await login(email, pinRef.current);
      toast('Till opened');
    } catch (e) {
      setError(e.status === 0 ? e.message : e.message || 'Email or PIN is incorrect. Try again.');
      if (e.status !== 0) shake();
      lockedRef.current = true;
      setTimeout(() => { lockedRef.current = false; setPin(''); }, 400);
      setBusy(false);
    }
  }, [login, toast]);

  const pressKey = useCallback((key) => {
    if (lockedRef.current) return;
    setError('');
    setPin((p) => {
      if (key === 'clear') return '';
      if (key === 'back') return p.slice(0, -1);
      return p.length < 4 ? p + key : p;
    });
  }, []);

  // Auto-submit shortly after the 4th digit (as before)
  useEffect(() => {
    if (pin.length !== 4) return undefined;
    const t = setTimeout(tryLogin, 150);
    return () => clearTimeout(t);
  }, [pin, tryLogin]);

  // Keyboard digits work when you're not typing in the email box
  useEffect(() => {
    const onKey = (e) => {
      if (document.activeElement === emailRef.current) return;
      if (/^\d$/.test(e.key)) pressKey(e.key);
      else if (e.key === 'Backspace') pressKey('back');
      else if (e.key === 'Enter') tryLogin();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pressKey, tryLogin]);

  return (
    <section id="loginScreen" className="login">
      <div className="login-card">
        <div className="login-brand">
          <span className="logo-mark" aria-hidden="true">🌸</span>
          <div>
            <h1>Petal &amp; Bean</h1>
            <p>Sign in to open the till</p>
          </div>
        </div>

        <label className="field">
          <span>Email</span>
          <input
            id="loginEmail" ref={emailRef} type="email" placeholder="you@email.com" autoComplete="username"
            onKeyDown={(e) => { if (e.key === 'Enter') tryLogin(); }}
          />
        </label>

        <div className="pin-row">
          <span className="pin-label">PIN code</span>
          <div className="pin-dots" id="pinDots" ref={dotsRef} aria-live="polite">
            {[0, 1, 2, 3].map((i) => <span key={i} className={i < pin.length ? 'filled' : ''}></span>)}
          </div>
        </div>
        <p className="login-error" id="loginError" role="alert">{error}</p>

        <div className="keypad" id="keypad">
          {KEYS.map((k) =>
            k === 'clear' ? <button key={k} className="key-soft" aria-label="Clear PIN" onClick={() => pressKey(k)}>Clear</button>
            : k === 'back' ? <button key={k} className="key-soft" aria-label="Delete last digit" onClick={() => pressKey(k)}>⌫</button>
            : <button key={k} onClick={() => pressKey(k)}>{k}</button>
          )}
        </div>

        <button className="btn btn-primary btn-block" id="loginBtn" onClick={tryLogin} disabled={busy}>
          {busy ? 'Opening…' : 'Open till'}
        </button>
      </div>
    </section>
  );
}
