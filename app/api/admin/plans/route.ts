import { AUDIENCE_LABEL, type Audience, type Plan } from '@/lib/domain';
import { db, getPlans, handle, HttpError, readBody, requireUser } from '@/lib/server';

export const GET = handle(async (req) => {
  await requireUser(req, ['admin']);
  return { plans: await getPlans() };
});

// Plan configuration. Existing subscriptions keep their priceAtPurchase.
export const PATCH = handle(async (req) => {
  await requireUser(req, ['admin']);
  const b = await readBody<Partial<Plan> & { planId: string }>(req);
  const ref = db.doc(`subscription_plans/${b.planId}`);
  if (!(await ref.get()).exists) throw new HttpError(404, 'Plan not found');
  const tiers = (b.eligibleOfferTiers ?? []) as Audience[];
  const patch = {
    planName: String(b.planName ?? '').trim(),
    monthlyPrice: Number(b.monthlyPrice),
    maxRouteWatches: Number(b.maxRouteWatches),
    aiEnabled: !!b.aiEnabled,
    isActive: !!b.isActive,
    eligibleOfferTiers: tiers,
  };
  if (!patch.planName) throw new HttpError(400, 'Plan name is required');
  if (!(patch.monthlyPrice > 0) || !(patch.maxRouteWatches >= 0)) throw new HttpError(400, 'Price and watch limit must be positive numbers');
  if (!tiers.length || !tiers.every((t) => t in AUDIENCE_LABEL)) throw new HttpError(400, 'Pick at least one offer tier');
  await ref.update(patch);
  return { ok: true };
});
