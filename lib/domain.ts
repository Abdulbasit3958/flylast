// Pure domain rules shared by server (enforcement) and client (display only).
// No Firebase imports here — keep it testable with `npm test`.

export type Role = 'traveller' | 'airline' | 'agency' | 'admin';
export type UserStatus = 'pending' | 'approved' | 'rejected';
export type Audience = 'all' | 'premium_elite' | 'elite';

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  orgName?: string;
  role: Role;
  status: UserStatus;
  createdAt: number;
}

export interface Plan {
  planId: string;
  planName: string;
  monthlyPrice: number;
  currency: 'PKR';
  eligibleOfferTiers: Audience[];
  maxRouteWatches: number;
  aiEnabled: boolean;
  isActive: boolean;
}

export interface Subscription {
  subscriptionId: string;
  travellerUserId: string;
  planId: string;
  status: 'active' | 'cancelled';
  startDate: number;
  expiryDate: number;
  demoMode: boolean;
  priceAtPurchase: number;
}

export interface OfferInput {
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: number;
  baseFare: number;
  floorPrice: number;
  offerPrice: number;
  maxReleasableSeats: number;
  releasedSeats: number;
  releaseTime: number;
  expiryTime: number;
  bookingCutoff: number;
  eligibleSubscriberTiers: Audience;
  bookingUrl: string;
  /** Airline-chosen distribution channels for this release. */
  distributeToAgencies: boolean;
  distributeToSubscribers: boolean;
}

export interface Offer extends OfferInput {
  offerId: string;
  airlineId: string;
  airlineName: string;
  status: 'published' | 'paused';
  createdAt: number;
  bookedSeats?: number;
  /** Seat labels the airline released on this flight (booked ones included). */
  seatNumbers?: string[];
  /** Only non-open seats are stored. Expired holds count as open. */
  seatState?: SeatState;
}

export type Channel = 'subscriber' | 'agency';

export interface Booking {
  bookingId: string;
  reference: string;
  channel: Channel;
  userId: string;
  bookedBy: string;
  offerId: string;
  airlineId: string;
  airlineName: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: number;
  passengers: string[];
  seatNumbers: string[];
  seats: number;
  farePerSeat: number;
  total: number;
  contact: string;
  status: 'confirmed' | 'cancelled';
  createdAt: number;
  cancelledAt?: number;
}

/** Per-booking seat caps: travellers book for their party, agencies for a customer group. */
export const MAX_SEATS_PER_BOOKING: Record<Channel, number> = { subscriber: 4, agency: 9 };

/** Validates a booking request against what's still released. Returns an error message or null. */
export function bookingError(passengers: string[], contact: string, available: number, max: number): string | null {
  if (!passengers.length) return 'Add at least one passenger';
  if (passengers.some((p) => p.length < 2 || p.length > 60)) return 'Enter each passenger’s full name';
  if (passengers.length > max) return `You can book up to ${max} seats at a time`;
  if (!/^[+\d][\d\s-]{6,19}$|^\S+@\S+\.\S+$/.test(contact.trim())) return 'Enter a phone number or email for the booking';
  if (passengers.length > available) return available ? `Only ${available} seat${available === 1 ? '' : 's'} left` : 'Released seats are sold out';
  return null;
}

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
export const SUBSCRIPTION_DAYS = 30;

export const AIRPORTS: Record<string, string> = {
  KHI: 'Karachi',
  LHE: 'Lahore',
  ISB: 'Islamabad',
  PEW: 'Peshawar',
  MUX: 'Multan',
  DXB: 'Dubai',
  DOH: 'Doha',
  JED: 'Jeddah',
};

export const AUDIENCE_LABEL: Record<Audience, string> = {
  all: 'All Subscribers',
  premium_elite: 'Premium & Elite',
  elite: 'Elite Only',
};

/** The core business rule: only individual travellers may hold a subscription. */
export const canSubscribe = (user: Pick<AppUser, 'role'>) => user.role === 'traveller';

export const isSubActive = (sub: Subscription | null | undefined, now: number): sub is Subscription =>
  !!sub && sub.status === 'active' && sub.expiryDate > now;

/** Offer is on sale for *someone* right now (airline-controlled window + seats). */
export const isOfferLive = (o: Offer, now: number) =>
  o.status === 'published' &&
  o.releaseTime <= now &&
  now < o.expiryTime &&
  now < o.bookingCutoff &&
  o.releasedSeats > 0;

/** Why this user can't see full details / book this offer, or null if they can. */
export function offerDenial(
  user: Pick<AppUser, 'role'>,
  sub: Subscription | null,
  plan: Plan | null,
  offer: Offer,
  now: number,
): string | null {
  if (user.role !== 'traveller') return 'Offers are available to individual travellers only';
  if (!offer.distributeToSubscribers) return 'This release is not distributed to subscribers';
  if (!isSubActive(sub, now) || !plan || plan.planId !== sub.planId) return 'An active subscription is required';
  if (!plan.eligibleOfferTiers.includes(offer.eligibleSubscriberTiers))
    return `Reserved for ${AUDIENCE_LABEL[offer.eligibleSubscriberTiers]}`;
  if (offer.status !== 'published') return 'Offer is not available';
  if (now < offer.releaseTime) return 'Offer has not been released yet';
  if (now >= offer.expiryTime || now >= offer.bookingCutoff) return 'Offer has expired';
  if (offer.releasedSeats <= 0) return 'Released seats are sold out';
  return null;
}

/** Why an agency can't book this offer for a customer, or null if it can. */
export function agencyDenial(offer: Offer, airlineAuthorizedAgency: boolean, now: number): string | null {
  if (!airlineAuthorizedAgency) return 'Your agency is not authorized by this airline';
  if (!offer.distributeToAgencies) return 'This release is not distributed to agencies';
  if (!isOfferLive(offer, now)) return 'Offer is no longer available';
  return null;
}

export interface Check {
  rule: string;
  pass: boolean;
}

/** Revenue Protection Engine: airline-side guardrails an offer must pass before publishing. */
export function validateOffer(o: OfferInput): { ok: boolean; checks: Check[] } {
  const checks: Check[] = [
    { rule: 'Route has distinct origin and destination', pass: !!o.origin && !!o.destination && o.origin !== o.destination },
    { rule: 'Release price is at or above the minimum approved price', pass: o.offerPrice >= o.floorPrice },
    { rule: 'Release price is below the regular fare', pass: o.offerPrice > 0 && o.offerPrice < o.baseFare },
    { rule: 'Discount does not exceed 70% of the regular fare', pass: o.offerPrice >= o.baseFare * 0.3 },
    { rule: 'Released seats do not exceed the unsold seats on the flight', pass: o.releasedSeats >= 1 && o.releasedSeats <= o.maxReleasableSeats },
    { rule: 'Booking window opens before it closes', pass: o.releaseTime < o.expiryTime },
    { rule: 'Booking window closes at or before the booking cutoff', pass: o.expiryTime <= o.bookingCutoff },
    { rule: 'Booking cutoff is at least 2h before departure', pass: o.bookingCutoff <= o.departureTime - 2 * HOUR },
    { rule: 'Release is within the last-minute window (≤72h before departure)', pass: o.releaseTime >= o.departureTime - 72 * HOUR },
    { rule: 'Booking link is a valid https URL', pass: /^https:\/\/\S+$/.test(o.bookingUrl) },
    { rule: 'At least one distribution channel is selected', pass: o.distributeToAgencies || o.distributeToSubscribers },
  ];
  return { ok: checks.every((c) => c.pass), checks };
}

export const formatPKR = (n: number) => `PKR ${Math.round(n).toLocaleString('en-PK')}`;

/* ───────────── Seat map, holds ───────────── */

export const CABIN_ROWS = 30;
export const CABIN_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
export const EXIT_ROWS = [11, 12];
/** Seat hold length. Shorten with NEXT_PUBLIC_SEAT_HOLD_SECONDS to demo expiry live. */
export const HOLD_MS = (Number(process.env.NEXT_PUBLIC_SEAT_HOLD_SECONDS) || 600) * 1000;
export const HOLD_LABEL = HOLD_MS >= 120_000 ? `${Math.round(HOLD_MS / 60_000)} minutes` : `${HOLD_MS / 1000} seconds`;

export type SeatState = Record<string, { status: 'held' | 'booked'; by: string; until?: number }>;
export type SeatView = 'open' | 'mine' | 'held' | 'booked';

/**
 * Deterministic seat labels for a release, so the same offer always gets the same seats.
 * Unsold seats cluster in pairs and threes on one side of a row, as they do on real flights.
 */
export function generateSeatLabels(count: number, seed: string, exclude: Iterable<string> = []): string[] {
  const taken = new Set(exclude);
  let h = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) || 1;
  const next = () => (h = (h * 16807) % 2147483647);
  const out: string[] = [];
  for (let guard = 0; out.length < count && guard < 10_000; guard++) {
    const row = (next() % CABIN_ROWS) + 1;
    const side = next() % 2 ? 3 : 0;
    const run = 1 + (next() % 3); // 1–3 adjacent seats
    const start = next() % (4 - run);
    for (let c = start; c < start + run && out.length < count; c++) {
      const label = `${row}${CABIN_LETTERS[side + c]}`;
      if (!taken.has(label)) {
        taken.add(label);
        out.push(label);
      }
    }
  }
  return out;
}

/** Keep booked/held seats, then trim or grow open seats so `remaining` seats are still sellable. */
export function resizeSeats(seatNumbers: string[], state: SeatState, remaining: number, seed: string): string[] {
  const booked = seatNumbers.filter((s) => state[s]?.status === 'booked');
  const locked = seatNumbers.filter((s) => state[s]?.status === 'held');
  const open = seatNumbers.filter((s) => !state[s]);
  const openTarget = Math.max(remaining - locked.length, 0);
  const keptOpen = open.slice(0, openTarget);
  const extra = generateSeatLabels(openTarget - keptOpen.length, seed + seatNumbers.length, seatNumbers);
  return [...booked, ...locked, ...keptOpen, ...extra];
}

export function seatView(label: string, state: SeatState, uid: string, now: number): SeatView {
  const s = state[label];
  if (!s) return 'open';
  if (s.status === 'booked') return 'booked';
  if ((s.until ?? 0) <= now) return 'open';
  return s.by === uid ? 'mine' : 'held';
}

/** Can this user hold exactly these seats now? */
export function holdError(requested: string[], seatNumbers: string[], state: SeatState, uid: string, now: number, max: number): string | null {
  if (!requested.length) return 'Pick at least one seat';
  if (new Set(requested).size !== requested.length) return 'Each seat can only be picked once';
  if (requested.length > max) return `You can hold up to ${max} seats at a time`;
  const released = new Set(seatNumbers);
  const bad = requested.find((s) => !released.has(s));
  if (bad) return `Seat ${bad} isn't part of this release`;
  const gone = requested.find((s) => ['held', 'booked'].includes(seatView(s, state, uid, now)));
  if (gone) return `Seat ${gone} was just taken. Pick another seat.`;
  return null;
}

/** Drop expired holds so the stored map stays small. */
export const pruneSeatState = (state: SeatState, now: number): SeatState =>
  Object.fromEntries(Object.entries(state).filter(([, v]) => v.status === 'booked' || (v.until ?? 0) > now));

/* ───────────── Seat details & smart pick ───────────── */

export type SeatType = 'window' | 'middle' | 'aisle';
const seatRow = (label: string) => Number(label.slice(0, -1));
const seatCol = (label: string) => CABIN_LETTERS.indexOf(label.slice(-1) as (typeof CABIN_LETTERS)[number]);

export const seatType = (label: string): SeatType => (['A', 'F'].includes(label.slice(-1)) ? 'window' : ['C', 'D'].includes(label.slice(-1)) ? 'aisle' : 'middle');
export const isExitRow = (label: string) => EXIT_ROWS.includes(seatRow(label));
export const seatDescription = (label: string) =>
  `${seatType(label)[0].toUpperCase()}${seatType(label).slice(1)}${isExitRow(label) ? ', exit row with extra legroom' : ''}`;

const byPosition = (a: string, b: string) => seatRow(a) - seatRow(b) || seatCol(a) - seatCol(b);

/**
 * Best seats for a party of n: a contiguous run on one side of a row, then the same row across
 * the aisle, then two consecutive rows, then simply the front-most seats. Null if not enough open.
 */
export function pickTogether(open: string[], n: number): string[] | null {
  if (n < 1 || open.length < n) return null;
  const sorted = [...open].sort(byPosition);
  const rows = new Map<number, string[]>();
  for (const s of sorted) rows.set(seatRow(s), [...(rows.get(seatRow(s)) ?? []), s]);
  const rowNums = [...rows.keys()].sort((a, b) => a - b);

  for (const r of rowNums) {
    const seats = rows.get(r)!;
    for (const side of [[0, 1, 2], [3, 4, 5]]) {
      let run: string[] = [];
      for (const c of side) {
        const label = `${r}${CABIN_LETTERS[c]}`;
        run = seats.includes(label) ? [...run, label] : [];
        if (run.length === n) return run;
      }
    }
  }
  for (const r of rowNums) if (rows.get(r)!.length >= n) return rows.get(r)!.slice(0, n);
  for (const r of rowNums) {
    const pair = [...rows.get(r)!, ...(rows.get(r + 1) ?? [])];
    if (pair.length >= n) return pair.slice(0, n);
  }
  return sorted.slice(0, n);
}

/** Same row and no gaps (the aisle between C and D counts as adjacent). */
export function areTogether(labels: string[]): boolean {
  if (labels.length < 2) return true;
  const rows = new Set(labels.map(seatRow));
  if (rows.size > 1) return false;
  const cols = labels.map(seatCol).sort((a, b) => a - b);
  return cols.every((c, i) => i === 0 || c === cols[i - 1] + 1);
}

/** First open seat of a given type (front of the cabin first). */
export const pickByType = (open: string[], type: SeatType, exclude: string[] = []) =>
  [...open].sort(byPosition).find((s) => seatType(s) === type && !exclude.includes(s)) ?? null;
