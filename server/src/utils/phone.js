// Customers are matched by their digits only, so "0300 1234567" and "0300-1234567" are the same person.
export const phoneKey = (phone) => String(phone ?? '').replace(/\D/g, '');
