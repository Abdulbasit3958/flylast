import type { Audience, Offer } from './domain';

// What leaves the server. Locked views carry no price, seats or booking link.
export interface LockedOffer {
  offerId: string;
  airlineName: string;
  origin: string;
  destination: string;
  departureTime: number;
  discountPct: number;
  eligibleSubscriberTiers: Audience;
  locked: true;
  reason: string;
}
export type OpenOffer = Omit<Offer, 'bookingUrl' | 'floorPrice' | 'maxReleasableSeats' | 'airlineId' | 'seatState' | 'seatNumbers'> & { locked: false; discountPct: number };

const discountPct = (o: Offer) => Math.round((1 - o.offerPrice / o.baseFare) * 100);

export const lockedView = (o: Offer, reason: string): LockedOffer => ({
  offerId: o.offerId,
  airlineName: o.airlineName,
  origin: o.origin,
  destination: o.destination,
  departureTime: o.departureTime,
  discountPct: discountPct(o),
  eligibleSubscriberTiers: o.eligibleSubscriberTiers,
  locked: true,
  reason,
});

export const openView = (o: Offer): OpenOffer => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { bookingUrl, floorPrice, maxReleasableSeats, airlineId, seatState, seatNumbers, ...rest } = o;
  return { ...rest, locked: false, discountPct: discountPct(o) };
};
