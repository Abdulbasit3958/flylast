import { seatView, type SeatView } from '@/lib/domain';
import { bookingGate, getOffer, handle, HttpError, requireUser } from '@/lib/server';

// Seat map for an eligible traveller/agency. Only open/held/booked/mine leaves the server — never who holds a seat.
export const GET = handle(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req, ['traveller', 'agency']);
  const offer = await getOffer((await params).id);
  const now = Date.now();
  const denial = (await bookingGate(user, offer.airlineId))(offer, now);
  if (denial) throw new HttpError(403, denial);

  const state = offer.seatState ?? {};
  const seats: Record<string, SeatView> = {};
  let holdUntil = 0;
  for (const s of offer.seatNumbers ?? []) {
    seats[s] = seatView(s, state, user.uid, now);
    if (seats[s] === 'mine') holdUntil = Math.max(holdUntil, state[s].until ?? 0);
  }
  return { seats, holdMs: holdUntil ? holdUntil - now : 0, fare: offer.offerPrice };
});
