// Same formatting rules as the original app.js
export const round2 = (n) => Math.round(n * 100) / 100;

export const makeMoney = (currency) => (n) => {
  const d = Number.isInteger(Number(n)) ? 0 : 2;
  return `${currency} ${Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
};

export const fmtDate = (d) =>
  new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
