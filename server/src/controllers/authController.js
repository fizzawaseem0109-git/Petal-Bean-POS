import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { signToken } from '../middleware/auth.js';
import { ApiError } from '../utils/ApiError.js';

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 5;
const BAD_LOGIN = 'Email or PIN is incorrect. Try again.';

// A real hash, so an unknown email takes about as long as a wrong PIN (no user enumeration by timing).
const DUMMY_HASH = bcrypt.hashSync('not-a-real-pin', 10);

export async function login(req, res) {
  const { email, pin } = req.valid.body;
  const user = await User.findOne({ emailKey: email.trim().toLowerCase() });

  if (!user) {
    await bcrypt.compare(pin, DUMMY_HASH);
    throw ApiError.unauthorized(BAD_LOGIN);
  }

  if (user.lockUntil && user.lockUntil > new Date()) {
    const mins = Math.ceil((user.lockUntil - Date.now()) / 60000);
    throw new ApiError(429, `Too many wrong PINs. Try again in ${mins} minute${mins > 1 ? 's' : ''}.`);
  }

  if (!(await user.verifyPin(pin))) {
    const updated = await User.findByIdAndUpdate(user._id, { $inc: { failedAttempts: 1 } }, { returnDocument: 'after' });
    if (updated.failedAttempts >= MAX_ATTEMPTS) {
      await User.updateOne({ _id: user._id }, { $set: { failedAttempts: 0, lockUntil: new Date(Date.now() + LOCK_MINUTES * 60000) } });
    }
    throw ApiError.unauthorized(BAD_LOGIN);
  }

  if (user.failedAttempts || user.lockUntil) await User.updateOne({ _id: user._id }, { $set: { failedAttempts: 0, lockUntil: null } });
  res.json({ token: signToken(user), user: user.toJSON() });
}

export const me = (req, res) => res.json({ user: req.user.toJSON() });
