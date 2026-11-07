import { isSubActive, type AppUser, type Subscription } from '@/lib/domain';
import { db, handle, HttpError, readBody, requireUser, rows } from '@/lib/server';

export const GET = handle(async (req) => {
  await requireUser(req, ['admin']);
  const [subs, users] = await Promise.all([
    db.collection('subscriptions').get(),
    db.collection('users').where('role', '==', 'traveller').get(),
  ]);
  const names = new Map(rows<AppUser>(users).map((u) => [u.uid, u]));
  const now = Date.now();
  return {
    subscriptions: rows<Subscription>(subs)
      .sort((a, b) => b.startDate - a.startDate)
      .map((s) => ({
        ...s,
        travellerName: names.get(s.travellerUserId)?.name ?? '—',
        travellerEmail: names.get(s.travellerUserId)?.email ?? '—',
        isActive: isSubActive(s, now),
      })),
  };
});

export const POST = handle(async (req) => {
  await requireUser(req, ['admin']);
  const { subscriptionId } = await readBody<{ subscriptionId: string }>(req);
  const ref = db.doc(`subscriptions/${subscriptionId}`);
  if (!(await ref.get()).exists) throw new HttpError(404, 'Subscription not found');
  await ref.update({ status: 'cancelled' });
  return { ok: true };
});
