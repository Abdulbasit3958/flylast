'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/components/auth';
import { BookDialog } from '@/components/book-dialog';
import { Button, Empty, Notice, OfferTicket, PageTitle } from '@/components/ui';
import { api } from '@/lib/firebase-client';
import type { OpenOffer } from '@/lib/views';

type Result = { engine: 'gemini' | 'fallback'; results: { reason: string; offer: OpenOffer }[] };
const EXAMPLES = ['Cheapest way to Doha this week', 'Karachi to Lahore under 15,000', 'Anything from Islamabad tomorrow'];

export default function AiFinder() {
  const { me } = useAuth();
  const [query, setQuery] = useState('');
  const [res, setRes] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function ask(q = query) {
    setQuery(q);
    setBusy(true);
    setError('');
    try {
      setRes(await api<Result>('/api/ai/discover', { body: { query: q } }));
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  if (!me?.plan?.aiEnabled) {
    return (
      <>
        <PageTitle title="AI Deal Finder" />
        <Empty>
          Describe your trip in plain words and Gemini picks the best released seats for you. Included with Premium and Elite.{' '}
          <Link href="/dashboard/subscription" className="font-semibold text-navy underline">Upgrade your plan</Link>
        </Empty>
      </>
    );
  }

  return (
    <>
      <PageTitle title="AI Deal Finder">Describe the trip you want. Gemini searches only the offers your plan can book.</PageTitle>
      <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="q">Your trip</label>
        <input id="q" maxLength={300} required value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Weekend in Dubai under 50,000"
          className="flex-1 rounded-md border border-line bg-card px-4 py-3 text-lg focus:border-navy focus:outline-none" />
        <Button type="submit" variant="primary" disabled={busy} className="py-3">{busy ? 'Searching…' : 'Find deals'}</Button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {EXAMPLES.map((e) => (
          <button key={e} type="button" onClick={() => ask(e)} className="rounded-full border border-line bg-card px-3 py-1 text-mute hover:border-navy hover:text-ink">{e}</button>
        ))}
      </div>
      <div className="mt-4"><Notice>{error}</Notice></div>
      {res && (
        <section className="mt-6 space-y-4" aria-live="polite">
          <p className="text-sm text-mute">{res.engine === 'gemini' ? 'Picked by Gemini' : 'Gemini isn’t configured, so these are keyword matches'}</p>
          {!res.results.length && <Empty>No released seats in your plan match that. Try another city or a higher budget.</Empty>}
          {res.results.map(({ reason, offer }) => (
            <OfferTicket key={offer.offerId} offer={offer} action={<BookDialog offer={offer} channel="subscriber" />}
              footer={<p className="mt-2 border-l-4 border-sign pl-3 text-sm">{reason}</p>} />
          ))}
        </section>
      )}
    </>
  );
}
