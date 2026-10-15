import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { notifyStaff } from '../services/notificationService.js'; // NEW

const DUPLICATE = 'A staff member with that email already exists.';
const shape = (u) => ({ ...u.toJSON(), active: u.active !== false }); // accounts made before "active" existed count as active
const label = (u) => u.name || u.email; // NEW: how a person is named in an alert
const roleLabel = (role) => (role === 'admin' ? 'Admin' : 'Cashier'); // NEW

// Admin lists everyone (admins first, then cashiers; never includes PIN hashes).
export async function listStaff(_req, res) {
  const users = await User.find().sort({ role: 1, name: 1, emailKey: 1 });
  res.json({ data: users.map(shape) });
}

export async function createStaff(req, res) {
  const { name, email, role, pin } = req.valid.body;
  if (await User.exists({ emailKey: email.toLowerCase() })) throw ApiError.conflict(DUPLICATE);
  let user;
  try {
    user = await User.create({ name, email, role, pinHash: await User.hashPin(pin), mustChangePassword: true });
    } catch (err) {
    throw err?.code === 11000 ? ApiError.conflict(DUPLICATE) : err;
  }
  await notifyStaff('Staff account created', `${label(user)} (${roleLabel(user.role)}) was added by ${label(req.user)}.`, String(user._id)); // NEW
  res.status(201).json({ data: shape(user) });
}

// Rename, change role, or disable/enable. The email can't change: it is the login name and is stamped on every bill.
export async function updateStaff(req, res) {
  const { id } = req.valid.params;
  const changes = req.valid.body;
  const touchingOwnAccess = String(req.user._id) === id && ((changes.role !== undefined && changes.role !== req.user.role) || changes.active === false);
  // Because you can't lock yourself out, at least one active admin (you) always remains.
  if (touchingOwnAccess) throw ApiError.forbidden("You can't change your own role or disable your own account. Ask another admin.");
  const user = await User.findByIdAndUpdate(id, { $set: changes }, { returnDocument: 'after' });
  if (!user) throw ApiError.notFound('Staff member not found.');

  // NEW: one alert describing what changed
  let title = 'Staff account updated';
  if (changes.active === false) title = 'Staff account disabled';
  else if (changes.active === true) title = 'Staff account re-enabled';
  else if (changes.role !== undefined) title = `Staff role changed to ${roleLabel(changes.role)}`;
  await notifyStaff(title, `${label(user)} · changed by ${label(req.user)}.`, String(user._id));

  res.json({ data: shape(user) });
}

// Admin sets a new PIN for SOMEONE ELSE (forgotten PIN). Also unlocks the account and ends their old sessions.
export async function resetPin(req, res) {
  const { id } = req.valid.params;
  if (String(req.user._id) === id) throw ApiError.badRequest('Use "Change password" for your own account.');
  const user = await User.findByIdAndUpdate(
    id,
    { $set: { pinHash: await User.hashPin(req.valid.body.pin), failedAttempts: 0, lockUntil: null, mustChangePassword: true }, $inc: { tokenVersion: 1 } },
        { returnDocument: 'after' }
  );
  if (!user) throw ApiError.notFound('Staff member not found.');
  await notifyStaff('Staff password reset', `${label(user)}'s password was reset by ${label(req.user)}. They were signed out.`, String(user._id)); // NEW
  res.json({ data: shape(user) });
}