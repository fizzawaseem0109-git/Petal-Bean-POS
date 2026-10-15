import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { cleanJson } from './plugins.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    email: { type: String, required: true, trim: true },       // shown as typed, e.g. Fizza-waseem@email.com
    emailKey: { type: String, required: true, unique: true },  // lower-case copy used for (case-insensitive) login lookups
    pinHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'cashier'], default: 'cashier' },
    active: { type: Boolean, default: true }, // false = account disabled (cannot log in, existing tokens stop working)
    tokenVersion: { type: Number, default: 0 }, // +1 whenever the PIN changes: every older login token stops working
   mustChangePassword: { type: Boolean, default: false }, // true = this person must choose a new password before doing anything else
    failedAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
  },
  { timestamps: true, toJSON: cleanJson(['pinHash', 'emailKey', 'tokenVersion', 'failedAttempts', 'lockUntil']) }
);

userSchema.pre('validate', function setEmailKey() {
  if (this.email) this.emailKey = this.email.trim().toLowerCase();
});

userSchema.statics.hashPin = (pin) => bcrypt.hash(String(pin), 10);
userSchema.methods.verifyPin = function verifyPin(pin) {
  return bcrypt.compare(String(pin), this.pinHash);
};

export const User = mongoose.model('User', userSchema);
