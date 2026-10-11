import { usePos } from '../context/PosContext.jsx';
import { fmtDate } from '../utils/format.js';

// The paper ticket. Same markup/classes as the original showReceipt(), so the styles and print layout are unchanged.
export default function Receipt({ sale, id }) {
  const { settings, money } = usePos();
  return (
    <div className="receipt" id={id}>
      <div className="r-center">
        <div className="r-shop">{settings.shopName}</div>
        <div className="r-sub">{settings.shopAddress}<br />Tel: {settings.shopPhone}</div>
      </div>
      <div className="r-div"></div>
      <div className="r-row"><span>Bill no.</span><span>{sale.billNo}</span></div>
      <div className="r-row"><span>Date</span><span>{fmtDate(sale.date)}</span></div>
      <div className="r-row"><span>Customer</span><span>{sale.customer}</span></div>
      <div className="r-row"><span>Phone</span><span>{sale.phone}</span></div>
      <div className="r-div"></div>
      {sale.items.map((i, idx) => (
        <div className="r-row" key={idx}><span className="r-item-name">{i.qty} × {i.name}</span><span>{money(i.amount)}</span></div>
      ))}
      <div className="r-div"></div>
      <div className="r-row"><span>Subtotal</span><span>{money(sale.subtotal)}</span></div>
      <div className="r-row"><span>Tax ({Math.round(sale.taxRate * 100)}%)</span><span>{money(sale.tax)}</span></div>
      <div className="r-row r-total"><span>Total</span><span>{money(sale.total)}</span></div>
      <div className="r-div"></div>
      <div className="r-row"><span>Payment</span><span>{sale.method}</span></div>
      {sale.method === 'Cash' ? (
        <>
          <div className="r-row"><span>Cash received</span><span>{money(sale.cashReceived)}</span></div>
          <div className="r-row"><span>Change</span><span>{money(sale.change)}</span></div>
        </>
      ) : (
        <div className="r-row"><span>Card</span><span>{sale.cardLast4 ? `•••• ${sale.cardLast4}` : 'Paid'}</span></div>
      )}
      <div className="r-thanks">Thank you for visiting 🌸</div>
    </div>
  );
}
