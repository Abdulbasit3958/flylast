import { FieldValue } from 'firebase-admin/firestore';
import { pruneSeatState, type Booking, type Offer } from '@/lib/domain';
import { db, handle, HttpError, requireUser } from '@/lib/server';

// Owner cancels before the airline's booking cutoff. The exact seats go back on sale
// in the same transaction, so the seat map and airline manifest stay consistent.
export const POST = handle(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req, ['traveller', 'agency']);
  const bookingRef = db.doc(`bookings/${(await params).id}`);

  return db.runTransaction(async (tx) => {
    const bSnap = await tx.get(bookingRef);
    const booking = bSnap.data() as Booking | undefined;
    if (!booking || booking.userId !== user.uid) throw new HttpError(404, 'Booking not found');
    if (booking.status === 'cancelled') throw new HttpError(409, 'This booking is already cancelled');

    const offerRef = db.doc(`flight_offers/${booking.offerId}`);
    const offer = (await tx.get(offerRef)).data() as Offer | undefined;
    const now = Date.now();
    if (!offer || now >= offer.bookingCutoff) throw new HttpError(409, 'The airline’s booking cutoff has passed. Contact the airline to change this booking.');

    const seatState = pruneSeatState(offer.seatState ?? {}, now);
    for (const s of booking.seatNumbers ?? []) delete seatState[s];
    tx.update(offerRef, {
      seatState,
      releasedSeats: FieldValue.increment(booking.seats),
      maxReleasableSeats: FieldValue.increment(booking.seats),
      bookedSeats: FieldValue.increment(-booking.seats),
    });
    tx.update(bookingRef, { status: 'cancelled', cancelledAt: now });
    return { ok: true };
  });
});
