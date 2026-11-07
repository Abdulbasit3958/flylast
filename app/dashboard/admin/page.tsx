'use client';
import Link from 'next/link';
import { Reveal } from '@/components/motion';
import { fmtTime, Notice, PageTitle, useLoad } from '@/components/ui';
import { formatPKR, type Booking } from '@/lib/domain';
import { api } from '@/lib/firebase-client';

type Stats = {
  revenue: { totalBilled: number; monthlyRecurring: number; activeSubscribers: number; byPlan: { planId: string; planName: string; active: number; revenue: number }[] };
  users: { total: number; byRole: Record<string, number>; pending: number; travellersWithoutPlan: number };
  marketplace: {
    offers: number; liveOffers: number; releasedSeats: number; bookings: number; seatsBooked: number;
    seatsByChannel: Record<string, number>; seatsByRoute: Record<string, number>; fareValueToAirlines: number; cancelled: number;
    recentBookings: Booking[];
  };
};

function Tile({ label, value, note }: { label: string; value: string | number; note?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-card p-4">
      <p className="text-sm text-mute">{label}</p>
      <p className="font-display text-4xl font-bold text-navy">{value}</p>
      {note && <p className="text-sm text-mute">{note}</p>}
    </div>
  );
}

/** Single-series horizontal bars, direct-labeled; native title gives the hover readout. */
function Bars({ rows, format = String }: { rows: { label: string; value: number }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="text-sm text-mute">No data yet.</p>;
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} title={`${r.label}: ${format(r.value)}`}>
            <th scope="row" className="w-28 py-1.5 pr-3 text-left font-semibold">{r.label}</th>
            <td className="py-1.5">
              <div className="flex items-center gap-2">
                <div className="h-3 rounded-r-[4px] bg-navy" style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value ? 4 : 0 }} />
                <span className="whitespace-nowrap text-ink">{format(r.value)}</span>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="mb-3 font-display text-2xl font-semibold text-navy">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}

export default function AdminOverview() {
  const { data: s, error } = useLoad(() => api<Stats>('/api/admin/stats'));
  return (
    <>
      <PageTitle title="Revenue & activity">
        FlyLast earns from individual traveller subscriptions only. Airlines and travel agencies participate free.
      </PageTitle>
      <Notice>{error}</Notice>
      {s && (
        <Reveal>
          <Row title="Users">
            <Tile label="Total users" value={s.users.total}
              note={s.users.pending
                ? <Link href="/dashboard/admin-approvals" className="font-semibold text-stop underline">{s.users.pending} business account{s.users.pending > 1 && 's'} awaiting approval</Link>
                : <Link href="/dashboard/admin-approvals" className="underline">See everyone</Link>} />
            <Tile label="Travellers" value={s.users.byRole.traveller ?? 0} note={`${s.users.travellersWithoutPlan} without an active plan`} />
            <Tile label="Airlines" value={s.users.byRole.airline ?? 0} note="Free accounts" />
            <Tile label="Travel agencies" value={s.users.byRole.agency ?? 0} note="Free accounts" />
          </Row>

          <Row title="FlyLast revenue (traveller subscriptions)">
            <Tile label="Total billed" value={formatPKR(s.revenue.totalBilled)} note="All activations, demo mode" />
            <Tile label="Monthly recurring" value={formatPKR(s.revenue.monthlyRecurring)} note="From active subscriptions" />
            <Tile label="Active subscribers" value={s.revenue.activeSubscribers} />
            <Tile label="Revenue per subscriber" value={formatPKR(s.revenue.activeSubscribers ? s.revenue.monthlyRecurring / s.revenue.activeSubscribers : 0)} note="Monthly average" />
          </Row>

          <Row title="Marketplace">
            <Tile label="Live releases" value={s.marketplace.liveOffers} note={`${s.marketplace.releasedSeats} seats still open`} />
            <Tile label="Bookings" value={s.marketplace.bookings} note={`${s.marketplace.seatsBooked} seats booked${s.marketplace.cancelled ? `, ${s.marketplace.cancelled} cancelled` : ''}`} />
            <Tile label="Seats by channel" value={`${s.marketplace.seatsByChannel.subscriber ?? 0} / ${s.marketplace.seatsByChannel.agency ?? 0}`} note="Subscribers / agencies" />
            <Tile label="Fare value to airlines" value={formatPKR(s.marketplace.fareValueToAirlines)} note="Airlines' money, not FlyLast revenue" />
          </Row>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section className="rounded-lg border border-line bg-card p-5">
              <h2 className="font-display text-2xl font-semibold text-navy">Revenue by plan</h2>
              <p className="mb-3 text-sm text-mute">PKR billed per traveller plan</p>
              <Bars rows={s.revenue.byPlan.map((p) => ({ label: p.planName, value: p.revenue }))} format={formatPKR} />
              <p className="mt-3 text-sm text-mute">Active: {s.revenue.byPlan.map((p) => `${p.planName} ${p.active}`).join(', ')}</p>
            </section>
            <section className="rounded-lg border border-line bg-card p-5">
              <h2 className="font-display text-2xl font-semibold text-navy">Seats booked by route</h2>
              <p className="mb-3 text-sm text-mute">Empty seats that found a passenger</p>
              <Bars rows={Object.entries(s.marketplace.seatsByRoute).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))} />
            </section>
          </div>

          <section className="mt-6 rounded-lg border border-line bg-card p-5">
            <h2 className="mb-3 font-display text-2xl font-semibold text-navy">Recent bookings</h2>
            {!s.marketplace.recentBookings.length ? (
              <p className="text-sm text-mute">No seats booked yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="text-mute"><tr><th className="py-1 font-medium">Reference</th><th className="font-medium">Flight</th><th className="font-medium">Booked by</th><th className="font-medium">Seats</th><th className="text-right font-medium">Fare total</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {s.marketplace.recentBookings.map((b) => (
                      <tr key={b.bookingId}>
                        <td className="py-2 font-semibold tracking-wide">{b.reference}<br /><span className="font-normal text-mute">{fmtTime(b.createdAt)}</span></td>
                        <td>{b.flightNumber} {b.origin}›{b.destination}</td>
                        <td>{b.channel === 'agency' ? `Agency: ${b.bookedBy}` : `Subscriber: ${b.bookedBy}`}</td>
                        <td>{b.seats}</td>
                        <td className="text-right">{formatPKR(b.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </Reveal>
      )}
    </>
  );
}
