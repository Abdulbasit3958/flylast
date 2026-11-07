import type { AppUser } from '@/lib/domain';
import { db, handle, HttpError, readBody, requireUser, rows } from '@/lib/server';

export const GET = handle(async (req) => {
  await requireUser(req, ['admin']);
  const users = rows<AppUser>(await db.collection('users').get());
  const order = { pending: 0, approved: 1, rejected: 2 };
  return { users: users.sort((a, b) => order[a.status] - order[b.status] || b.createdAt - a.createdAt) };
});

// Approve / reject business (airline, agency) registrations.
export const POST = handle(async (req) => {
  await requireUser(req, ['admin']);
  const { uid, status } = await readBody<{ uid: string; status: AppUser['status'] }>(req);
  if (status !== 'approved' && status !== 'rejected') throw new HttpError(400, 'Invalid status');
  const ref = db.doc(`users/${uid}`);
  const target = (await ref.get()).data() as AppUser | undefined;
  if (target?.role !== 'airline' && target?.role !== 'agency') throw new HttpError(400, 'Only airline and agency accounts need approval');
  await ref.update({ status });
  return { ok: true };
});
