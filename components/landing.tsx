'use client';
import { useEffect, useRef, useState } from 'react';
import { gsap, MOTION_OK, ScrollTrigger, SplitText, useGSAP } from './motion';
import { cx, fmtTime, TierSign } from './ui';
import { formatPKR } from '@/lib/domain';
import type { LockedOffer } from '@/lib/views';

/* ───────────────────────── Hero headline ───────────────────────── */

export function HeroHeadline({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useGSAP(() => {
    gsap.matchMedia().add(MOTION_OK, () => {
      const split = SplitText.create(ref.current!, {
        type: 'lines',
        mask: 'lines',
        autoSplit: true,
        onSplit: (self) => gsap.from(self.lines, { yPercent: 110, duration: 1.1, stagger: 0.09, ease: 'expo.out' }),
      });
      gsap.from('[data-hero-fade]', { y: 18, autoAlpha: 0, duration: 0.8, stagger: 0.1, delay: 0.45, ease: 'power3.out' });
      return () => split.revert();
    });
  });
  return (
    <h1 ref={ref} className="font-display text-[clamp(3rem,7.5vw,6.25rem)] font-bold leading-[0.92] tracking-tight">
      {children}
    </h1>
  );
}

/* ───────────────────────── Split-flap departure board ───────────────────────── */

const FLAP_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function Tiles({ text, tone = 'white' }: { text: string; tone?: 'white' | 'sign' }) {
  return (
    <span className="inline-flex gap-[2px]" aria-label={text} role="text">
      {[...text].map((c, i) => (
        <span key={i} aria-hidden data-flap={c}
          className={cx('relative inline-grid h-[1.45em] w-[1.05em] place-items-center rounded-[3px] bg-[#06121f] font-display font-bold leading-none shadow-[inset_0_-1px_0_rgba(255,255,255,0.06)]',
            'after:absolute after:inset-x-0 after:top-1/2 after:h-px after:bg-black/60', tone === 'sign' ? 'text-sign' : 'text-white')}>
          {c}
        </span>
      ))}
    </span>
  );
}

export function DepartureBoard() {
  const ref = useRef<HTMLDivElement>(null);
  const [offers, setOffers] = useState<LockedOffer[] | null>(null);
  useEffect(() => {
    fetch('/api/offers/preview').then((r) => r.json()).then((d) => setOffers(d.offers ?? []), () => setOffers([]));
  }, []);

  useGSAP(
    () => {
      if (!offers?.length) return;
      gsap.matchMedia().add(MOTION_OK, () => {
        gsap.utils.toArray<HTMLElement>('[data-flap]', ref.current).forEach((el, i) => {
          const final = el.dataset.flap!;
          if (!/[A-Z0-9]/.test(final)) return;
          gsap.to({}, {
            duration: 0.55 + Math.random() * 0.45,
            delay: 0.25 + i * 0.012,
            onUpdate: () => { el.textContent = FLAP_CHARS[(Math.random() * FLAP_CHARS.length) | 0]; },
            onComplete: () => { el.textContent = final; },
          });
        });
      });
    },
    { scope: ref, dependencies: [offers] },
  );

  return (
    <div ref={ref} data-hero-fade className="rounded-xl border border-white/10 bg-[#0a1a31] p-4 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] sm:p-5">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-display text-2xl font-semibold text-sign">Empty seats, releasing now</h2>
        <span className="flex items-center gap-1.5 text-sm text-white/55">
          <span className="h-2 w-2 animate-pulse rounded-full bg-go" aria-hidden /> Live
        </span>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-x-4 border-b border-white/10 pb-1 text-xs text-white/45 sm:grid-cols-[auto_1fr_auto]">
        <span>Route</span><span className="hidden sm:block">Departs</span><span className="text-right">Below fare</span>
      </div>
      <div className="divide-y divide-white/10">
        {offers === null && <p className="py-8 text-white/50">Loading departures…</p>}
        {offers?.length === 0 && <p className="py-8 text-white/50">No seats released right now. Airlines release new empty seats every day.</p>}
        {offers?.map((o) => (
          <div key={o.offerId} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 py-3 sm:grid-cols-[auto_1fr_auto]">
            <span className="flex items-center gap-1.5 text-xl sm:text-2xl">
              <Tiles text={o.origin} /><span className="text-white/30" aria-hidden>›</span><Tiles text={o.destination} />
            </span>
            <span className="hidden text-sm text-white/65 sm:block">{fmtTime(o.departureTime)}<br /><span className="text-white/40">{o.airlineName}</span></span>
            <span className="text-right text-xl sm:text-2xl"><Tiles text={`${o.discountPct}%`} tone="sign" /></span>
            <span className="text-sm text-white/55 sm:hidden">{fmtTime(o.departureTime)}</span>
            <TierSign tier={o.eligibleSubscriberTiers} className="justify-self-end text-xs sm:col-start-3" />
          </div>
        ))}
      </div>
      <p className="mt-2 border-t border-white/10 pt-3 text-sm text-white/55">Fares and booking links unlock for verified agencies and subscribers.</p>
    </div>
  );
}

/* ───────────────────────── Seat-map story ───────────────────────── */

const COLORS = { navy: '#0e2340', line: '#c9d2df', seat: '#ffffff', stop: '#c8312b', sign: '#ffc72c', sky: '#3e9bdb', go: '#138a5e' };

// A320-style cabin: 30 rows × 6 seats. Deterministic so the story is the same every time.
const SEATS = (() => {
  let s = 11;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const all = Array.from({ length: 180 }, (_, i) => {
    const row = Math.floor(i / 6), col = i % 6;
    return { i, x: 104 + row * 23, y: 87 + col * 20 + (col >= 3 ? 12 : 0), cls: 'seat' };
  });
  const empty = new Set<number>();
  while (empty.size < 14) empty.add(Math.floor(rnd() * 180));
  const released = [...empty].sort((a, b) => a - b).slice(0, 8);
  const agency = new Set(released.filter((_, k) => k % 3 === 0)); // 3 of 8 to agencies
  for (const i of empty) all[i].cls += ' e';
  for (const i of released) all[i].cls += agency.has(i) ? ' r ag' : ' r sub';
  return all;
})();

const STEPS = [
  { label: 'sold', title: 'Three days before departure', body: 'Flight SI-722 from Lahore to Dubai is mostly sold. Revenue management expects the rest to stay empty.' },
  { label: 'empty', title: '14 seats are still unsold', body: 'Every one of them that flies empty is revenue the airline never gets back.' },
  { label: 'released', title: 'The airline releases 8 of them', body: 'At a price it approves, never below its floor, and only for a booking window it sets. The other 6 stay in normal sales.' },
  { label: 'distributed', title: 'FlyLast distributes the release', body: 'Verified travel agencies the airline authorized get it free. Subscribers on an eligible plan get notified.' },
  { label: 'booked', title: 'Seats booked on the airline’s own site', body: 'Agencies and travellers book through the airline’s authorized link. The airline is paid directly.' },
];

const STATUS = [
  '166 of 180 seats sold, 72 hours to departure',
  '14 seats forecast to fly empty',
  '8 seats released at PKR 41,000 (regular fare PKR 68,000)',
  '3 seats to authorized agencies, 5 to Premium & Elite subscribers',
  '',
];

export function SeatStory() {
  const root = useRef<HTMLElement>(null);
  const tl = useRef<gsap.core.Timeline>(null);
  const money = useRef<HTMLSpanElement>(null);
  const [step, setStep] = useState(-1);

  useGSAP(
    () => {
      const t = gsap.timeline({ paused: true, defaults: { duration: 0.35, ease: 'power2.out' } });
      t.addLabel('start')
        .to('.seat:not(.e)', { fill: COLORS.navy, stroke: COLORS.navy, stagger: { each: 0.004, from: 'random' } })
        .addLabel('sold')
        .to('.seat.e', { stroke: COLORS.stop, strokeWidth: 2.4, stagger: 0.02 })
        .addLabel('empty')
        .to('.seat.r', { fill: COLORS.sign, stroke: COLORS.sign, strokeWidth: 1, stagger: 0.06 })
        .to('.seat.e:not(.r)', { stroke: COLORS.line, strokeWidth: 1 }, '<')
        .addLabel('released')
        .to('.seat.ag', { fill: COLORS.sky, stroke: COLORS.sky, stagger: 0.08 })
        .addLabel('distributed')
        .to('.seat.r', { fill: COLORS.go, stroke: COLORS.go, stagger: 0.06 })
        .addLabel('booked');
      tl.current = t;

      gsap.utils.toArray<HTMLElement>('[data-step]', root.current).forEach((el, i) => {
        ScrollTrigger.create({ trigger: el, start: 'top 62%', end: 'bottom 62%', onToggle: (self) => self.isActive && setStep(i) });
      });
    },
    { scope: root },
  );

  useEffect(() => {
    const t = tl.current;
    if (!t || step < 0) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) t.seek(STEPS[step].label);
    else t.tweenTo(STEPS[step].label, { duration: 1.1, ease: 'power1.inOut' });
    if (step === 4 && money.current) {
      const o = { v: 0 };
      gsap.to(o, { v: 8 * 41000, duration: reduce ? 0 : 1.4, ease: 'power2.out', onUpdate: () => { money.current!.textContent = formatPKR(o.v); } });
    }
  }, [step]);

  return (
    <section ref={root} aria-labelledby="story-h" className="relative bg-paper">
      <div className="mx-auto max-w-6xl px-4 pt-20">
        <h2 id="story-h" className="max-w-3xl font-display text-[clamp(2.4rem,5vw,4rem)] font-bold leading-[0.95] text-navy">
          One flight, 72 hours out. Here&apos;s what FlyLast does.
        </h2>
      </div>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-24 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <ol className="order-2 lg:order-1">
          {STEPS.map((s, i) => (
            <li key={s.label} data-step className="flex min-h-[55vh] flex-col justify-center lg:min-h-[75vh]">
              <div className={cx('border-l-4 pl-5 transition-colors duration-500', step === i ? 'border-sign' : 'border-line')}>
                <p className={cx('font-display text-6xl font-bold transition-colors duration-500', step === i ? 'text-navy' : 'text-line')}>{i + 1}</p>
                <h3 className="mt-1 font-display text-3xl font-semibold text-navy">{s.title}</h3>
                <p className="mt-2 max-w-md text-lg text-mute">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* Mobile: the grid item itself sticks (its parent is the whole story). Desktop: the inner panel sticks within the stretched column. */}
        <div className="sticky top-0 z-10 order-1 -mx-4 self-start bg-paper/95 px-4 pb-3 pt-3 backdrop-blur lg:static lg:order-2 lg:mx-0 lg:self-stretch lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          <div className="lg:sticky lg:top-16 lg:pt-6">
            <div className="rounded-xl border border-line bg-card p-4 shadow-[0_20px_50px_-30px_rgba(14,35,64,0.45)] sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-display text-2xl font-bold text-navy">SI-722 <span className="font-semibold text-mute">LHE › DXB</span></p>
                <p className="text-sm text-mute">Airbus A320, 180 seats</p>
              </div>
              <Cabin />
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink">
                <Legend fill={COLORS.navy}>Sold</Legend>
                <Legend fill="#fff" stroke={COLORS.stop}>Unsold</Legend>
                <Legend fill={COLORS.sign}>To subscribers</Legend>
                <Legend fill={COLORS.sky}>To agencies</Legend>
                <Legend fill={COLORS.go}>Booked</Legend>
              </ul>
              <p className="mt-4 min-h-[3.5rem] border-t border-line pt-3 text-lg font-semibold text-navy" aria-live="polite">
                {step === 4 ? (
                  <>All 8 booked: <span ref={money} className="text-go">PKR 0</span> recovered from seats that would have flown empty.</>
                ) : (
                  STATUS[step] ?? 'Scroll to follow the flight'
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Legend({ fill, stroke, children }: { fill: string; stroke?: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <svg width="14" height="14" aria-hidden><rect x="1" y="1" width="12" height="12" rx="3" fill={fill} stroke={stroke ?? fill} strokeWidth="2" /></svg>
      {children}
    </li>
  );
}

function Cabin() {
  return (
    <svg viewBox="0 0 840 300" className="mt-3 w-full" role="img" aria-label="Seat map of an A320 showing sold, unsold and released seats">
      <g fill="#e7ecf3">
        <path d="M372 82 L470 82 L590 6 L548 6 Z" />
        <path d="M372 218 L470 218 L590 294 L548 294 Z" />
        <path d="M770 82 L812 82 L838 38 L816 38 Z" />
        <path d="M770 218 L812 218 L838 262 L816 262 Z" />
      </g>
      <path d="M78 80 H780 Q822 80 826 150 Q822 220 780 220 H78 Q12 216 4 150 Q12 84 78 80 Z" fill="#fff" stroke="#c9d2df" strokeWidth="2" />
      <path d="M30 128 Q40 100 62 98 L62 202 Q40 200 30 172 Z" fill="#e7ecf3" />
      {SEATS.map((s) => (
        <rect key={s.i} className={s.cls} x={s.x} y={s.y} width="18" height="16" rx="4" fill={COLORS.seat} stroke={COLORS.line} strokeWidth="1" />
      ))}
    </svg>
  );
}

/* ───────────────────────── Distribution diagram ───────────────────────── */

export function Channels() {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      gsap.matchMedia().add(MOTION_OK, () => {
        const t = gsap.timeline({ scrollTrigger: { trigger: ref.current, start: 'top 70%' } });
        t.from('[data-node]', { y: 24, autoAlpha: 0, duration: 0.6, stagger: 0.18, ease: 'power3.out' })
          .from('[data-wire]', { strokeDashoffset: 300, duration: 0.9, stagger: 0.15, ease: 'power2.inOut' }, 0.25)
          .from('[data-hline]', { scaleX: 0, scaleY: 0, duration: 0.6, ease: 'power2.inOut' }, 0.3);
      });
    },
    { scope: ref },
  );

  const node = 'rounded-xl border border-white/15 bg-white/[0.04] p-5';
  return (
    <div ref={ref} className="grid items-center gap-4 lg:grid-cols-[1fr_64px_1fr_84px_1.15fr]">
      <div data-node className={node}>
        <p className="font-display text-sm font-semibold text-sign">Airline</p>
        <p className="mt-1 font-display text-2xl font-semibold">Releases empty seats</p>
        <p className="mt-2 text-white/65">Chooses the flight, the seat count, an approved price and the booking window.</p>
      </div>
      <div className="flex justify-center" aria-hidden>
        <span data-hline className="block h-10 w-0.5 origin-top bg-sign lg:h-0.5 lg:w-full lg:origin-left" />
      </div>
      <div data-node className="rounded-xl bg-sign p-5 text-navy">
        <p className="font-display text-sm font-semibold">FlyLast</p>
        <p className="mt-1 font-display text-2xl font-bold">Checks and distributes</p>
        <p className="mt-2 text-navy/75">Revenue Protection validates the release, then sends it only to the channels the airline picked.</p>
      </div>
      <svg viewBox="0 0 84 200" className="mx-auto hidden h-52 w-full lg:block" aria-hidden fill="none" strokeWidth="2">
        <path data-wire d="M0 100 C40 100 40 30 84 30" stroke="#3e9bdb" strokeDasharray="300" strokeDashoffset="0" />
        <path data-wire d="M0 100 C40 100 40 170 84 170" stroke="#ffc72c" strokeDasharray="300" strokeDashoffset="0" />
      </svg>
      <div className="flex justify-center lg:hidden" aria-hidden><span data-hline className="block h-10 w-0.5 origin-top bg-sign" /></div>
      <div className="grid gap-4">
        <div data-node className={cx(node, 'border-l-4 border-l-sky')}>
          <p className="font-display text-2xl font-semibold">Authorized travel agencies</p>
          <p className="mt-1 text-white/65">Registered, verified and authorized by the airline. <strong className="text-white">No subscription.</strong> Book for their customers at the airline&apos;s price.</p>
        </div>
        <div data-node className={cx(node, 'border-l-4 border-l-sign')}>
          <p className="font-display text-2xl font-semibold">Individual subscribers</p>
          <p className="mt-1 text-white/65">Travellers on a paid plan discover releases, get notified on watched routes and book eligible seats.</p>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Revenue protection checklist ───────────────────────── */

const RULES = [
  'Never below the airline’s minimum approved price',
  'Never more than 70% off the regular fare',
  'Never more seats than are actually unsold',
  'Only inside the last 72 hours before departure',
  'Booking closes at least 2 hours before departure',
  'Only to the channels and plans the airline chose',
];

export function ProtectionList() {
  const ref = useRef<HTMLUListElement>(null);
  useGSAP(
    () => {
      gsap.matchMedia().add(MOTION_OK, () => {
        const t = gsap.timeline({ scrollTrigger: { trigger: ref.current, start: 'top 75%' } });
        t.from('li', { x: -16, autoAlpha: 0, duration: 0.45, stagger: 0.12, ease: 'power2.out' }).from(
          '[data-tick]', { scale: 0, duration: 0.35, stagger: 0.12, ease: 'back.out(3)' }, 0.2);
      });
    },
    { scope: ref },
  );
  return (
    <ul ref={ref} className="space-y-3">
      {RULES.map((r) => (
        <li key={r} className="flex items-start gap-3 rounded-lg border border-line bg-card px-4 py-3">
          <span data-tick aria-hidden className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-go text-sm font-bold text-white">✓</span>
          <span className="text-lg">{r}</span>
        </li>
      ))}
    </ul>
  );
}

/** Fades/raises its children in once when scrolled into view. */
export function OnScroll({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      gsap.matchMedia().add(MOTION_OK, () => {
        gsap.from(ref.current!.children, { y: 28, autoAlpha: 0, duration: 0.7, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: ref.current, start: 'top 80%' } });
      });
    },
    { scope: ref },
  );
  return <div ref={ref} className={className}>{children}</div>;
}
