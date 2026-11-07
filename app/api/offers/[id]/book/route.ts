import { FieldValue } from 'firebase-admin/firestore';
import { bookingError, pruneSeatState, seatView, type Booking, type Offer } from '@/lib/domain';
import { bookingGate, db, handle, HttpError, readBody, requireUser } from '@/lib/server';

const REF_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const reference = () => 'FL' + Array.from({ length: 6 }, () => REF_CHARS[(Math.random() * REF_CHARS.length) | 0]).join('');

// Books seats the caller is currently holding. Eligibility, the hold and seat counts are all
// re-checked inside one transaction, so an expired hold or a taken seat can never be sold.
export const POST = handle(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req, ['traveller', 'agency']);
  const body = await readBody<{ seats?: unknown[]; passengers?: unknown[]; contact?: unknown }>(req);
  const seats = (Array.isArray(body.seats) ? body.seats : []).map(String);
  const passengers = (Array.isArray(body.passengers) ? body.passengers : []).map((p) => String(p).trim()).filter(Boolean);
  const contact = String(body.contact ?? '').trim();
  const channel = user.role === 'traveller' ? 'subscriber' : 'agency';
  const ref = db.doc(`flight_offers/${(await params).id}`);
  const gate = await bookingGate(user, (await ref.get()).data()?.airlineId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpError(404, 'Offer not found');
    const offer = snap.data() as Offer;
    const now = Date.now();

    const denial = gate(offer, now);
    if (denial) throw new HttpError(403, denial);
    const state = pruneSeatState(offer.seatState ?? {}, now);
    if (!seats.length || seats.some((s) => seatView(s, state, user.uid, now) !== 'mine'))
      throw new HttpError(409, 'Your seat hold expired or doesn’t cover these seats. Pick your seats again.');
    if (passengers.length !== seats.length) throw new HttpError(400, 'Enter one passenger name per seat');
    const err = bookingError(passengers, contact, offer.releasedSeats, seats.length);
    if (err) throw new HttpError(400, err);

    for (const s of seats) state[s] = { status: 'booked', by: user.uid };
    const bookingRef = db.collection('bookings').doc();
    const booking: Booking = {
      bookingId: bookingRef.id,
      reference: reference(),
      channel,
      userId: user.uid,
      bookedBy: user.orgName ?? user.name,
      offerId: offer.offerId,
      airlineId: offer.airlineId,
      airlineName: offer.airlineName,
      flightNumber: offer.flightNumber,
      origin: offer.origin,
      destination: offer.destination,
      departureTime: offer.departureTime,
      passengers,
      seatNumbers: seats,
      seats: seats.length,
      farePerSeat: offer.offerPrice,
      total: seats.length * offer.offerPrice,
      contact,
      status: 'confirmed',
      createdAt: now,
    };
    tx.update(ref, {
      seatState: state,
      releasedSeats: FieldValue.increment(-seats.length),
      maxReleasableSeats: FieldValue.increment(-seats.length), // booked seats are no longer unsold
      bookedSeats: FieldValue.increment(seats.length),
    });
    tx.create(bookingRef, booking);
    return { booking, ticketingUrl: offer.bookingUrl };
  });
});
