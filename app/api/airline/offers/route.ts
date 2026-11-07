import { AIRPORTS, AUDIENCE_LABEL, generateSeatLabels, pruneSeatState, resizeSeats, validateOffer, type Audience, type Offer, type OfferInput } from '@/lib/domain';
import { db, handle, HttpError, readBody, requireUser, rows } from '@/lib/server';

const NUM = ['departureTime', 'baseFare', 'floorPrice', 'offerPrice', 'maxReleasableSeats', 'releasedSeats', 'releaseTime', 'expiryTime', 'bookingCutoff'] as const;

function parseOffer(b: Record<string, unknown>): OfferInput {
  const o = {} as OfferInput;
  for (const k of NUM) {
    const n = Number(b[k]);
    if (!Number.isFinite(n)) throw new HttpError(400, `${k} must be a number`);
    o[k] = n;
  }
  o.flightNumber = String(b.flightNumber ?? '').trim().toUpperCase();
  o.origin = String(b.origin ?? '');
  o.destination = String(b.destination ?? '');
  o.bookingUrl = String(b.bookingUrl ?? '').trim();
  o.eligibleSubscriberTiers = b.eligibleSubscriberTiers as Audience;
  o.distributeToAgencies = b.distributeToAgencies === true;
  o.distributeToSubscribers = b.distributeToSubscribers === true;
  if (!o.flightNumber) throw new HttpError(400, 'Flight number is required');
  if (!(o.origin in AIRPORTS) || !(o.destination in AIRPORTS)) throw new HttpError(400, 'Unknown airport');
  if (!(o.eligibleSubscriberTiers in AUDIENCE_LABEL)) throw new HttpError(400, 'Invalid subscriber tier');
  return o;
}

/** Revenue Protection Engine gate: invalid offers are never stored. */
function protect(o: OfferInput) {
  const v = validateOffer(o);
  if (!v.ok) throw new HttpError(422, 'Revenue Protection Engine rejected this offer', { checks: v.checks });
  return v;
}

export const GET = handle(async (req) => {
  const user = await requireUser(req, ['airline']);
  const offers = rows<Offer>(await db.collection('flight_offers').where('airlineId', '==', user.uid).get());
  return { offers: offers.sort((a, b) => b.createdAt - a.createdAt) };
});

export const POST = handle(async (req) => {
  const user = await requireUser(req, ['airline']);
  const input = parseOffer(await readBody(req));
  const validation = protect(input);
  const ref = db.collection('flight_offers').doc();
  const offer: Offer = {
    ...input,
    offerId: ref.id,
    airlineId: user.uid,
    airlineName: user.orgName ?? user.name,
    status: 'published',
    createdAt: Date.now(),
    seatNumbers: generateSeatLabels(input.releasedSeats, ref.id),
    seatState: {},
  };
  await ref.create(offer);
  return { offer, validation };
});

// Airline keeps control: edit price/seats/timing or pause/resume its own offers.
export const PATCH = handle(async (req) => {
  const user = await requireUser(req, ['airline']);
  const body = await readBody<Record<string, unknown> & { offerId: string }>(req);
  const ref = db.doc(`flight_offers/${String(body.offerId)}`);
  // Transaction: an edit must never overwrite seats booked or held a moment earlier.
  const offer = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpError(404, 'Offer not found');
    const current = snap.data() as Offer;
    if (current.airlineId !== user.uid) throw new HttpError(403, 'Not your offer');
    const status = body.status ?? current.status;
    if (status !== 'published' && status !== 'paused') throw new HttpError(400, 'Invalid status');
    const input = parseOffer({ ...current, ...body });
    protect(input);
    const seatState = pruneSeatState(current.seatState ?? {}, Date.now());
    const seatNumbers = resizeSeats(current.seatNumbers ?? generateSeatLabels(current.releasedSeats, current.offerId), seatState, input.releasedSeats, current.offerId);
    const next = { ...input, status, seatNumbers, seatState };
    tx.update(ref, next);
    return { ...current, ...next };
  });
  return { offer };
});
