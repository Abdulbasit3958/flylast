import { offerDenial } from '@/lib/domain';
import { db, getLiveOffers, getTravellerAccess, handle, requireUser, rows } from '@/lib/server';
import { openView } from '@/lib/views';

// Notifications are derived, not stored: released offers on watched routes that this traveller's tier can access.
// ponytail: computed per request; persist + push (FCM) when real-time delivery is needed.
export const GET = handle(async (req) => {
  const user = await requireUser(req, ['traveller']);
  const now = Date.now();
  const [{ sub, plan }, offers, watches] = await Promise.all([
    getTravellerAccess(user.uid, now),
    getLiveOffers(now, 'subscribers'),
    db.collection('route_watches').where('travellerUserId', '==', user.uid).get(),
  ]);
  const routes = new Set(rows<{ origin: string; destination: string }>(watches).map((w) => `${w.origin}-${w.destination}`));
  return {
    notifications: offers
      .filter((o) => routes.has(`${o.origin}-${o.destination}`) && !offerDenial(user, sub, plan, o, now))
      .sort((a, b) => b.releaseTime - a.releaseTime)
      .map(openView),
  };
});
