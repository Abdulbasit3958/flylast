import { getLiveOffers, handle } from '@/lib/server';
import { lockedView } from '@/lib/views';

// Public promotional teaser: no price, no seats, no booking link.
export const GET = handle(async () => ({ offers: (await getLiveOffers(Date.now(), 'subscribers')).slice(0, 6).map((o) => lockedView(o, '')) }));
