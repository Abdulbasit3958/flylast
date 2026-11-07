import { adminAuth, db } from './firebase-admin';
import { agencyDenial, isOfferLive, isSubActive, offerDenial, type AppUser, type Offer, type Plan, type Role, type Subscription } from './domain';

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra?: object) {
    super(message);
  }
}

/** Wrap a route handler: JSON responses + HttpError → status code. */
export function handle<C>(fn: (req: Request, ctx: C) => Promise<unknown>) {
  return async (req: Request, ctx: C) => {
    try {
      const out = await fn(req, ctx);
      return out instanceof Response ? out : Response.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ error: e.message, ...e.extra }, { status: e.status });
      console.error(e);
      return Response.json({ error: 'Server error' }, { status: 500 });
    }
  };
}

export async function verifyUid(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token) throw new HttpError(401, 'Sign in required');
  try {
    return (await adminAuth.verifyIdToken(token)).uid;
  } catch {
    throw new HttpError(401, 'Invalid or expired session');
  }
}

/** The single authorization gate used by every protected route. */
export async function requireUser(req: Request, roles?: Role[], { allowPending = false } = {}) {
  const uid = await verifyUid(req);
  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists) throw new HttpError(403, 'Account profile not found');
  const user = snap.data() as AppUser;
  if (roles && !roles.includes(user.role)) throw new HttpError(403, 'Not available for your account type');
  if (user.status !== 'approved' && !allowPending) throw new HttpError(403, 'Account awaiting admin approval');
  return user;
}

export async function readBody<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}

const rows = <T>(q: FirebaseFirestore.QuerySnapshot) => q.docs.map((d) => d.data() as T);

export const getPlans = async () => rows<Plan>(await db.collection('subscription_plans').get()).sort((a, b) => a.monthlyPrice - b.monthlyPrice);

/** Traveller's current subscription (latest active, unexpired) and its plan. */
export async function getTravellerAccess(uid: string, now = Date.now()) {
  const subs = rows<Subscription>(await db.collection('subscriptions').where('travellerUserId', '==', uid).get());
  const sub = subs.filter((s) => isSubActive(s, now)).sort((a, b) => b.startDate - a.startDate)[0] ?? null;
  const plan = sub ? ((await db.doc(`subscription_plans/${sub.planId}`).get()).data() as Plan | undefined) ?? null : null;
  return { sub, plan, history: subs.sort((a, b) => b.startDate - a.startDate) };
}

/** Live offers, optionally only those the airline distributed to a given channel. */
export async function getLiveOffers(now = Date.now(), channel?: 'subscribers' | 'agencies') {
  const offers = rows<Offer>(await db.collection('flight_offers').where('status', '==', 'published').get());
  return offers
    .filter((o) => isOfferLive(o, now))
    .filter((o) => !channel || (channel === 'subscribers' ? o.distributeToSubscribers : o.distributeToAgencies))
    .sort((a, b) => a.departureTime - b.departureTime);
}

export async function getOffer(offerId: string) {
  const snap = await db.doc(`flight_offers/${offerId}`).get();
  if (!snap.exists) throw new HttpError(404, 'Offer not found');
  return snap.data() as Offer;
}

/**
 * Loads what doesn't change mid-request (subscription or agency authorization) and returns a
 * check to run against a fresh offer snapshot inside a transaction. Null = allowed.
 */
export async function bookingGate(user: AppUser, airlineId: string): Promise<(o: Offer, now: number) => string | null> {
  if (user.role === 'traveller') {
    const { sub, plan } = await getTravellerAccess(user.uid);
    return (o, now) => offerDenial(user, sub, plan, o, now);
  }
  if (user.role === 'agency') {
    const ok = (await db.doc(`agency_authorizations/${airlineId}_${user.uid}`).get()).data()?.active === true;
    return (o, now) => agencyDenial(o, ok, now);
  }
  return () => 'Only travellers and agencies can book';
}

export { db, rows };
