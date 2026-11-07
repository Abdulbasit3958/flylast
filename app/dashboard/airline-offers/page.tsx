'use client';
import { useState } from 'react';
import { Reveal } from '@/components/motion';
import { Button, cx, Empty, Field, fmtTime, inputCls, Notice, OfferTicket, PageTitle, useLoad } from '@/components/ui';
import { AIRPORTS, AUDIENCE_LABEL, formatPKR, HOUR, isOfferLive, validateOffer, type Audience, type Offer, type OfferInput } from '@/lib/domain';
import { api } from '@/lib/firebase-client';

const toLocal = (ms: number) => new Date(ms - new Date(ms).getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const fromLocal = (s: string) => new Date(s).getTime();

function blank(): OfferInput {
  const now = Math.floor(Date.now() / 60_000) * 60_000;
  return {
    flightNumber: '', origin: 'KHI', destination: 'ISB', departureTime: now + 24 * HOUR,
    baseFare: 28000, floorPrice: 12000, offerPrice: 16500, maxReleasableSeats: 14, releasedSeats: 8,
    releaseTime: now, expiryTime: now + 18 * HOUR, bookingCutoff: now + 20 * HOUR,
    eligibleSubscriberTiers: 'all', bookingUrl: 'https://',
    distributeToAgencies: true, distributeToSubscribers: true,
  };
}

function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
      <legend className="float-left w-full font-display text-xl font-semibold text-navy sm:col-span-2">{title}</legend>
      {note && <p className="-mt-3 text-sm text-mute sm:col-span-2">{note}</p>}
      {children}
    </fieldset>
  );
}

/** Small cabin strip: unsold seats, with the released ones lit in signage yellow. */
function SeatStrip({ unsold, released }: { unsold: number; released: number }) {
  const n = Math.min(Math.max(unsold, 0), 60);
  return (
    <div className="sm:col-span-2" aria-label={`${released} of ${unsold} unsold seats released`}>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: n }, (_, i) => (
          <span key={i} className={cx('h-4 w-3.5 rounded-t-[4px] rounded-b-[2px] border transition-colors', i < released ? 'border-sign bg-sign' : 'border-line bg-card')} />
        ))}
      </div>
      <p className="mt-1 text-sm text-mute">
        Releasing <strong className="text-ink">{released}</strong> of {unsold} unsold seats. The rest stay with your normal sales.
      </p>
    </div>
  );
}

export default function AirlineOffers() {
  const { data, error, reload, setError } = useLoad(() => api<{ offers: Offer[] }>('/api/airline/offers'));
  const [form, setForm] = useState<OfferInput>(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const local = validateOffer(form);
  const now = Date.now();

  const num = (k: keyof OfferInput) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: Number(e.target.value) });
  const str = (k: keyof OfferInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
  const time = (k: 'departureTime' | 'releaseTime' | 'expiryTime' | 'bookingCutoff', label: string) => (
    <Field label={label}>
      <input className={inputCls} type="datetime-local" required value={toLocal(form[k])} onChange={(e) => setForm({ ...form, [k]: fromLocal(e.target.value) })} />
    </Field>
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/airline/offers', { method: editing ? 'PATCH' : 'POST', body: editing ? { ...form, offerId: editing } : form });
      setMsg(editing ? 'Release updated.' : 'Seats released. They reach your chosen channels when the booking window opens.');
      setOpen(false);
      setEditing(null);
      setForm(blank());
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  async function toggle(o: Offer) {
    setError('');
    try {
      await api('/api/airline/offers', { method: 'PATCH', body: { offerId: o.offerId, status: o.status === 'published' ? 'paused' : 'published' } });
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const discount = form.baseFare > 0 ? Math.round((1 - form.offerPrice / form.baseFare) * 100) : 0;
  return (
    <>
      <PageTitle title="Empty-seat releases">
        Release seats that are likely to fly empty, at a price you approve, for a booking window you set. Every release passes the Revenue Protection Engine.
      </PageTitle>
      {!open && <Button variant="primary" onClick={() => { setOpen(true); setEditing(null); setForm(blank()); setMsg(''); }}>Release empty seats</Button>}
      <div className="mt-3"><Notice tone="ok">{msg}</Notice></div>

      {open && (
        <form onSubmit={submit} className="mt-2 grid gap-6 rounded-lg border border-line bg-card p-5 lg:grid-cols-[1fr_300px]">
          <div className="space-y-6">
            <h2 className="font-display text-3xl font-semibold text-navy">{editing ? 'Edit release' : 'New release'}</h2>

            <Group title="Flight">
              <Field label="Flight number"><input className={inputCls} required value={form.flightNumber} onChange={str('flightNumber')} placeholder="SI-301" /></Field>
              {time('departureTime', 'Departure')}
              {(['origin', 'destination'] as const).map((k) => (
                <Field key={k} label={k === 'origin' ? 'From' : 'To'}>
                  <select className={inputCls} value={form[k]} onChange={str(k)}>
                    {Object.entries(AIRPORTS).map(([c, n]) => <option key={c} value={c}>{n} ({c})</option>)}
                  </select>
                </Field>
              ))}
            </Group>

            <Group title="Empty seats" note="How many seats are still unsold, and how many you want to release to FlyLast.">
              <Field label="Unsold seats on this flight"><input className={inputCls} type="number" min={0} value={form.maxReleasableSeats} onChange={num('maxReleasableSeats')} /></Field>
              <Field label="Seats to release"><input className={inputCls} type="number" min={0} value={form.releasedSeats} onChange={num('releasedSeats')} /></Field>
              <SeatStrip unsold={form.maxReleasableSeats} released={form.releasedSeats} />
            </Group>

            <Group title="Approved price">
              <Field label="Regular fare (PKR)"><input className={inputCls} type="number" min={0} value={form.baseFare} onChange={num('baseFare')} /></Field>
              <Field label="Minimum approved price (PKR)" hint="Your floor. Never shown to agencies or travellers."><input className={inputCls} type="number" min={0} value={form.floorPrice} onChange={num('floorPrice')} /></Field>
              <Field label="Release price (PKR)" hint={discount > 0 ? `${discount}% below the regular fare` : undefined}>
                <input className={inputCls} type="number" min={0} value={form.offerPrice} onChange={num('offerPrice')} />
              </Field>
            </Group>

            <Group title="Booking window" note="Seats are only bookable inside this window, and never after the booking cutoff.">
              {time('releaseTime', 'Window opens')}
              {time('expiryTime', 'Window closes')}
              {time('bookingCutoff', 'Booking cutoff')}
            </Group>

            <Group title="Distribution" note="Choose who FlyLast sends this release to.">
              <label className="flex items-start gap-3 rounded-md border border-line p-3 sm:col-span-1">
                <input type="checkbox" className="mt-1" checked={form.distributeToAgencies} onChange={(e) => setForm({ ...form, distributeToAgencies: e.target.checked })} />
                <span><span className="font-semibold">Authorized travel agencies</span><br /><span className="text-sm text-mute">Verified agencies you&apos;ve authorized sell to their customers at your price.</span></span>
              </label>
              <label className="flex items-start gap-3 rounded-md border border-line p-3 sm:col-span-1">
                <input type="checkbox" className="mt-1" checked={form.distributeToSubscribers} onChange={(e) => setForm({ ...form, distributeToSubscribers: e.target.checked })} />
                <span><span className="font-semibold">FlyLast subscribers</span><br /><span className="text-sm text-mute">Individual travellers on an eligible plan.</span></span>
              </label>
              {form.distributeToSubscribers && (
                <Field label="Subscriber plans that can see it">
                  <select className={inputCls} value={form.eligibleSubscriberTiers} onChange={str('eligibleSubscriberTiers')}>
                    {(Object.keys(AUDIENCE_LABEL) as Audience[]).map((a) => <option key={a} value={a}>{AUDIENCE_LABEL[a]}</option>)}
                  </select>
                </Field>
              )}
              <div className="sm:col-span-2">
                <Field label="Authorized booking link" hint="FlyLast only hands this out after checking the agency or traveller is eligible.">
                  <input className={inputCls} type="url" required value={form.bookingUrl} onChange={str('bookingUrl')} />
                </Field>
              </div>
            </Group>

            <div className="flex gap-3">
              <Button type="submit" variant="primary" disabled={busy || !local.ok}>{busy ? 'Checking…' : editing ? 'Save changes' : 'Release seats'}</Button>
              <Button type="button" variant="ghost" onClick={() => { setOpen(false); setEditing(null); }}>Cancel</Button>
            </div>
            <Notice>{error}</Notice>
          </div>

          <aside aria-label="Revenue Protection Engine" className="self-start rounded-md bg-navy p-4 text-white lg:sticky lg:top-6">
            <h3 className="font-display text-xl font-semibold text-sign">Revenue Protection</h3>
            <p className="mb-3 text-sm text-white/60">{local.ok ? 'All checks pass. Ready to release.' : 'Fix the failing checks to release.'}</p>
            <ul className="space-y-2 text-sm">
              {local.checks.map((c) => (
                <li key={c.rule} className="flex gap-2">
                  <span aria-hidden className={cx('mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-sm text-[10px] font-bold', c.pass ? 'bg-go' : 'bg-stop')}>{c.pass ? '✓' : '✗'}</span>
                  <span className={c.pass ? 'text-white/80' : 'text-white'}><span className="sr-only">{c.pass ? 'Pass: ' : 'Fail: '}</span>{c.rule}</span>
                </li>
              ))}
            </ul>
            {local.ok && form.releasedSeats > 0 && (
              <p className="mt-4 border-t border-white/10 pt-3 text-sm text-white/80">
                If all {form.releasedSeats} seats sell: <strong className="text-sign">{formatPKR(form.releasedSeats * form.offerPrice)}</strong> from seats that would have flown empty.
              </p>
            )}
          </aside>
        </form>
      )}

      <Reveal className="mt-8 space-y-4">
        {data && !data.offers.length && <Empty>No releases yet. Release the empty seats on a flight departing in the next 72 hours.</Empty>}
        {!open && <Notice>{error}</Notice>}
        {data?.offers.map((o) => {
          const live = isOfferLive(o, now);
          const state = o.status === 'paused' ? 'Paused' : live ? 'Live' : o.releaseTime > now ? `Opens ${fmtTime(o.releaseTime)}` : 'Closed';
          const channels = [o.distributeToAgencies && 'Agencies', o.distributeToSubscribers && AUDIENCE_LABEL[o.eligibleSubscriberTiers]].filter(Boolean).join(' + ');
          return (
            <OfferTicket key={o.offerId} offer={o} hideTier={!o.distributeToSubscribers}
              footer={
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <span className={cx('rounded px-2 py-0.5 font-semibold', live ? 'bg-go/10 text-go' : 'bg-line text-mute')}>{state}</span>
                  <span className="text-mute">To: <span className="text-ink">{channels}</span></span>
                  <span className="text-mute">Floor {formatPKR(o.floorPrice)}</span>
                  <button className="font-semibold text-navy underline" onClick={() => { setForm(o); setEditing(o.offerId); setOpen(true); setMsg(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
                  <button className="font-semibold text-navy underline" onClick={() => toggle(o)}>{o.status === 'published' ? 'Pause' : 'Resume'}</button>
                </div>
              } />
          );
        })}
      </Reveal>
    </>
  );
}
