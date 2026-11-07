'use client';
import { cloneElement, useCallback, useEffect, useId, useState } from 'react';
import { AIRPORTS, AUDIENCE_LABEL, formatPKR, type Audience, type Plan } from '@/lib/domain';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export const fmtTime = (ms: number) =>
  new Date(ms).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const BTN = {
  primary: 'bg-sign text-navy hover:brightness-95',
  dark: 'bg-navy text-white hover:bg-navy-2',
  ghost: 'border border-line bg-card text-ink hover:border-mute',
  danger: 'border border-stop/40 bg-card text-stop hover:bg-stop/5',
};

export function Button({ variant = 'dark', className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BTN }) {
  return (
    <button
      {...p}
      className={cx('inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50', BTN[variant], className)}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactElement<{ id?: string; 'aria-describedby'?: string }> }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold">{label}</label>
      {cloneElement(children, { id, ...(hint && { 'aria-describedby': `${id}-hint` }) })}
      {hint && <p id={`${id}-hint`} className="mt-1 text-sm text-mute">{hint}</p>}
    </div>
  );
}

export const inputCls = 'w-full rounded-md border border-line bg-card px-3 py-2 text-ink placeholder:text-mute/70 focus:border-navy focus:outline-none';

export function Notice({ tone = 'error', children }: { tone?: 'error' | 'ok' | 'info'; children: React.ReactNode }) {
  if (!children) return null;
  const t = { error: 'border-stop/30 bg-stop/5 text-stop', ok: 'border-go/30 bg-go/5 text-go', info: 'border-line bg-card text-mute' }[tone];
  return <p role={tone === 'error' ? 'alert' : 'status'} className={cx('rounded-md border px-3 py-2 text-sm', t)}>{children}</p>;
}

export function PageTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="mb-6">
      <h1 className="font-display text-4xl font-semibold leading-tight text-navy">{title}</h1>
      {children && <p className="mt-1 max-w-2xl text-mute">{children}</p>}
    </header>
  );
}

/** Taxiway-style sign: black panel, yellow legend. Marks which subscriber tier an offer is for. */
export function TierSign({ tier, className }: { tier: Audience; className?: string }) {
  return (
    <span className={cx('inline-block rounded-sm border-2 border-sign bg-[#111a2b] px-2 py-0.5 font-display text-sm font-semibold tracking-wide text-sign', className)}>
      {AUDIENCE_LABEL[tier]}
    </span>
  );
}

export type TicketOffer = {
  offerId: string;
  airlineName: string;
  origin: string;
  destination: string;
  departureTime: number;
  eligibleSubscriberTiers: Audience;
  discountPct?: number;
  flightNumber?: string;
  offerPrice?: number;
  baseFare?: number;
  releasedSeats?: number;
  expiryTime?: number;
  locked?: boolean;
  reason?: string;
};

/** Boarding-pass card. Locked offers arrive from the server without price, so the stub shows a tier sign instead. */
export function OfferTicket({ offer: o, action, footer, hideTier }: { offer: TicketOffer; action?: React.ReactNode; footer?: React.ReactNode; hideTier?: boolean }) {
  const discount = o.discountPct ?? (o.offerPrice && o.baseFare ? Math.round((1 - o.offerPrice / o.baseFare) * 100) : undefined);
  return (
    <article className="flex overflow-hidden rounded-lg border border-line bg-card">
      <div className="min-w-0 flex-1 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-mute">
          <span>{o.airlineName}{o.flightNumber && <> · <span className="font-semibold text-ink">{o.flightNumber}</span></>}</span>
          {!hideTier && <TierSign tier={o.eligibleSubscriberTiers} />}
        </div>
        <div className="mt-2 flex items-end gap-3 font-display text-navy">
          <Code code={o.origin} />
          <span aria-hidden className="mb-3 h-px flex-1 border-t-2 border-dashed border-line" />
          <Code code={o.destination} />
        </div>
        <p className="mt-1 text-sm text-mute">
          Departs {fmtTime(o.departureTime)}
          {o.releasedSeats !== undefined && <> · {o.releasedSeats} seats released</>}
          {o.expiryTime && <> · offer ends {fmtTime(o.expiryTime)}</>}
        </p>
        {footer}
      </div>
      <div className="perf shrink-0 bg-card" aria-hidden />
      <div className={cx('flex w-36 shrink-0 flex-col justify-between gap-3 p-4 sm:w-44', o.locked ? 'bg-[#111a2b] text-sign' : 'bg-navy text-white')}>
        {o.locked ? (
          <>
            <p className="font-display text-2xl font-semibold leading-none">{discount !== undefined && `${discount}% off`}</p>
            <p className="text-sm leading-snug text-sign/90">{o.reason || 'Subscribers only'}</p>
          </>
        ) : (
          <>
            <div>
              {o.baseFare && <p className="text-sm text-white/60 line-through">{formatPKR(o.baseFare)}</p>}
              <p className="font-display text-2xl font-semibold leading-tight">{o.offerPrice ? formatPKR(o.offerPrice) : '—'}</p>
              {discount !== undefined && <p className="text-sm font-semibold text-sign">{discount}% below base fare</p>}
            </div>
          </>
        )}
        {action}
      </div>
    </article>
  );
}

function Code({ code }: { code: string }) {
  return (
    <span className="flex flex-col leading-none">
      <span className="text-4xl font-bold tracking-tight sm:text-5xl">{code}</span>
      <span className="font-sans text-sm text-mute">{AIRPORTS[code] ?? code}</span>
    </span>
  );
}

export function PlanCards({ plans, currentPlanId, onPick, busy, cta = 'Activate' }: {
  plans: Plan[];
  currentPlanId?: string | null;
  onPick?: (p: Plan) => void;
  busy?: string | null;
  cta?: string;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {plans.map((p) => {
        const current = p.planId === currentPlanId;
        const featured = p.planId === 'premium';
        return (
          <div key={p.planId} className={cx('flex flex-col rounded-lg border bg-card p-5', featured ? 'border-navy border-2' : 'border-line')}>
            <h3 className="font-display text-3xl font-semibold text-navy">{p.planName}</h3>
            <p className="mt-1">
              <span className="font-display text-4xl font-bold">{formatPKR(p.monthlyPrice)}</span>
              <span className="text-mute"> / month</span>
            </p>
            <ul className="mt-4 flex-1 space-y-2 text-sm">
              <li>Offers for: {p.eligibleOfferTiers.map((t) => AUDIENCE_LABEL[t]).join(', ')}</li>
              <li>Watch up to {p.maxRouteWatches} routes</li>
              <li>{p.aiEnabled ? 'AI Deal Finder (Gemini) included' : 'No AI Deal Finder'}</li>
            </ul>
            {onPick && (
              <Button className="mt-5" variant={current ? 'ghost' : featured ? 'primary' : 'dark'} disabled={current || !!busy} onClick={() => onPick(p)}>
                {current ? 'Your current plan' : busy === p.planId ? 'Activating…' : `${cta} ${p.planName}`}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Load data from an API call; exposes reload for after mutations. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(fn, deps);
  const reload = useCallback(() => load().then(setData, (e: Error) => setError(e.message)), [load]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, error, reload, setError };
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-line bg-card px-6 py-10 text-center text-mute">{children}</div>;
}
