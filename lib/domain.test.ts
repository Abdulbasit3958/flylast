import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agencyDenial, areTogether, bookingError, isExitRow, pickByType, pickTogether, seatDescription, seatType, canSubscribe, generateSeatLabels, holdError, resizeSeats, seatView, type SeatState, offerDenial, validateOffer, DAY, HOUR, type Offer, type Plan, type Subscription } from './domain';

const now = Date.UTC(2026, 10, 7, 12);
const plan = (planId: string, tiers: Plan['eligibleOfferTiers']): Plan => ({
  planId, planName: planId, monthlyPrice: 1, currency: 'PKR', eligibleOfferTiers: tiers, maxRouteWatches: 5, aiEnabled: true, isActive: true,
});
const basic = plan('basic', ['all']);
const premium = plan('premium', ['all', 'premium_elite']);
const sub = (planId: string, over: Partial<Subscription> = {}): Subscription => ({
  subscriptionId: 's', travellerUserId: 'u', planId, status: 'active', startDate: now - DAY, expiryDate: now + DAY, demoMode: true, priceAtPurchase: 1, ...over,
});
const offer: Offer = {
  offerId: 'o', airlineId: 'a', airlineName: 'A', status: 'published', createdAt: now,
  flightNumber: 'FL1', origin: 'KHI', destination: 'ISB', departureTime: now + 10 * HOUR,
  baseFare: 30000, floorPrice: 12000, offerPrice: 15000, maxReleasableSeats: 10, releasedSeats: 4,
  releaseTime: now - HOUR, expiryTime: now + 5 * HOUR, bookingCutoff: now + 6 * HOUR,
  eligibleSubscriberTiers: 'premium_elite', bookingUrl: 'https://airline.example/book',
  distributeToAgencies: true, distributeToSubscribers: true,
};
const traveller = { role: 'traveller' as const };

test('only travellers can subscribe', () => {
  assert.equal(canSubscribe(traveller), true);
  for (const role of ['airline', 'agency', 'admin'] as const) assert.equal(canSubscribe({ role }), false);
});

test('eligible premium traveller gets access', () => {
  assert.equal(offerDenial(traveller, sub('premium'), premium, offer, now), null);
});

test('denials', () => {
  for (const role of ['airline', 'agency', 'admin'] as const)
    assert.match(offerDenial({ role }, sub('premium'), premium, offer, now)!, /travellers only/);
  assert.match(offerDenial(traveller, null, null, offer, now)!, /subscription/);
  assert.match(offerDenial(traveller, sub('premium', { expiryDate: now }), premium, offer, now)!, /subscription/);
  assert.match(offerDenial(traveller, sub('premium', { status: 'cancelled' }), premium, offer, now)!, /subscription/);
  assert.match(offerDenial(traveller, sub('premium'), basic, offer, now)!, /subscription/); // plan/sub mismatch
  assert.match(offerDenial(traveller, sub('basic'), basic, offer, now)!, /Premium & Elite/);
  assert.match(offerDenial(traveller, sub('premium'), premium, { ...offer, status: 'paused' }, now)!, /not available/);
  assert.match(offerDenial(traveller, sub('premium'), premium, { ...offer, releaseTime: now + 1 }, now)!, /not been released/);
  assert.match(offerDenial(traveller, sub('premium'), premium, { ...offer, expiryTime: now }, now)!, /expired/);
  assert.match(offerDenial(traveller, sub('premium'), premium, { ...offer, bookingCutoff: now }, now)!, /expired/);
  assert.match(offerDenial(traveller, sub('premium'), premium, { ...offer, releasedSeats: 0 }, now)!, /sold out/);
  assert.match(offerDenial(traveller, sub('premium'), premium, { ...offer, distributeToSubscribers: false }, now)!, /not distributed to subscribers/);
});

test('agency channel', () => {
  assert.equal(agencyDenial(offer, true, now), null);
  assert.match(agencyDenial(offer, false, now)!, /not authorized/);
  assert.match(agencyDenial({ ...offer, distributeToAgencies: false }, true, now)!, /not distributed to agencies/);
  assert.match(agencyDenial({ ...offer, expiryTime: now }, true, now)!, /no longer/);
});

test('booking request', () => {
  assert.equal(bookingError(['Ayesha Khan'], '0300 1234567', 4, 4), null);
  assert.equal(bookingError(['A Khan'], 'a@b.co', 1, 4), null);
  assert.match(bookingError([], '0300 1234567', 4, 4)!, /at least one/);
  assert.match(bookingError(['A', 'Bob Ali'], '0300 1234567', 4, 4)!, /full name/);
  assert.match(bookingError(Array(5).fill('Pax Name'), '0300 1234567', 9, 4)!, /up to 4/);
  assert.match(bookingError(['Pax Name', 'Pax Two'], '0300 1234567', 1, 4)!, /Only 1 seat left/);
  assert.match(bookingError(['Pax Name'], '0300 1234567', 0, 4)!, /sold out/);
  assert.match(bookingError(['Pax Name'], 'nope', 4, 4)!, /phone number or email/);
});

test('revenue protection', () => {
  assert.equal(validateOffer(offer).ok, true);
  const fails = (o: Partial<Offer>) => validateOffer({ ...offer, ...o }).checks.filter((c) => !c.pass).map((c) => c.rule);
  assert.match(fails({ offerPrice: 11000 })[0], /minimum approved/);
  assert.match(fails({ offerPrice: 8000, floorPrice: 5000 })[0], /70%/);
  assert.match(fails({ releasedSeats: 11 })[0], /unsold seats/);
  assert.match(fails({ bookingCutoff: offer.departureTime - HOUR })[0], /2h/);
  assert.match(fails({ releaseTime: offer.departureTime - 73 * HOUR })[0], /72h/);
  assert.match(fails({ expiryTime: offer.bookingCutoff + 1 })[0], /cutoff/);
  assert.match(fails({ bookingUrl: 'javascript:alert(1)' })[0], /https/);
  assert.match(fails({ distributeToAgencies: false, distributeToSubscribers: false })[0], /channel/);
});

test('seat labels are deterministic and unique', () => {
  const a = generateSeatLabels(8, 'offer-1');
  assert.deepEqual(a, generateSeatLabels(8, 'offer-1'));
  assert.equal(new Set(a).size, 8);
  assert.ok(a.every((l) => /^([1-9]|[12]\d|30)[A-F]$/.test(l)));
  assert.ok(generateSeatLabels(3, 'x', a).every((l) => !a.includes(l)));
  assert.equal(generateSeatLabels(40, 'cluster').length, 40);
  // Releases cluster: a 14-seat release should offer at least one pair side by side.
  const rel = generateSeatLabels(14, 'flight-x');
  assert.ok(rel.some((l) => rel.some((m) => m !== l && areTogether([l, m]))));
});

test('seat holds', () => {
  const seats = ['1A', '1B', '2C', '3D'];
  const state: SeatState = {
    '1A': { status: 'booked', by: 'u1' },
    '1B': { status: 'held', by: 'u2', until: now + 1000 },
    '2C': { status: 'held', by: 'me', until: now + 1000 },
    '3D': { status: 'held', by: 'u2', until: now - 1 }, // expired
  };
  assert.equal(seatView('1A', state, 'me', now), 'booked');
  assert.equal(seatView('1B', state, 'me', now), 'held');
  assert.equal(seatView('2C', state, 'me', now), 'mine');
  assert.equal(seatView('3D', state, 'me', now), 'open');
  assert.equal(holdError(['2C', '3D'], seats, state, 'me', now, 4), null);
  assert.match(holdError(['1B'], seats, state, 'me', now, 4)!, /just taken/);
  assert.match(holdError(['1A'], seats, state, 'me', now, 4)!, /just taken/);
  assert.match(holdError(['9F'], seats, state, 'me', now, 4)!, /isn't part/);
  assert.match(holdError(['3D', '3D'], seats, state, 'me', now, 4)!, /once/);
  assert.match(holdError(['2C', '3D'], seats, state, 'me', now, 1)!, /up to 1/);
  assert.match(holdError([], seats, state, 'me', now, 4)!, /at least one/);
});

test('resizing a release keeps booked and held seats', () => {
  const state: SeatState = { '1A': { status: 'booked', by: 'u' }, '1B': { status: 'held', by: 'u', until: now + 1 } };
  const seats = ['1A', '1B', '2A', '2B', '2C'];
  const down = resizeSeats(seats, state, 2, 's'); // 1 held + 1 open remain sellable
  assert.deepEqual(down, ['1A', '1B', '2A']);
  const up = resizeSeats(seats, state, 6, 's');
  assert.equal(up.length, 7);
  assert.ok(up.includes('1A') && up.includes('1B'));
});

test('seat details', () => {
  assert.equal(seatType('3A'), 'window');
  assert.equal(seatType('3B'), 'middle');
  assert.equal(seatType('3D'), 'aisle');
  assert.equal(isExitRow('11C'), true);
  assert.equal(seatDescription('12F'), 'Window, exit row with extra legroom');
});

test('pick seats together', () => {
  // Row 5 has a 3-run on the right; row 2 only scattered seats.
  assert.deepEqual(pickTogether(['2A', '2C', '5D', '5E', '5F', '9A'], 3), ['5D', '5E', '5F']);
  assert.deepEqual(pickTogether(['2A', '2C', '5D', '5E', '5F'], 2), ['5D', '5E']);
  // No 4-run on one side: same row across the aisle.
  assert.deepEqual(pickTogether(['7B', '7C', '7D', '7E', '1A'], 4), ['7B', '7C', '7D', '7E']);
  // Spread over consecutive rows.
  assert.deepEqual(pickTogether(['8A', '8F', '9C', '20B'], 3), ['8A', '8F', '9C']);
  assert.equal(pickTogether(['1A'], 2), null);
  assert.equal(areTogether(['5D', '5E', '5F']), true);
  assert.equal(areTogether(['7C', '7D']), true); // across the aisle
  assert.equal(areTogether(['8A', '8F']), false);
  assert.equal(areTogether(['8A', '9A']), false);
  assert.equal(pickByType(['4B', '6F', '2C'], 'window'), '6F');
  assert.equal(pickByType(['4B', '6F', '2C'], 'aisle'), '2C');
  assert.equal(pickByType(['2C'], 'aisle', ['2C']), null);
});
