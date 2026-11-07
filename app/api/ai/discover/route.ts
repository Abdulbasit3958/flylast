import { discoverDeals } from '@/lib/ai';
import { offerDenial } from '@/lib/domain';
import { getLiveOffers, getTravellerAccess, handle, HttpError, readBody, requireUser } from '@/lib/server';
import { openView } from '@/lib/views';

export const POST = handle(async (req) => {
  const user = await requireUser(req, ['traveller']);
  const { query } = await readBody<{ query: string }>(req);
  if (!query?.trim() || query.length > 300) throw new HttpError(400, 'Ask in 1–300 characters');
  const now = Date.now();
  const [{ sub, plan }, offers] = await Promise.all([getTravellerAccess(user.uid, now), getLiveOffers(now, 'subscribers')]);
  if (!plan?.aiEnabled) throw new HttpError(403, 'AI Deal Finder is included with Premium and Elite plans');

  const eligible = offers.filter((o) => !offerDenial(user, sub, plan, o, now));
  const { picks, engine } = await discoverDeals(query.trim(), eligible);
  const byId = new Map(eligible.map((o) => [o.offerId, o]));
  return { engine, results: picks.map((p) => ({ reason: p.reason, offer: openView(byId.get(p.offerId)!) })) };
});
