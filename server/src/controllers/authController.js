import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { signToken } from '../middleware/auth.js';
import { permissionsFor } from '../constants/permissions.js';
import { ApiError } from '../utils/ApiError.js';

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 5;
const BAD_LOGIN = 'Email or PIN is incorrect. Try again.';
const publicUser = (u) => ({ ...u.toJSON(), permissions: permissionsFor(u.role) });

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
        await recordFailedPin(user._id);
    throw ApiError.unauthorized(BAD_LOGIN);
  }

  if (user.failedAttempts || user.lockUntil) await User.updateOne({ _id: user._id }, { $set: { failedAttempts: 0, lockUntil: null } });
    if (user.active === false) throw new ApiError(403, 'This account has been disabled. Please ask an admin.');
  res.json({ token: signToken(user), user: publicUser(user) });
}

export const me = (req, res) => res.json({ user: publicUser(req.user) });

// Count a wrong PIN; lock the account for a few minutes after too many (shared by login and change-PIN).
async function recordFailedPin(userId) {
  const updated = await User.findByIdAndUpdate(userId, { $inc: { failedAttempts: 1 } }, { returnDocument: 'after' });
  if (updated.failedAttempts >= MAX_ATTEMPTS) {
    await User.updateOne({ _id: userId }, { $set: { failedAttempts: 0, lockUntil: new Date(Date.now() + LOCK_MINUTES * 60000) } });
  }
}


// A logged-in person changes their OWN PIN. Needs the current PIN; logs out every other session, keeps this one.
export async function changePin(req, res) {
  const { currentPin, newPin } = req.valid.body;
  const user = req.user;
  if (user.lockUntil && user.lockUntil > new Date()) {
    const mins = Math.ceil((user.lockUntil - Date.now()) / 60000);
    throw new ApiError(429, `Too many wrong PINs. Try again in ${mins} minute${mins > 1 ? 's' : ''}.`);
  }
  if (!(await user.verifyPin(currentPin))) {
    await recordFailedPin(user._id);
    throw ApiError.badRequest('Your current PIN is not correct.'); // 400, not 401: the app logs people out on 401
  }
  if (currentPin === newPin) throw ApiError.badRequest('Choose a PIN that is different from your current one.');
  const updated = await User.findByIdAndUpdate(
    user._id,
    { $set: { pinHash: await User.hashPin(newPin), failedAttempts: 0, lockUntil: null }, $inc: { tokenVersion: 1 } },
    { returnDocument: 'after' }
  );
  res.json({ token: signToken(updated), user: publicUser(updated) });
}