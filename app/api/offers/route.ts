import { offerDenial } from '@/lib/domain';
import { getLiveOffers, getTravellerAccess, handle, requireUser } from '@/lib/server';
import { lockedView, openView } from '@/lib/views';

// Traveller offer feed: full details only where the subscription tier is eligible.
export const GET = handle(async (req) => {
  const user = await requireUser(req, ['traveller']);
  const now = Date.now();
  const [{ sub, plan }, offers] = await Promise.all([getTravellerAccess(user.uid, now), getLiveOffers(now, 'subscribers')]);
  return {
    offers: offers.map((o) => {
      const denial = offerDenial(user, sub, plan, o, now);
      return denial ? lockedView(o, denial) : openView(o);
    }),
  };
});
