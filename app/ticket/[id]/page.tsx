'use client';
import Link from 'next/link';
import { use, useRef } from 'react';
import { useAuth } from '@/components/auth';
import { Logo } from '@/components/brand';
import { gsap, MOTION_OK, useGSAP } from '@/components/motion';
import { Button, cx, fmtTime, Notice, useLoad } from '@/components/ui';
import { AIRPORTS, formatPKR, seatDescription, type Booking } from '@/lib/domain';
import { api } from '@/lib/firebase-client';

const DOMESTIC = new Set(['KHI', 'LHE', 'ISB', 'PEW', 'MUX']);

export default function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { fbUser, loading } = useAuth();
  if (loading) return <p className="p-8 text-mute">Loading e-ticket…</p>;
  if (!fbUser)
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <Logo />
        <p className="mt-6 text-mute">Sign in to view this e-ticket.</p>
        <Link href="/login" className="mt-4 inline-block rounded-md bg-navy px-4 py-2 font-semibold text-white">Sign in</Link>
      </main>
    );
  return <Ticket id={id} />;
}

function Ticket({ id }: { id: string }) {
  const { data, error } = useLoad(() => api<{ booking: Booking }>(`/api/bookings/${id}`), [id]);
  const ref = useRef<HTMLDivElement>(null);
  const b = data?.booking;

  useGSAP(
    () => {
      if (!b) return;
      gsap.matchMedia().add(MOTION_OK, () => {
        gsap.from('[data-pass]', { y: 30, rotateX: -25, autoAlpha: 0, duration: 0.7, stagger: 0.12, ease: 'power3.out', transformOrigin: 'top' });
      });
    },
    { scope: ref, dependencies: [b] },
  );

  if (error) return <main className="mx-auto max-w-xl px-4 py-16"><Notice>{error}</Notice></main>;
  if (!b) return <p className="p-8 text-mute">Loading e-ticket…</p>;

  const cancelled = b.status === 'cancelled';
  const domestic = DOMESTIC.has(b.origin) && DOMESTIC.has(b.destination);
  return (
    <main ref={ref} className="mx-auto max-w-4xl px-4 py-8 print:max-w-none print:p-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Logo />
        <div className="flex gap-2">
          <Link href="/dashboard/bookings" className="rounded-md border border-line bg-card px-4 py-2 font-semibold hover:border-mute">Back to bookings</Link>
          {!cancelled && <Button variant="primary" onClick={() => window.print()}>Print / Save as PDF</Button>}
        </div>
      </div>

      <header className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-4xl font-bold text-navy">E-ticket</h1>
          <p className="text-mute">{b.airlineName}, booked through FlyLast on {fmtTime(b.createdAt)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-mute">Booking reference</p>
          <p className="font-display text-4xl font-bold tracking-wider text-navy">{b.reference}</p>
        </div>
      </header>

      {cancelled && <Notice>This booking was cancelled on {fmtTime(b.cancelledAt ?? b.createdAt)}. It is not valid for travel.</Notice>}

      <div className="mt-4 space-y-5">
        {b.passengers.map((p, i) => (
          <article key={p + i} data-pass className={cx('relative flex flex-col overflow-hidden rounded-xl border-2 border-navy bg-card break-inside-avoid sm:flex-row', cancelled && 'opacity-60')}>
            {cancelled && (
              <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center font-display text-7xl font-bold text-stop/25 -rotate-12">Cancelled</span>
            )}
            <div className="flex-1">
              <div className="flex items-center justify-between bg-navy px-5 py-2 text-white print:bg-white print:text-navy">
                <span className="font-display text-lg font-semibold">{b.airlineName}</span>
                <span className="text-sm">Boarding pass {i + 1} of {b.passengers.length}</span>
              </div>
              <div className="p-5">
                <div className="flex items-end gap-4 text-navy">
                  <div>
                    <p className="font-display text-6xl font-bold leading-none">{b.origin}</p>
                    <p className="text-sm text-mute">{AIRPORTS[b.origin]}</p>
                  </div>
                  <span aria-hidden className="mb-6 flex-1 border-t-2 border-dashed border-line" />
                  <div className="text-right">
                    <p className="font-display text-6xl font-bold leading-none">{b.destination}</p>
                    <p className="text-sm text-mute">{AIRPORTS[b.destination]}</p>
                  </div>
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
                  <Item label="Passenger" value={p} />
                  <Item label="Flight" value={b.flightNumber} />
                  <Item label="Departs" value={fmtTime(b.departureTime)} />
                  <Item label="Fare" value={formatPKR(b.farePerSeat)} />
                  <Item label="Booked via" value={b.channel === 'agency' ? b.bookedBy : 'FlyLast subscriber'} />
                  <Item label="Contact" value={b.contact} />
                  <Item label="Status" value={cancelled ? 'Cancelled' : 'Confirmed'} />
                  <Item label="Travel document" value={domestic ? 'CNIC' : 'Passport'} />
                </dl>
              </div>
            </div>
            <div className="flex w-full flex-row items-center justify-around gap-4 border-t-2 border-dashed border-navy p-5 text-center sm:w-48 sm:flex-col sm:justify-center sm:border-l-2 sm:border-t-0">
              <div>
                <p className="text-sm text-mute">Seat</p>
                <p className="font-display text-6xl font-bold leading-none text-navy">{b.seatNumbers?.[i] ?? '—'}</p>
                {b.seatNumbers?.[i] && <p className="mt-1 text-xs text-mute">{seatDescription(b.seatNumbers[i])}</p>}
              </div>
              <div>
                <p className="text-sm text-mute">Reference</p>
                <p className="font-display text-2xl font-bold tracking-wider text-navy">{b.reference}</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <section className="mt-6 rounded-lg border border-line bg-card p-5 text-sm break-inside-avoid">
        <h2 className="font-display text-xl font-semibold text-navy">Before you fly</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Show booking reference <strong>{b.reference}</strong> at the {b.airlineName} check-in counter.</li>
          <li>Carry your original {domestic ? 'CNIC (or passport)' : 'passport and any visa needed for the destination'}. Names must match this ticket.</li>
          <li>Arrive early. Check-in and boarding cut-off times are set by {b.airlineName}.</li>
          <li>Total paid: {formatPKR(b.total)} for {b.seats} seat{b.seats > 1 && 's'}. Demo booking: no payment was taken.</li>
        </ul>
      </section>
    </main>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-mute">{label}</dt>
      <dd className="truncate font-semibold">{value}</dd>
    </div>
  );
}
