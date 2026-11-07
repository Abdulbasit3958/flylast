import { isOfferLive, isSubActive, type AppUser, type Booking, type Offer, type Subscription } from '@/lib/domain';
import { db, getPlans, handle, requireUser, rows } from '@/lib/server';

// FlyLast revenue = individual traveller subscriptions only. Airlines & agencies pay nothing.
// Fares on bookings are the airline's money and are reported separately.
// ponytail: aggregated on demand; add a rollup doc once collections grow past ~10k docs.
export const GET = handle(async (req) => {
  await requireUser(req, ['admin']);
  const now = Date.now();
  const [usersQ, subsQ, offersQ, bookingsQ] = await Promise.all(
    ['users', 'subscriptions', 'flight_offers', 'bookings'].map((c) => db.collection(c).get()),
  );
  const plans = await getPlans();
  const users = rows<AppUser>(usersQ);
  const travellers = new Set(users.filter((u) => u.role === 'traveller').map((u) => u.uid));
  const subs = rows<Subscription>(subsQ).filter((s) => travellers.has(s.travellerUserId));
  const active = subs.filter((s) => isSubActive(s, now));
  const offers = rows<Offer>(offersQ);
  const live = offers.filter((o) => isOfferLive(o, now));
  const all = rows<Booking>(bookingsQ).sort((a, b) => b.createdAt - a.createdAt);
  const bookings = all.filter((b) => b.status !== 'cancelled');
  const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);
  const tally = <T,>(xs: T[], key: (x: T) => string, val: (x: T) => number = () => 1) =>
    xs.reduce<Record<string, number>>((m, x) => ((m[key(x)] = (m[key(x)] ?? 0) + val(x)), m), {});

  return {
    revenue: {
      totalBilled: sum(subs, (s) => s.priceAtPurchase),
      monthlyRecurring: sum(active, (s) => s.priceAtPurchase),
      activeSubscribers: active.length,
      byPlan: plans.map((p) => ({
        planId: p.planId,
        planName: p.planName,
        active: active.filter((s) => s.planId === p.planId).length,
        revenue: sum(subs.filter((s) => s.planId === p.planId), (s) => s.priceAtPurchase),
      })),
    },
    users: {
      total: users.length,
      byRole: tally(users, (u) => u.role),
      pending: users.filter((u) => u.status === 'pending').length,
      travellersWithoutPlan: travellers.size - new Set(active.map((s) => s.travellerUserId)).size,
    },
    marketplace: {
      offers: offers.length,
      liveOffers: live.length,
      releasedSeats: sum(live, (o) => o.releasedSeats),
      bookings: bookings.length,
      seatsBooked: sum(bookings, (b) => b.seats),
      seatsByChannel: tally(bookings, (b) => b.channel, (b) => b.seats),
      seatsByRoute: tally(bookings, (b) => `${b.origin}-${b.destination}`, (b) => b.seats),
      fareValueToAirlines: sum(bookings, (b) => b.total),
      cancelled: all.length - bookings.length,
      recentBookings: all.slice(0, 8),
    },
  };
});
