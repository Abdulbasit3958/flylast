import { db, getLiveOffers, handle, requireUser, rows } from '@/lib/server';

// Read-only: verified agencies see live releases that an airline both distributed to agencies
// and authorized this agency for. Booking goes through /api/offers/[id]/book so it's tracked.
export const GET = handle(async (req) => {
  const user = await requireUser(req, ['agency']);
  const auths = rows<{ airlineId: string; active: boolean }>(
    await db.collection('agency_authorizations').where('agencyId', '==', user.uid).get(),
  );
  const airlines = new Set(auths.filter((a) => a.active).map((a) => a.airlineId));
  const offers = (await getLiveOffers(Date.now(), 'agencies')).filter((o) => airlines.has(o.airlineId));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return { offers: offers.map(({ floorPrice, maxReleasableSeats, bookingUrl, seatState, seatNumbers, ...o }) => o) };
});
