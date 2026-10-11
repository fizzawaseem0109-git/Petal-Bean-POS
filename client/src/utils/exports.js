// CSV + PDF export. Ported from the original app.js: same columns, same PDF layout and colours.
// jsPDF (2.5.1) and AutoTable (3.8.2) now come from npm, and are only loaded when someone clicks Export PDF.
import { fmtDate } from './format.js';

const p2 = (n) => String(n).padStart(2, '0');
export function stamp() {
  const d = new Date();
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}`;
}

// A cell starting with = + - @ can be run as a formula when the CSV is opened in Excel/Sheets.
// Prefix those with an apostrophe (OWASP advice). Plain numbers and phone numbers like "+92 300 1234567" are left alone.
const looksSafe = /^[+-]?[\d\s().-]+$/;
function neutralise(v) {
  const s = String(v ?? '');
  if (/^[=@\t\r]/.test(s) || (/^[+-]/.test(s) && !looksSafe.test(s))) return `'${s}`;
  return s;
}

export function downloadCSV(filename, headers, rows) {
  const esc = (v) => `"${neutralise(v).replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

async function downloadPDF({ filename, title, headers, rows, columnStyles, summary, landscape, shopName }) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;

  // Header band
  doc.setFillColor(227, 215, 250);
  doc.rect(0, 0, pageW, 78, 'F');
  doc.setTextColor(58, 47, 77);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(title, margin, 38);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`${shopName}   |   Exported ${fmtDate(new Date())}`, margin, 58);

  // Summary chips
  let y = 100;
  if (summary && summary.length) {
    let x = margin;
    const fills = [[227, 215, 250], [255, 216, 194], [196, 235, 217], [199, 226, 247]];
    summary.forEach((s, i) => {
      doc.setFontSize(9);
      const w = Math.max(doc.getTextWidth(s.label), (doc.setFontSize(13), doc.getTextWidth(s.value))) + 28;
      doc.setFillColor(...fills[i % fills.length]);
      doc.roundedRect(x, y, w, 44, 8, 8, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
      doc.text(s.value, x + 14, y + 20);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.text(s.label, x + 14, y + 35);
      x += w + 10;
    });
    y += 62;
  }

  doc.setLineHeightFactor(1.4); // more air between item lines
  autoTable(doc, {
    startY: y,
    head: [headers],
    body: rows,
    theme: 'grid',
    styles: {
      font: 'helvetica', fontSize: 9.5, textColor: [58, 47, 77],
      cellPadding: { top: 9, bottom: 9, left: 8, right: 8 },
      minCellHeight: 30, valign: 'middle', overflow: 'linebreak',
      lineColor: [233, 227, 243], lineWidth: 0.6,
    },
    headStyles: { fillColor: [123, 97, 201], textColor: 255, fontStyle: 'bold', valign: 'middle', minCellHeight: 26 },
    alternateRowStyles: { fillColor: [249, 247, 254] },
    columnStyles: columnStyles || {},
    rowPageBreak: 'avoid',
    margin: { left: margin, right: margin, top: 40, bottom: 40 },
    didParseCell: (d) => {
      // Header text follows the same alignment as its column
      const cs = (columnStyles || {})[d.column.index];
      if (d.section === 'head' && cs && cs.halign) d.cell.styles.halign = cs.halign;
    },
    didDrawPage: () => {
      doc.setFontSize(8.5);
      doc.setTextColor(119, 107, 138);
      doc.text(`Page ${doc.internal.getNumberOfPages()}`, pageW - margin, pageH - 18, { align: 'right' });
    },
  });

  doc.save(filename);
}

const pdfDate = (d) => {
  const dt = new Date(d);
  const day = dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${day}\n${time}`;
};
const num = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** customers: array from the API. Returns when the file has been generated. */
export async function exportCustomers(type, customers, { currency, shopName }) {
  if (type === 'csv') {
    const headers = ['Name', 'Phone', 'Orders', `Total spent (${currency})`, 'Last visit'];
    const rows = customers.map((c) => [c.name, c.phone, c.orders, Number(c.totalSpent).toFixed(2), fmtDate(c.lastVisit)]);
    downloadCSV(`customers_${stamp()}.csv`, headers, rows);
    return;
  }
  const spent = customers.reduce((a, c) => a + c.totalSpent, 0);
  await downloadPDF({
    shopName,
    filename: `customers_${stamp()}.pdf`,
    title: 'Customers',
    headers: ['#', 'Name', 'Phone', 'Orders', `Total spent (${currency})`, 'Last visit'],
    rows: customers.map((c, i) => [i + 1, c.name, c.phone, c.orders, num(c.totalSpent), pdfDate(c.lastVisit)]),
    columnStyles: {
      0: { cellWidth: 28, halign: 'center' },
      1: { cellWidth: 'auto', fontStyle: 'bold' },
      2: { cellWidth: 100 },
      3: { cellWidth: 52, halign: 'center' },
      4: { cellWidth: 95, halign: 'right' },
      5: { cellWidth: 85 },
    },
    summary: [
      { label: 'Customers', value: String(customers.length) },
      { label: 'Total spent', value: `${currency} ${num(spent)}` },
    ],
  });
}

/** sales: array of orders from the API. */
export async function exportSales(type, sales, { currency, shopName }) {
  if (type === 'csv') {
    const headers = ['Bill no.', 'Date', 'Customer', 'Phone', 'Items', 'Subtotal', 'Tax', 'Total', 'Payment'];
    const rows = sales.map((s) => [
      s.billNo, fmtDate(s.date), s.customer, s.phone,
      s.items.map((i) => `${i.qty}x ${i.name}`).join('; '),
      s.subtotal.toFixed(2), s.tax.toFixed(2), s.total.toFixed(2), s.method,
    ]);
    downloadCSV(`sales_history_${stamp()}.csv`, headers, rows);
    return;
  }
  const sum = (m) => sales.filter((s) => !m || s.method === m).reduce((a, s) => a + s.total, 0);
  await downloadPDF({
    shopName,
    filename: `sales_history_${stamp()}.pdf`,
    title: 'Sales history',
    landscape: true,
    headers: ['Bill no.', 'Date & time', 'Customer', 'Items', 'Subtotal', 'Tax', 'Total', 'Payment'],
    rows: sales.map((s) => [
      s.billNo,
      pdfDate(s.date),
      `${s.customer}\n${s.phone}`,
      s.items.map((i) => `${i.qty} x ${i.name}  (${num(i.amount)})`).join('\n'),
      num(s.subtotal),
      num(s.tax),
      num(s.total),
      s.method + (s.method === 'Card' && s.cardLast4 ? `\n**** ${s.cardLast4}` : ''),
    ]),
    columnStyles: {
      0: { cellWidth: 62, fontStyle: 'bold' },
      1: { cellWidth: 80 },
      2: { cellWidth: 115 },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 72, halign: 'right' },
      5: { cellWidth: 60, halign: 'right' },
      6: { cellWidth: 78, halign: 'right', fontStyle: 'bold' },
      7: { cellWidth: 66, halign: 'center' },
    },
    summary: [
      { label: 'Bills', value: String(sales.length) },
      { label: 'Total sales', value: `${currency} ${num(sum())}` },
      { label: 'Cash', value: `${currency} ${num(sum('Cash'))}` },
      { label: 'Card', value: `${currency} ${num(sum('Card'))}` },
    ],
  });
}
