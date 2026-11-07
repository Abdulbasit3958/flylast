import type { Subscription } from '@/lib/domain';
import { db, handle, requireUser, rows } from '@/lib/server';

export const POST = handle(async (req) => {
  const user = await requireUser(req, ['traveller']);
  const active = rows<Subscription>(
    await db.collection('subscriptions').where('travellerUserId', '==', user.uid).get(),
  ).filter((s) => s.status === 'active');
  const batch = db.batch();
  active.forEach((s) => batch.update(db.doc(`subscriptions/${s.subscriptionId}`), { status: 'cancelled' }));
  await batch.commit();
  return { cancelled: active.length };
});
