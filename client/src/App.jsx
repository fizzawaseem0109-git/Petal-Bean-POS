import { useCallback, useEffect, useState } from 'react';
import { ToastProvider, useToast } from './context/ToastContext.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { PosProvider, usePos } from './context/PosContext.jsx';
import { useCart } from './hooks/useCart.js';
import LoginScreen from './components/LoginScreen.jsx';
import Sidebar from './components/Sidebar.jsx';
import SellView from './components/SellView.jsx';
import CustomersView from './components/CustomersView.jsx';
import HistoryView from './components/HistoryView.jsx';
import InventoryView from './components/InventoryView.jsx';
import StaffView from './components/StaffView.jsx';
import CheckoutModal from './components/CheckoutModal.jsx';
import ReceiptModal from './components/ReceiptModal.jsx';
import LogoutModal from './components/LogoutModal.jsx';
import ChangePinModal from './components/ChangePinModal.jsx';    
import PrintArea from './components/PrintArea.jsx';

function Till() {
  const { user, logout } = useAuth();
  const { refreshProducts } = usePos();
  const toast = useToast();
  const cart = useCart();

  const [view, setView] = useState('sell');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [receipt, setReceipt] = useState(null); // { sale, fresh }
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);         
  const [printJob, setPrintJob] = useState(null);

  useEffect(() => { window.scrollTo(0, 0); }, [view]);

  const onPaid = (sale) => {
    cart.clear();
    refreshProducts(); // stock just went down
    setCheckoutOpen(false);
    setReceipt({ sale, fresh: true });
  };

  const print = useCallback((sale) => setPrintJob({ sale, id: Date.now() }), []);
  const donePrinting = useCallback(() => setPrintJob(null), []);

  return (
    <>
      <div id="app" className="app app-shell">
        <Sidebar view={view} onView={setView} user={user} onChangePin={() => { toast.hide(); setPinOpen(true); }} onLogout={() => { toast.hide(); setLogoutOpen(true); }} />
        <main className="main">
          {view === 'sell' && <SellView cart={cart} onCheckout={() => cart.count && setCheckoutOpen(true)} />}
          {view === 'customers' && <CustomersView />}
          {view === 'history' && <HistoryView onViewReceipt={(sale) => setReceipt({ sale, fresh: false })} />}
          {view === 'inventory' && <InventoryView />}
          {view === 'staff' && user.role === 'admin' && <StaffView />}
        </main>
      </div>

      {checkoutOpen && <CheckoutModal cart={cart} onClose={() => setCheckoutOpen(false)} onPaid={onPaid} />}
      {receipt && <ReceiptModal sale={receipt.sale} fresh={receipt.fresh} onClose={() => setReceipt(null)} onPrint={print} />}
      {logoutOpen && <LogoutModal email={user.email} itemsInBill={cart.count} onClose={() => setLogoutOpen(false)} onConfirm={logout} />}
      {pinOpen && <ChangePinModal onClose={() => setPinOpen(false)} />}
      <PrintArea job={printJob} onDone={donePrinting} />
    </>
  );
}

function Root() {
  const { user, checking } = useAuth();
  if (checking) {
    return (
      <section className="login">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <span className="logo-mark" aria-hidden="true">🌸</span>
          <p className="muted" style={{ marginTop: 12 }}>Opening the till…</p>
        </div>
      </section>
    );
  }
  if (!user) return <LoginScreen />;
  return (
    <PosProvider>
      <Till />
    </PosProvider>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </ToastProvider>
  );
}
