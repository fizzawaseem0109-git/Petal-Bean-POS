import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import { api } from '../api/index.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function LogoutModal({ email, itemsInBill, onClose, onConfirm }) {
  const toast = useToast();
  const { user } = useAuth();
  const [counts, setCounts] = useState({ bills: '–', customers: '–' });

    useEffect(() => {
    toast.hide();
    const seesCustomers = user.permissions?.includes('customers:view:all'); // cashiers only get "–"
    Promise.all([api.getSalesSummary(), seesCustomers ? api.getCustomers({ limit: 1 }) : Promise.resolve(null)])
      .then(([s, c]) => setCounts({ bills: s.bills, customers: c ? c.total : '–' }))
      .catch(() => {});
  }, [toast, user]);

  return (
    <Modal onClose={onClose} className="logout-card" role="alertdialog" labelledBy="logoutTitle" describedBy="logoutWarn">
      <div className="logout-icon" aria-hidden="true">👋</div>
      <h3 id="logoutTitle">Log out of the till?</h3>
      <p className="logout-user">Signed in as <strong id="logoutEmail">{email}</strong></p>

      <div className="logout-summary" id="logoutSummary">
        <div style={{ background: 'var(--lilac)' }}><b>{counts.bills}</b><span>Bills</span></div>
        <div style={{ background: 'var(--mint)' }}><b>{counts.customers}</b><span>Customers</span></div>
        <div style={{ background: 'var(--peach)' }}><b>{itemsInBill}</b><span>Items in bill</span></div>
      </div>

      {itemsInBill > 0 ? (
        <div className="danger-note" id="logoutWarn">
          <span className="danger-ico" aria-hidden="true">⚠️</span>
          <div>
            <strong>The current bill will be cleared.</strong>
            <p>It has {itemsInBill} item{itemsInBill > 1 ? 's' : ''} and hasn't been paid yet, so it isn't saved. Finish the payment first if you need it.</p>
          </div>
        </div>
      ) : (
        <div className="safe-note" id="logoutWarn">
          <span className="danger-ico" aria-hidden="true">✅</span>
          <div>
            <strong>Everything is saved.</strong>
            <p>Sales history, customers and stock are stored in the database. You'll find them when you log back in.</p>
          </div>
        </div>
      )}

      <div className="btn-row">
        <button className="btn btn-ghost" onClick={onClose}>Stay logged in</button>
        <button className="btn btn-danger" id="confirmLogoutBtn" autoFocus onClick={onConfirm}>Log out</button>
      </div>
    </Modal>
  );
}
