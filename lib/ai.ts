import { GoogleGenAI } from '@google/genai';
import { AIRPORTS, formatPKR, type Offer } from './domain';

export type Pick = { offerId: string; reason: string };

// Only ever called with offers the traveller is already eligible for, so the model can't leak restricted deals.
export async function discoverDeals(query: string, offers: Offer[]): Promise<{ picks: Pick[]; engine: 'gemini' | 'fallback' }> {
  if (!offers.length) return { picks: [], engine: 'fallback' };
  const key = process.env.GEMINI_API_KEY;
  if (key) {
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const catalog = offers.map((o) => ({
        offerId: o.offerId,
        route: `${AIRPORTS[o.origin]} (${o.origin}) → ${AIRPORTS[o.destination]} (${o.destination})`,
        airline: o.airlineName,
        departure: new Date(o.departureTime).toISOString(),
        price: o.offerPrice,
        baseFare: o.baseFare,
        seatsLeft: o.releasedSeats,
      }));
      const res = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
        contents:
          `You are FlyLast's deal finder for Pakistani travellers. Prices are in PKR. Current time: ${new Date().toISOString()}.\n` +
          `Traveller request: ${JSON.stringify(query)}\n` +
          `Available offers (choose ONLY from these): ${JSON.stringify(catalog)}\n` +
          `Return JSON: {"picks":[{"offerId":string,"reason":string}]} with up to 3 best matches, best first. ` +
          `Reasons: one short friendly sentence. Return {"picks":[]} if nothing fits.`,
        config: { responseMimeType: 'application/json', temperature: 0.2 },
      });
      const ids = new Set(offers.map((o) => o.offerId));
      const picks = ((JSON.parse(res.text ?? '{}').picks ?? []) as Pick[]).filter((p) => ids.has(p.offerId)).slice(0, 3);
      return { picks, engine: 'gemini' };
    } catch (e) {
      console.error('Gemini failed, using fallback', e);
    }
  }
  return { picks: fallback(query, offers), engine: 'fallback' };
}

/** Keyword finder: matches city names/codes and an optional "under N" budget. */
export function fallback(query: string, offers: Offer[]): Pick[] {
  const q = query.toLowerCase();
  const budget = Number(q.match(/(?:under|below|max|<)\s*(?:pkr|rs\.?)?\s*([\d,]+)/)?.[1]?.replace(/,/g, '')) || Infinity;
  const mentions = (code: string) => q.includes(code.toLowerCase()) || q.includes(AIRPORTS[code].toLowerCase());
  return offers
    .filter((o) => o.offerPrice <= budget)
    .map((o) => ({ o, score: (mentions(o.origin) ? 2 : 0) + (mentions(o.destination) ? 3 : 0) + (1 - o.offerPrice / o.baseFare) }))
    .filter((x) => x.score >= 2 || !/[a-z]{3,}/.test(q.replace(/under|below|max|pkr|cheap|deal|flight|rs/g, '')))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ o }) => ({
      offerId: o.offerId,
      reason: `${AIRPORTS[o.origin]} → ${AIRPORTS[o.destination]} for ${formatPKR(o.offerPrice)} (${Math.round((1 - o.offerPrice / o.baseFare) * 100)}% off), ${o.releasedSeats} seats left.`,
    }));
}
