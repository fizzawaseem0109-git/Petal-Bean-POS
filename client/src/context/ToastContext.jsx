import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(Object.assign(() => {}, { hide: () => {} }));
export const useToast = () => useContext(ToastContext); // toast('Saved')  ·  toast.hide()

// Same pill toast as the original: 2.2 s, bottom centre
export function ToastProvider({ children }) {
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);
  const timer = useRef();

  const toast = useCallback((text) => {
    setMsg(text);
    setShow(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(false), 2200);
  }, []);
  toast.hide = useCallback(() => { clearTimeout(timer.current); setShow(false); }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className={`toast${show ? ' show' : ''}`} id="toast" role="status" aria-live="polite">{msg}</div>
    </ToastContext.Provider>
  );
}
