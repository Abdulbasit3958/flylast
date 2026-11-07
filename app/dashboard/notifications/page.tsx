'use client';
import Link from 'next/link';
import { BookDialog } from '@/components/book-dialog';
import { Reveal } from '@/components/motion';
import { Empty, fmtTime, Notice, OfferTicket, PageTitle, useLoad } from '@/components/ui';
import { api } from '@/lib/firebase-client';
import type { OpenOffer } from '@/lib/views';

export default function Notifications() {
  const { data, error, reload } = useLoad(() => api<{ notifications: OpenOffer[] }>('/api/notifications'));
  return (
    <>
      <PageTitle title="Notifications">Released seats on your watched routes that your plan can book.</PageTitle>
      <Notice>{error}</Notice>
      {data && !data.notifications.length && (
        <Empty>
          Nothing new on your routes. <Link href="/dashboard/watches" className="font-semibold text-navy underline">Add a watched route</Link>
        </Empty>
      )}
      <Reveal className="space-y-4">
        {data?.notifications.map((o) => (
          <OfferTicket key={o.offerId} offer={o} action={<BookDialog offer={o} channel="subscriber" onBooked={reload} />}
            footer={<p className="mt-2 text-sm font-semibold text-go">Released {fmtTime(o.releaseTime)} on a route you watch</p>} />
        ))}
      </Reveal>
    </>
  );
}
