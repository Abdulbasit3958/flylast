import { AIRPORTS } from '@/lib/domain';
import { db, getTravellerAccess, handle, HttpError, readBody, requireUser, rows } from '@/lib/server';

type Watch = { id: string; travellerUserId: string; origin: string; destination: string; createdAt: number };

const list = async (uid: string) =>
  rows<Watch>(await db.collection('route_watches').where('travellerUserId', '==', uid).get()).sort((a, b) => a.createdAt - b.createdAt);

export const GET = handle(async (req) => {
  const user = await requireUser(req, ['traveller']);
  const [watches, { plan }] = await Promise.all([list(user.uid), getTravellerAccess(user.uid)]);
  return { watches, limit: plan?.maxRouteWatches ?? 0 };
});

export const POST = handle(async (req) => {
  const user = await requireUser(req, ['traveller']);
  const { origin, destination } = await readBody<{ origin: string; destination: string }>(req);
  if (!(origin in AIRPORTS) || !(destination in AIRPORTS) || origin === destination) throw new HttpError(400, 'Pick two different airports');
  const [watches, { plan }] = await Promise.all([list(user.uid), getTravellerAccess(user.uid)]);
  if (!plan) throw new HttpError(403, 'An active subscription is required to watch routes');
  if (watches.length >= plan.maxRouteWatches) throw new HttpError(403, `${plan.planName} allows ${plan.maxRouteWatches} watched routes`);
  if (watches.some((w) => w.origin === origin && w.destination === destination)) throw new HttpError(409, 'Already watching this route');
  const ref = db.collection('route_watches').doc();
  const watch: Watch = { id: ref.id, travellerUserId: user.uid, origin, destination, createdAt: Date.now() };
  await ref.create(watch);
  return { watch };
});

export const DELETE = handle(async (req) => {
  const user = await requireUser(req, ['traveller']);
  const { id } = await readBody<{ id: string }>(req);
  const ref = db.doc(`route_watches/${id}`);
  if ((await ref.get()).data()?.travellerUserId !== user.uid) throw new HttpError(404, 'Watch not found');
  await ref.delete();
  return { ok: true };
});
