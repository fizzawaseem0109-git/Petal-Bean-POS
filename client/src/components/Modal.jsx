import { useEffect } from 'react';

// Wrapper for every popup: backdrop click and Escape close it (as in the original).
export default function Modal({ onClose, children, className = '', role = 'dialog', labelledBy, label, describedBy }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="modal"
      role={role}
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-label={label}
      aria-describedby={describedBy}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`modal-card ${className}`.trim()}>{children}</div>
    </div>
  );
}
