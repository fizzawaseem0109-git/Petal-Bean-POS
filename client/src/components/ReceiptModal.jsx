import Modal from './Modal.jsx';
import Receipt from './Receipt.jsx';

export default function ReceiptModal({ sale, fresh, onClose, onPrint }) {
  return (
    <Modal onClose={onClose} className="receipt-modal" label="Receipt">
      <div className="modal-head">
        <h3 id="receiptTitle">{fresh ? 'Payment complete' : `Bill ${sale.billNo}`}</h3>
        <button className="modal-x" aria-label="Close" onClick={onClose}>✕</button>
      </div>
      <div className="modal-body">
        <Receipt sale={sale} id="receipt" />
      </div>
      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
        <button className="btn btn-primary" id="printBtn" onClick={() => onPrint(sale)}>Print receipt</button>
      </div>
    </Modal>
  );
}
