'use client';
import { BookDialog } from '@/components/book-dialog';
import { Reveal } from '@/components/motion';
import { Empty, Notice, OfferTicket, PageTitle, useLoad } from '@/components/ui';
import type { Offer } from '@/lib/domain';
import { api } from '@/lib/firebase-client';

export default function AgencyOffers() {
  const { data, error, reload } = useLoad(() => api<{ offers: Omit<Offer, 'bookingUrl'>[] }>('/api/agency/offers'));
  return (
    <>
      <PageTitle title="Authorized releases">
        Empty seats that airlines have released to agencies and authorized you to sell. Your agency pays no subscription. Price, seats and the booking window are
        set by the airline.
      </PageTitle>
      <Notice>{error}</Notice>
      {data && !data.offers.length && <Empty>No releases are open for your agency right now. Airlines authorize agencies from their FlyLast dashboard.</Empty>}
      <Reveal className="space-y-4">
        {data?.offers.map((o) => (
          <OfferTicket key={o.offerId} offer={o} hideTier action={<BookDialog offer={o} channel="agency" onBooked={reload} />} />
        ))}
      </Reveal>
    </>
  );
}
