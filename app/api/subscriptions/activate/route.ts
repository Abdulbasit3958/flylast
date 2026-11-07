import { canSubscribe, DAY, SUBSCRIPTION_DAYS, type Plan, type Subscription } from '@/lib/domain';
import { db, handle, HttpError, readBody, requireUser, rows } from '@/lib/server';

// Server-controlled demo activation. Only individual travellers may subscribe.
export const POST = handle(async (req) => {
  const user = await requireUser(req, ['traveller']);
  if (!canSubscribe(user)) throw new HttpError(403, 'Only individual travellers can subscribe');

  const { planId } = await readBody<{ planId: string }>(req);
  const plan = (await db.doc(`subscription_plans/${planId}`).get()).data() as Plan | undefined;
  if (!plan?.isActive) throw new HttpError(400, 'Plan is not available');

  const now = Date.now();
  const ref = db.collection('subscriptions').doc();
  const sub: Subscription = {
    subscriptionId: ref.id,
    travellerUserId: user.uid,
    planId,
    status: 'active',
    startDate: now,
    expiryDate: now + SUBSCRIPTION_DAYS * DAY,
    demoMode: true,
    priceAtPurchase: plan.monthlyPrice,
  };
  const existing = rows<Subscription>(
    await db.collection('subscriptions').where('travellerUserId', '==', user.uid).get(),
  ).filter((s) => s.status === 'active');

  const batch = db.batch();
  existing.forEach((s) => batch.update(db.doc(`subscriptions/${s.subscriptionId}`), { status: 'cancelled' }));
  batch.create(ref, sub);
  await batch.commit();
  return { subscription: sub, plan };
});
