import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } }, { versionKey: false });
export const Counter = mongoose.model('Counter', counterSchema);

/** Atomically get the next bill number, e.g. PB-0001. Safe with many cashiers at once. */
export async function nextBillNo() {
  const bump = () =>
    Counter.findOneAndUpdate({ _id: 'bill' }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' });
  let doc;
  try {
    doc = await bump();
  } catch (err) {
    if (err?.code !== 11000) throw err; // two first-ever calls raced to create the counter: just retry
    doc = await bump();
  }
  return `PB-${String(doc.seq).padStart(4, '0')}`;
}
