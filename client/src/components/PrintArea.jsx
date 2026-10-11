import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import Receipt from './Receipt.jsx';

// The print CSS hides every direct child of <body> except #printArea, so this is rendered
// into <body> (outside #root) exactly like the original page. Only the receipt gets printed.
export default function PrintArea({ job, onDone }) {
  useEffect(() => {
    const clear = () => onDone();
    window.addEventListener('afterprint', clear);
    return () => window.removeEventListener('afterprint', clear);
  }, [onDone]);

  useEffect(() => {
    if (!job) return undefined;
    const t = setTimeout(() => window.print(), 50);
    return () => clearTimeout(t);
  }, [job]);

  return createPortal(
    <div id="printArea" aria-hidden="true">{job ? <Receipt sale={job.sale} /> : null}</div>,
    document.body
  );
}
