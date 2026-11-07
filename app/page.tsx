'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth';
import { Logo } from '@/components/brand';
import { Channels, DepartureBoard, HeroHeadline, OnScroll, ProtectionList, SeatStory } from '@/components/landing';
import { cx, PlanCards } from '@/components/ui';
import type { Plan } from '@/lib/domain';

const btn = 'inline-flex items-center justify-center rounded-md px-5 py-3 font-semibold transition';

export default function Landing() {
  const { me } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  useEffect(() => {
    fetch('/api/plans').then((r) => r.json()).then((d) => setPlans(d.plans ?? []), () => {});
  }, []);

  return (
    <div className="overflow-x-clip">
      {/* Hero */}
      <section className="relative bg-navy text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_80%_20%,rgba(255,199,44,0.10),transparent_70%)]" />
        <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
          <Logo light />
          <div className="flex items-center gap-2">
            {me?.user ? (
              <Link href="/dashboard" className={cx(btn, 'bg-sign py-2 text-navy')}>Open dashboard</Link>
            ) : (
              <>
                <Link href="/login" className={cx(btn, 'py-2 text-white hover:bg-white/10')}>Sign in</Link>
                <Link href="/register" className={cx(btn, 'bg-sign py-2 text-navy')}>Create account</Link>
              </>
            )}
          </div>
        </nav>

        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-10 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pb-28">
          <div>
            <HeroHeadline>Empty seats, sold before take-off.</HeroHeadline>
            <p data-hero-fade className="mt-6 max-w-xl text-lg text-white/75">
              Airlines release the seats that are about to fly empty. FlyLast gets them to verified travel agencies and subscribed travellers, at a price the
              airline approves and inside a booking window the airline sets.
            </p>
            <div data-hero-fade className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className={cx(btn, 'bg-sign text-navy hover:brightness-95')}>I&apos;m a traveller</Link>
              <Link href="/register?type=airline" className={cx(btn, 'border border-white/30 hover:bg-white/10')}>I&apos;m an airline or agency</Link>
            </div>
          </div>
          <DepartureBoard />
        </div>
      </section>

      <SeatStory />

      {/* Distribution */}
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <OnScroll>
            <h2 className="max-w-3xl font-display text-[clamp(2.2rem,4.5vw,3.5rem)] font-bold leading-[0.95]">Two channels. The airline picks for every release.</h2>
            <p className="mt-3 max-w-2xl text-lg text-white/70">An offer can go to authorized agencies, to subscribers, or both. FlyLast never sends a seat anywhere the airline didn&apos;t choose.</p>
          </OnScroll>
          <div className="mt-12"><Channels /></div>
        </div>
      </section>

      {/* Control + who pays */}
      <section className="mx-auto grid max-w-6xl gap-12 px-4 py-20 lg:grid-cols-2">
        <div>
          <OnScroll>
            <h2 className="font-display text-[clamp(2.2rem,4.5vw,3.5rem)] font-bold leading-[0.95] text-navy">Airlines stay in control</h2>
            <p className="mt-3 max-w-lg text-lg text-mute">
              Discounting last-minute seats is risky if it trains customers to wait. The Revenue Protection Engine checks every release before anyone sees it.
            </p>
          </OnScroll>
          <div className="mt-8"><ProtectionList /></div>
        </div>
        <div>
          <OnScroll>
            <h2 className="font-display text-[clamp(2.2rem,4.5vw,3.5rem)] font-bold leading-[0.95] text-navy">Who pays</h2>
            <p className="mt-3 max-w-lg text-lg text-mute">Only individual travellers subscribe. Businesses join free once our team verifies them.</p>
          </OnScroll>
          <OnScroll className="mt-8 divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
            {[
              ['Airlines', 'Free', 'Register, get verified, release empty seats on your terms.'],
              ['Travel agencies', 'Free', 'Register, get verified, sell releases airlines authorize you for.'],
              ['Travellers', 'From PKR 199/month', 'Discover releases, get notified, book eligible seats.'],
            ].map(([who, price, what]) => (
              <div key={who} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 p-5">
                <p className="font-display text-2xl font-semibold text-navy">{who}</p>
                <p className={cx('self-center font-display text-xl font-bold', price === 'Free' ? 'text-go' : 'text-navy')}>{price}</p>
                <p className="col-span-2 text-mute">{what}</p>
              </div>
            ))}
          </OnScroll>
          <p className="mt-4 text-sm text-mute">Revenue comes from traveller subscriptions. Airlines are paid directly when seats are booked on their site.</p>
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="border-t border-line bg-card/60">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <OnScroll>
            <h2 className="font-display text-[clamp(2.2rem,4.5vw,3.5rem)] font-bold leading-[0.95] text-navy">Traveller plans</h2>
            <p className="mt-3 max-w-2xl text-lg text-mute">Airlines decide which plans see each release. Higher plans see more, watch more routes and get the AI Deal Finder.</p>
          </OnScroll>
          <OnScroll className="mt-10"><PlanCards plans={plans} /></OnScroll>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="bg-navy text-white">
        <OnScroll className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-20 lg:flex-row lg:items-end lg:justify-between">
          <h2 className="max-w-2xl font-display text-[clamp(2.4rem,5vw,4rem)] font-bold leading-[0.95]">The next flight to leave with empty seats is in a few hours.</h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/register" className={cx(btn, 'bg-sign text-navy hover:brightness-95')}>Start as a traveller</Link>
            <Link href="/register?type=airline" className={cx(btn, 'border border-white/30 hover:bg-white/10')}>Register a business</Link>
          </div>
        </OnScroll>
        <footer className="border-t border-white/10 py-8 text-sm text-white/55">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4">
            <Logo light />
            <p>Built for DevFest. Flights and fares shown are demo data.</p>
          </div>
        </footer>
      </section>
    </div>
  );
}
