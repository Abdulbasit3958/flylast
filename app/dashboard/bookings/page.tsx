'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/components/auth';
import { Reveal } from '@/components/motion';
import { Button, cx, Empty, fmtTime, Notice, PageTitle, useLoad } from '@/components/ui';
import { AIRPORTS, formatPKR, type Booking } from '@/lib/domain';
import { api } from '@/lib/firebase-client';

const COPY = {
  traveller: { title: 'My bookings', intro: 'Seats you booked through FlyLast. Show your booking reference at check-in.', empty: 'No bookings yet.', cta: ['/dashboard/offers', 'Find released seats'] },
  agency: { title: 'Agency bookings', intro: 'Seats your agency booked for customers.', empty: 'Your agency hasn’t booked any seats yet.', cta: ['/dashboard/agency-offers', 'See authorized releases'] },
  airline: { title: 'Bookings & passenger manifest', intro: 'Every seat booked on your releases, from agencies and FlyLast subscribers.', empty: 'No seats booked on your releases yet.', cta: ['/dashboard/airline-offers', 'Release empty seats'] },
} as const;

export default function Bookings() {
  const { me } = useAuth();
  const role = me?.user?.role as keyof typeof COPY;
  const copy = COPY[role] ?? COPY.traveller;
  const { data, error, reload, setError } = useLoad(() => api<{ bookings: Booking[] }>('/api/bookings'));
  const [confirming, setConfirming] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const all = data?.bookings ?? [];
  const list = all.filter((b) => b.status !== 'cancelled');
  const seats = list.reduce((s, b) => s + b.seats, 0);
  const value = list.reduce((s, b) => s + b.total, 0);
  const canManage = role === 'traveller' || role === 'agency';

  async function cancel(b: Booking) {
    setError('');
    try {
      await api(`/api/bookings/${b.bookingId}/cancel`, { method: 'POST' });
      setMsg(`Booking ${b.reference} cancelled. Seat${b.seats > 1 ? 's' : ''} ${b.seatNumbers?.join(', ')} went back on sale.`);
      setConfirming(null);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <PageTitle title={copy.title}>{copy.intro}</PageTitle>
      <Notice>{error}</Notice>
      <div className="mb-3"><Notice tone="ok">{msg}</Notice></div>
      {list.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Stat label="Bookings" value={list.length} />
          <Stat label="Seats" value={seats} />
          <Stat label={role === 'airline' ? 'Fare value to you' : 'Total fares'} value={formatPKR(value)} />
        </div>
      )}
      {data && !all.length && (
        <Empty>
          {copy.empty} <Link href={copy.cta[0]} className="font-semibold text-navy underline">{copy.cta[1]}</Link>
        </Empty>
      )}
      <Reveal className="space-y-3">
        {all.map((b) => {
          const cancelled = b.status === 'cancelled';
          return (
          <article key={b.bookingId} className={cx('grid gap-4 rounded-lg border border-line bg-card p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center', cancelled && 'opacity-60')}>
            <div className={cx('rounded-md px-4 py-3 text-center text-white', cancelled ? 'bg-mute' : 'bg-navy')}>
              <p className="text-xs text-white/60">Reference</p>
              <p className="font-display text-2xl font-bold tracking-wider text-sign">{b.reference}</p>
            </div>
            <div className="min-w-0">
              <p className="font-display text-2xl font-bold text-navy">
                {b.origin} › {b.destination} <span className="text-lg font-semibold text-mute">{b.flightNumber}</span>
              </p>
              <p className="text-sm text-mute">
                {AIRPORTS[b.origin]} to {AIRPORTS[b.destination]}, departs {fmtTime(b.departureTime)}
                {role !== 'airline' && `, ${b.airlineName}`}
              </p>
              <p className="mt-1 text-sm"><span className="text-mute">Passengers:</span> {b.passengers.map((p, i) => (b.seatNumbers?.[i] ? `${p} (${b.seatNumbers[i]})` : p)).join(', ')}</p>
              {role === 'airline' && (
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                  <span className={cx('rounded px-2 py-0.5 font-semibold', b.channel === 'agency' ? 'bg-sky/15 text-[#1f6fa5]' : 'bg-sign/30 text-navy')}>
                    {b.channel === 'agency' ? `Agency: ${b.bookedBy}` : 'FlyLast subscriber'}
                  </span>
                  <span className="text-mute">Contact {b.contact}</span>
                </p>
              )}
            </div>
            <div className="sm:text-right">
              <p className={cx('font-display text-2xl font-bold text-navy', cancelled && 'line-through')}>{formatPKR(b.total)}</p>
              <p className="text-sm text-mute">{b.seats} × {formatPKR(b.farePerSeat)}</p>
              {cancelled ? (
                <p className="text-sm font-semibold text-stop">Cancelled {fmtTime(b.cancelledAt ?? b.createdAt)}</p>
              ) : (
                <p className="text-sm font-semibold text-go">Confirmed {fmtTime(b.createdAt)}</p>
              )}
              {!cancelled && (
                <div className="mt-2 flex flex-wrap gap-2 sm:justify-end">
                  <Link href={`/ticket/${b.bookingId}`} target="_blank" className="rounded-md bg-sign px-3 py-1 text-sm font-semibold text-navy hover:brightness-95">View e-ticket</Link>
                  {canManage && (confirming === b.bookingId ? (
                    <>
                      <Button variant="danger" className="px-3 py-1 text-sm" onClick={() => cancel(b)}>Yes, cancel</Button>
                      <Button variant="ghost" className="px-3 py-1 text-sm" onClick={() => setConfirming(null)}>Keep</Button>
                    </>
                  ) : (
                    <Button variant="danger" className="px-3 py-1 text-sm" onClick={() => setConfirming(b.bookingId)}>Cancel booking</Button>
                  ))}
                </div>
              )}
            </div>
          </article>
          );
        })}
      </Reveal>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-line bg-card p-4">
      <p className="text-sm text-mute">{label}</p>
      <p className="font-display text-3xl font-bold text-navy">{value}</p>
    </div>
  );
}
