import { Notification } from '../models/Notification.js';
import { ApiError } from '../utils/ApiError.js';
import { visibleTo } from '../services/notificationService.js';

// Every query below starts from visibleTo(user): a person can only ever list, read or clear alerts they are allowed to see.
const meId = (req) => String(req.user._id);
const unreadCount = (req) => Notification.countDocuments({ ...visibleTo(req.user), readBy: { $ne: meId(req) } });

// One alert as THIS person sees it: adds `read` (the per-person state is not sent).
const shape = (n, userId) => ({ ...n.toJSON(), read: n.readBy.includes(userId) });

export async function list(req, res) {
  const { limit } = req.valid.query;
  const [rows, unread] = await Promise.all([
    Notification.find(visibleTo(req.user)).sort({ createdAt: -1, _id: -1 }).limit(limit),
    unreadCount(req),
  ]);
  res.json({ data: rows.map((n) => shape(n, meId(req))), unread });
}

export async function markRead(req, res) {
  const n = await Notification.findOneAndUpdate(
    { _id: req.valid.params.id, ...visibleTo(req.user) },
    { $addToSet: { readBy: meId(req) } },
    { returnDocument: 'after' }
  );
  if (!n) throw ApiError.notFound('Notification not found.');
  res.json({ data: shape(n, meId(req)), unread: await unreadCount(req) });
}

export async function markAllRead(req, res) {
  const r = await Notification.updateMany(
    { ...visibleTo(req.user), readBy: { $ne: meId(req) } },
    { $addToSet: { readBy: meId(req) } }
  );
  res.json({ updated: r.modifiedCount, unread: 0 });
}

// "Dismiss" hides the alert for THIS person only (and counts it as read). Other people still see it.
export async function dismiss(req, res) {
  const n = await Notification.findOneAndUpdate(
    { _id: req.valid.params.id, ...visibleTo(req.user) },
    { $addToSet: { dismissedBy: meId(req), readBy: meId(req) } },
    { returnDocument: 'after' }
  );
  if (!n) throw ApiError.notFound('Notification not found.');
  res.json({ ok: true, unread: await unreadCount(req) });
}

// "Clear all": dismiss everything this person can currently see.
export async function clearAll(req, res) {
  const r = await Notification.updateMany(
    visibleTo(req.user),
    { $addToSet: { dismissedBy: meId(req), readBy: meId(req) } }
  );
  res.json({ cleared: r.modifiedCount, unread: 0 });
}