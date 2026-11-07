'use client';
import Link from 'next/link';
import { useAuth } from '@/components/auth';
import { BookDialog } from '@/components/book-dialog';
import { Reveal } from '@/components/motion';
import { Empty, Notice, OfferTicket, PageTitle, useLoad } from '@/components/ui';
import { api } from '@/lib/firebase-client';
import type { LockedOffer, OpenOffer } from '@/lib/views';

export default function Offers() {
  const { me } = useAuth();
  const { data, error, reload } = useLoad(() => api<{ offers: (LockedOffer | OpenOffer)[] }>('/api/offers'));
  const open = data?.offers.filter((o) => !o.locked) ?? [];
  const locked = data?.offers.filter((o) => o.locked) ?? [];

  return (
    <>
      <PageTitle title="Exclusive offers">
        Seats airlines have released for FlyLast subscribers right now. Fares and booking links are set by the airline.
      </PageTitle>
      {!me?.plan && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-sign bg-card p-4">
          <p>You don&apos;t have an active plan, so every fare is hidden.</p>
          <Link href="/dashboard/subscription" className="rounded-md bg-navy px-4 py-2 font-semibold text-white">Choose a plan</Link>
        </div>
      )}
      <Notice>{error}</Notice>
      {data && !data.offers.length && <Empty>No seats are released right now. Watch a route and we&apos;ll show it in Notifications when one appears.</Empty>}
      <Reveal className="space-y-4">
        {open.map((o) => (
          <OfferTicket key={o.offerId} offer={o} action={<BookDialog offer={o} channel="subscriber" onBooked={reload} />} />
        ))}
      </Reveal>
      {locked.length > 0 && (
        <>
          <h2 className="mb-3 mt-10 font-display text-2xl font-semibold text-navy">Not in your plan</h2>
          <div className="space-y-4">
            {locked.map((o) => (
              <OfferTicket key={o.offerId} offer={o}
                action={<Link href="/dashboard/subscription" className="text-center text-sm font-semibold underline">See plans</Link>} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
