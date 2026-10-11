import { useEffect, useRef, useState } from 'react';
import Modal from './Modal.jsx';
import { api } from '../api/index.js';
import { usePos } from '../context/PosContext.jsx';
import { round2 } from '../utils/format.js';

export default function CheckoutModal({ cart, onClose, onPaid }) {
  const { money, refreshProducts } = usePos();
  const { lines, totals } = cart;
  const total = totals.total;

  const [step, setStep] = useState('customer'); // 'customer' | 'payment'
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [customers, setCustomers] = useState([]); // for the name suggestions
  const [method, setMethod] = useState('Cash');
  const [cash, setCash] = useState('');
  const [last4, setLast4] = useState('');
  const [custError, setCustError] = useState('');
  const [payError, setPayError] = useState('');
  const [busy, setBusy] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    nameRef.current?.focus();
    api.getCustomers({ limit: 500 }).then((r) => setCustomers(r.data)).catch(() => {});
  }, []);

  // Known customer typed by name → fill in their phone (also runs when the list arrives after typing started)
  useEffect(() => {
    if (phone) return;
    const match = customers.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
    if (match) setPhone(match.phone);
  }, [customers, name, phone]);

  const goToPayment = () => {
    const digits = phone.trim().replace(/\D/g, '');
    if (!name.trim()) return setCustError("Enter the customer's name.");
    if (digits.length < 7 || digits.length > 15) return setCustError('Enter a valid phone number (7–15 digits).');
    setCustError('');
    setCash('');
    setLast4('');
    setPayError('');
    setMethod('Cash');
    setStep('payment');
  };

  const pickMethod = (m) => { setMethod(m); setPayError(''); };
  const change = Math.max(0, round2((parseFloat(cash) || 0) - total));

  const complete = async () => {
    const payment = { method };
    if (method === 'Cash') {
      const received = cash === '' ? total : parseFloat(cash);
      if (Number.isNaN(received) || received < total) return setPayError(`Cash received must be at least ${money(total)}.`);
      payment.cashReceived = received;
    } else {
      const digits = last4.replace(/\D/g, '');
      if (digits && digits.length !== 4) return setPayError('Card digits must be exactly 4 numbers, or leave it empty.');
      payment.cardLast4 = digits;
    }
    setBusy(true);
    setPayError('');
    try {
      const { data } = await api.createOrder({
        customer: { name: name.trim(), phone: phone.trim() },
        items: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
        payment,
      });
      onPaid(data);
    } catch (e) {
      setPayError(e.message);
      if (e.status === 409 || e.status === 400) refreshProducts(); // stock or menu changed under us
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} labelledBy="checkoutTitle">
      <div className="modal-head">
        <h3 id="checkoutTitle">{step === 'customer' ? 'Customer details' : 'Payment'}</h3>
        <button className="modal-x" aria-label="Close" onClick={onClose}>✕</button>
      </div>

      {step === 'customer' ? (
        <div className="step" id="stepCustomer">
          <label className="field">
            <span>Customer name</span>
            <input ref={nameRef} id="custName" type="text" placeholder="e.g. Ayesha Khan" list="customerList" value={name} onChange={(e) => setName(e.target.value)} />
            <datalist id="customerList">
              {customers.map((c) => <option key={c.id} value={c.name}>{c.phone}</option>)}
            </datalist>
          </label>
          <label className="field">
            <span>Phone number</span>
            <input id="custPhone" type="tel" placeholder="e.g. 0300 1234567" inputMode="tel" value={phone}
              onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') goToPayment(); }} />
          </label>
          <p className="form-error" id="custError" role="alert">{custError}</p>
          <button className="btn btn-primary btn-block" id="toPaymentBtn" onClick={goToPayment}>Continue to payment</button>
        </div>
      ) : (
        <div className="step" id="stepPayment">
          <div className="pay-total">
            <span>Amount due</span>
            <strong id="payDue">{money(total)}</strong>
          </div>
          <div className="pay-methods">
            <button className={`pay-method${method === 'Cash' ? ' selected' : ''}`} onClick={() => pickMethod('Cash')}><span className="pm-ico">💵</span>Cash</button>
            <button className={`pay-method${method === 'Card' ? ' selected' : ''}`} onClick={() => pickMethod('Card')}><span className="pm-ico">💳</span>Card</button>
          </div>

          {method === 'Cash' ? (
            <div id="cashFields">
              <label className="field">
                <span>Cash received</span>
                <input id="cashReceived" type="number" min="0" step="1" inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} />
              </label>
              <div className="change-row">Change to return: <strong id="changeDue">{money(change)}</strong></div>
            </div>
          ) : (
            <div id="cardFields">
              <label className="field">
                <span>Last 4 digits of card (optional)</span>
                <input id="cardLast4" type="text" maxLength={4} inputMode="numeric" placeholder="1234" value={last4} onChange={(e) => setLast4(e.target.value)} />
              </label>
            </div>
          )}

          <p className="form-error" id="payError" role="alert">{payError}</p>
          <div className="btn-row">
            <button className="btn btn-ghost" id="backToCustomerBtn" onClick={() => setStep('customer')} disabled={busy}>Back</button>
            <button className="btn btn-primary" id="completeBtn" onClick={complete} disabled={busy}>{busy ? 'Saving…' : 'Complete payment'}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
