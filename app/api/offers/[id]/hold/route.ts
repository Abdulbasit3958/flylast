import { HOLD_MS, holdError, MAX_SEATS_PER_BOOKING, pruneSeatState, type Offer, type SeatState } from '@/lib/domain';
import { bookingGate, db, handle, HttpError, readBody, requireUser } from '@/lib/server';

type Ctx = { params: Promise<{ id: string }> };

const withoutMyHolds = (state: SeatState, uid: string): SeatState =>
  Object.fromEntries(Object.entries(state).filter(([, v]) => !(v.status === 'held' && v.by === uid)));

// Holds exact seats for HOLD_MS so nobody else can take them while the user enters passenger details.
// Replaces any earlier hold by the same user on this flight.
export const POST = handle(async (req, { params }: Ctx) => {
  const user = await requireUser(req, ['traveller', 'agency']);
  const { seats } = await readBody<{ seats?: unknown[] }>(req);
  const requested = (Array.isArray(seats) ? seats : []).map(String);
  const ref = db.doc(`flight_offers/${(await params).id}`);
  const gate = await bookingGate(user, (await ref.get()).data()?.airlineId);
  const max = MAX_SEATS_PER_BOOKING[user.role === 'agency' ? 'agency' : 'subscriber'];

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpError(404, 'Offer not found');
    const offer = snap.data() as Offer;
    const now = Date.now();
    const denial = gate(offer, now);
    if (denial) throw new HttpError(403, denial);

    const state = withoutMyHolds(pruneSeatState(offer.seatState ?? {}, now), user.uid);
    const err = holdError(requested, offer.seatNumbers ?? [], state, user.uid, now, max);
    if (err) throw new HttpError(err.includes('taken') ? 409 : 400, err);

    const until = now + HOLD_MS;
    for (const s of requested) state[s] = { status: 'held', by: user.uid, until };
    tx.update(ref, { seatState: state });
    return { seats: requested, holdMs: HOLD_MS };
  });
});

// Releases this user's hold (closing the dialog or picking different seats).
export const DELETE = handle(async (req, { params }: Ctx) => {
  const user = await requireUser(req, ['traveller', 'agency']);
  const ref = db.doc(`flight_offers/${(await params).id}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const offer = snap.data() as Offer;
    tx.update(ref, { seatState: withoutMyHolds(pruneSeatState(offer.seatState ?? {}, Date.now()), user.uid) });
  });
  return { ok: true };
});
