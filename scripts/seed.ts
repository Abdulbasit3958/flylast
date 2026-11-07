// Resets demo data: plans, demo accounts, sample offers. Safe to re-run before every demo.
// Usage: npm run seed   (emulator by default; uses FIREBASE_SERVICE_ACCOUNT for a real project)
import { adminAuth, db } from '../lib/firebase-admin';
import { DAY, HOUR, generateSeatLabels, validateOffer, type AppUser, type Offer, type OfferInput, type Plan } from '../lib/domain';

const EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST;
// Real projects must use their own demo password (DEMO_PASSWORD); the public one is only for the emulator.
const PASSWORD = process.env.DEMO_PASSWORD || (EMULATOR ? 'demo1234' : '');
if (!PASSWORD || PASSWORD.length < 8) {
  console.error('Set DEMO_PASSWORD (8+ characters) to seed a real Firebase project.');
  process.exit(1);
}
if (!EMULATOR && !process.argv.includes('--yes')) {
  console.error(`This resets offers, bookings, subscriptions and watches in project "${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}". Re-run with --yes to confirm.`);
  process.exit(1);
}

const plans: Plan[] = [
  { planId: 'basic', planName: 'Basic', monthlyPrice: 199, currency: 'PKR', eligibleOfferTiers: ['all'], maxRouteWatches: 2, aiEnabled: false, isActive: true },
  { planId: 'premium', planName: 'Premium', monthlyPrice: 499, currency: 'PKR', eligibleOfferTiers: ['all', 'premium_elite'], maxRouteWatches: 5, aiEnabled: true, isActive: true },
  { planId: 'elite', planName: 'Elite', monthlyPrice: 999, currency: 'PKR', eligibleOfferTiers: ['all', 'premium_elite', 'elite'], maxRouteWatches: 20, aiEnabled: true, isActive: true },
];

const accounts: Omit<AppUser, 'uid' | 'createdAt'>[] = [
  { email: 'admin@flylast.demo', name: 'FlyLast Admin', role: 'admin', status: 'approved' },
  { email: 'airline@flylast.demo', name: 'Ops Desk', orgName: 'SkyIndus Airways', role: 'airline', status: 'approved' },
  { email: 'agency@flylast.demo', name: 'Sales Desk', orgName: 'Safar Travels', role: 'agency', status: 'approved' },
  { email: 'pending-airline@flylast.demo', name: 'Ops', orgName: 'Margalla Air', role: 'airline', status: 'pending' },
  { email: 'traveller@flylast.demo', name: 'Ayesha Khan', role: 'traveller', status: 'approved' },
];

async function upsertUser(a: (typeof accounts)[number]) {
  const existing = await adminAuth.getUserByEmail(a.email).catch(() => null);
  const uid = existing?.uid ?? (await adminAuth.createUser({ email: a.email, password: PASSWORD, displayName: a.name })).uid;
  await db.doc(`users/${uid}`).set({ ...a, uid, createdAt: Date.now() });
  return uid;
}

async function wipe(name: string) {
  const snap = await db.collection(name).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

/** Remove accounts created during earlier demo runs so user counts start clean. */
async function removeNonSeedUsers() {
  const keep = new Set(accounts.map((a) => a.email));
  const { users } = await adminAuth.listUsers(1000);
  const extra = users.filter((u) => !keep.has(u.email ?? ''));
  if (extra.length) await adminAuth.deleteUsers(extra.map((u) => u.uid));
  const docs = await db.collection('users').get();
  await Promise.all(docs.docs.filter((d) => !keep.has(d.data().email)).map((d) => d.ref.delete()));
  return extra.length;
}

async function main() {
  // Deleting other accounts is only safe on the emulator (or when explicitly asked for).
  const removed = EMULATOR || process.argv.includes('--reset-users') ? await removeNonSeedUsers() : 0;
  await Promise.all(['subscription_plans', 'subscriptions', 'flight_offers', 'bookings', 'booking_intents', 'route_watches', 'agency_authorizations'].map(wipe));
  await Promise.all(plans.map((p) => db.doc(`subscription_plans/${p.planId}`).set(p)));
  const uids = Object.fromEntries(await Promise.all(accounts.map(async (a) => [a.email, await upsertUser(a)] as const)));

  const airlineId = uids['airline@flylast.demo'];
  await db.doc(`agency_authorizations/${airlineId}_${uids['agency@flylast.demo']}`).set({ airlineId, agencyId: uids['agency@flylast.demo'], active: true });

  const now = Date.now();
  const offer = (f: string, o: string, d: string, depH: number, base: number, price: number, seats: number, tier: Offer['eligibleSubscriberTiers'], agencies = true, subscribers = true): OfferInput => ({
    flightNumber: f, origin: o, destination: d, departureTime: now + depH * HOUR,
    baseFare: base, floorPrice: Math.round(base * 0.4), offerPrice: price,
    maxReleasableSeats: seats + 4, releasedSeats: seats,
    releaseTime: now - HOUR, expiryTime: now + (depH - 4) * HOUR, bookingCutoff: now + (depH - 3) * HOUR,
    eligibleSubscriberTiers: tier, bookingUrl: `https://example.com/skyindus/book?flight=${f}`,
    distributeToAgencies: agencies, distributeToSubscribers: subscribers,
  });
  const samples = [
    offer('SI-301', 'KHI', 'LHE', 20, 24000, 13900, 6, 'all'),
    offer('SI-118', 'ISB', 'KHI', 30, 26000, 15500, 4, 'all'),
    offer('SI-722', 'LHE', 'DXB', 40, 68000, 41000, 3, 'elite'),
    offer('SI-415', 'PEW', 'DOH', 48, 72000, 45000, 5, 'premium_elite'),
    offer('SI-209', 'MUX', 'JED', 60, 95000, 61000, 6, 'all', true, false), // agency-only release
  ];
  for (const s of samples) {
    if (!validateOffer(s).ok) throw new Error(`Seed offer ${s.flightNumber} fails revenue protection`);
    const ref = db.collection('flight_offers').doc();
    await ref.set({ ...s, offerId: ref.id, airlineId, airlineName: 'SkyIndus Airways', status: 'published', createdAt: now - DAY, seatNumbers: generateSeatLabels(s.releasedSeats, ref.id), seatState: {} } satisfies Offer);
  }

  console.log(`Seeded ${plans.length} plans, ${samples.length} offers, removed ${removed} old demo accounts. Logins (password ${EMULATOR ? `"${PASSWORD}"` : 'from DEMO_PASSWORD'}):`);
  accounts.forEach((a) => console.log(`  ${a.role.padEnd(9)} ${a.email}${a.status === 'pending' ? '  (pending approval)' : ''}`));
}

main().then(() => process.exit(0), (e) => (console.error(e), process.exit(1)));
