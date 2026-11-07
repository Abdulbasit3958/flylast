'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AIRPORTS, areTogether, CABIN_LETTERS, CABIN_ROWS, EXIT_ROWS, formatPKR, HOLD_LABEL, HOLD_MS, isExitRow, MAX_SEATS_PER_BOOKING, pickByType, pickTogether, seatDescription, type Booking, type Channel, type SeatType, type SeatView } from '@/lib/domain';
import { api } from '@/lib/firebase-client';
import { gsap, MOTION_OK } from './motion';
import { Button, cx, Field, fmtTime, inputCls, Notice, type TicketOffer } from './ui';

type Step = 'seats' | 'details' | 'done';
/** Run an animation only when the user hasn't asked for reduced motion. */
const motion = (fn: () => void) => window.matchMedia(MOTION_OK).matches && fn();
const mmss = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Seat-map booking: pick exact seats → server holds them for 10 minutes → passenger details
 * against a countdown → confirmed. Holds and bookings are enforced server-side in transactions.
 */
export function BookDialog({ offer, channel, onBooked }: { offer: TicketOffer; channel: Channel; onBooked?: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const cabin = useRef<HTMLDivElement>(null);
  const stamp = useRef<HTMLDivElement>(null);
  const timerText = useRef<HTMLSpanElement>(null);
  const [step, setStep] = useState<Step>('seats');
  const [seats, setSeats] = useState<Record<string, SeatView> | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [deadline, setDeadline] = useState(0);
  const [left, setLeft] = useState(HOLD_MS);
  const [names, setNames] = useState<Record<string, string>>({});
  const [contact, setContact] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ booking: Booking; ticketingUrl: string } | null>(null);
  const [party, setParty] = useState(2);
  const max = MAX_SEATS_PER_BOOKING[channel];
  const fare = offer.offerPrice ?? 0;
  const available = offer.releasedSeats ?? 0;

  const loadSeats = useCallback(async () => {
    const res = await api<{ seats: Record<string, SeatView> }>(`/api/offers/${offer.offerId}/seats`);
    setSeats(res.seats);
    // Drop selections someone else grabbed in the meantime.
    setSelected((sel) => sel.filter((s) => res.seats[s] === 'open' || res.seats[s] === 'mine'));
    return res.seats;
  }, [offer.offerId]);

  async function open() {
    setStep('seats');
    setDone(null);
    setError('');
    setSeats(null);
    dialog.current?.showModal();
    try {
      const s = await loadSeats();
      setSelected(Object.keys(s).filter((k) => s[k] === 'mine'));
      requestAnimationFrame(() => {
        motion(() => {
          gsap.fromTo(cabin.current!.querySelectorAll('[data-seat]'), { scale: 0.3, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.35, ease: 'back.out(2)', stagger: { each: 0.0025, from: 'start' } });
        });
        cabin.current?.querySelector('[data-released]')?.scrollIntoView({ block: 'center' });
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const releaseHold = useCallback(() => {
    api(`/api/offers/${offer.offerId}/hold`, { method: 'DELETE' }).catch(() => {});
  }, [offer.offerId]);

  function onClose() {
    if (step === 'details') releaseHold();
    if (done) onBooked?.();
    setStep('seats');
  }

  // Live seat map while choosing: see seats other people hold or book.
  useEffect(() => {
    if (step !== 'seats' || !seats) return;
    const t = setInterval(() => loadSeats().catch(() => {}), 8000);
    return () => clearInterval(t);
  }, [step, seats, loadSeats]);

  // Slide between steps.
  useEffect(() => {
    motion(() => {
      // fromTo (not from): React dev runs effects twice, and a second from() would lock in a half-faded state.
      gsap.fromTo(panel.current, { x: 36, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.4, ease: 'power3.out', overwrite: true });
    });
  }, [step]);

  // Hold countdown.
  useEffect(() => {
    if (step !== 'details') return;
    const tick = () => {
      const ms = Math.max(0, deadline - Date.now());
      setLeft(ms);
      if (ms === 0) expire();
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, deadline]);

  // Last minute: the timer pulses.
  const urgent = step === 'details' && left <= 60_000;
  useEffect(() => {
    if (!urgent || !timerText.current) return;
    const ctx = gsap.context(() => {
      motion(() => gsap.to(timerText.current, { scale: 1.08, repeat: -1, yoyo: true, duration: 0.5, ease: 'sine.inOut' }));
    });
    return () => ctx.revert();
  }, [urgent]);

  function expire() {
    motion(() => {
      gsap.fromTo(panel.current, { x: -10 }, { x: 0, duration: 0.6, ease: 'elastic.out(1, 0.3)' });
    });
    setError('Your seat hold ran out and the seats were released. Your picks are kept: hold them again if they’re still free.');
    setStep('seats');
    loadSeats().catch(() => {});
  }

  function toggle(label: string, el: HTMLElement) {
    setError('');
    setSelected((sel) => {
      if (sel.includes(label)) return sel.filter((s) => s !== label);
      if (sel.length >= max) {
        setError(`You can pick up to ${max} seats per booking.`);
        return sel;
      }
      return [...sel, label];
    });
    motion(() => {
      gsap.fromTo(el, { scale: 1.4 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    });
  }

  const openSeats = seats ? Object.keys(seats).filter((k) => seats[k] === 'open' || seats[k] === 'mine') : [];

  /** Highlight newly picked seats and bring them into view. */
  function flash(labels: string[]) {
    requestAnimationFrame(() => {
      const els = labels.map((l) => cabin.current?.querySelector<HTMLElement>(`[aria-label^="Seat ${l},"]`)).filter(Boolean) as HTMLElement[];
      els[0]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      motion(() => gsap.fromTo(els, { scale: 1.5 }, { scale: 1, duration: 0.7, stagger: 0.09, ease: 'elastic.out(1, 0.4)' }));
    });
  }

  function seatTogether() {
    setError('');
    const n = Math.min(party, max);
    const picked = pickTogether(openSeats, n);
    if (!picked) return setError(`Only ${openSeats.length} seat${openSeats.length === 1 ? ' is' : 's are'} free on this release.`);
    setSelected(picked);
    flash(picked);
    if (n > 1 && !areTogether(picked)) setError(`No ${n} seats side by side on this release, so we picked the closest available ones.`);
  }

  function quickPick(type: SeatType) {
    setError('');
    if (selected.length >= max) return setError(`You can pick up to ${max} seats per booking.`);
    const seat = pickByType(openSeats, type, selected);
    if (!seat) return setError(`No ${type} seats are free on this release.`);
    setSelected([...selected, seat]);
    flash([seat]);
  }

  async function hold() {
    setBusy(true);
    setError('');
    try {
      const res = await api<{ holdMs: number }>(`/api/offers/${offer.offerId}/hold`, { body: { seats: selected } });
      setDeadline(Date.now() + res.holdMs);
      setLeft(res.holdMs);
      setStep('details');
    } catch (e) {
      setError((e as Error).message);
      loadSeats().catch(() => {});
    }
    setBusy(false);
  }

  async function changeSeats() {
    releaseHold();
    setError('');
    setStep('seats');
    loadSeats().catch(() => {});
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api<{ booking: Booking; ticketingUrl: string }>(`/api/offers/${offer.offerId}/book`, {
        body: { seats: selected, passengers: selected.map((s) => names[s] ?? ''), contact },
      });
      setDone(res);
      setStep('done');
      requestAnimationFrame(() => {
        motion(() => {
          gsap.fromTo(stamp.current, { scale: 2.4, rotate: -24, autoAlpha: 0 }, { scale: 1, rotate: -8, autoAlpha: 1, duration: 0.5, delay: 0.2, ease: 'back.out(2.2)' });
        });
      });
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      if (msg.includes('hold expired')) expire();
    }
    setBusy(false);
  }

  return (
    <>
      <Button variant="primary" className="w-full" disabled={available < 1} onClick={open}>
        {available < 1 ? 'Sold out' : channel === 'agency' ? 'Book for a customer' : 'Choose seats'}
      </Button>

      <dialog ref={dialog} onClose={onClose} aria-label="Book seats"
        className="m-auto max-h-[92vh] w-[min(46rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl bg-card p-0 text-ink shadow-2xl backdrop:bg-navy/60 backdrop:backdrop-blur-sm">
        <header className="flex items-start justify-between gap-4 bg-navy px-5 py-4 text-white">
          <div>
            <p className="font-display text-3xl font-bold leading-none">{offer.origin} › {offer.destination}</p>
            <p className="mt-1 text-sm text-white/70">
              {offer.airlineName}{offer.flightNumber && `, ${offer.flightNumber}`}. Departs {fmtTime(offer.departureTime)}. {formatPKR(fare)} per seat
            </p>
          </div>
          <button onClick={() => dialog.current?.close()} className="rounded px-2 text-2xl leading-none text-white/70 hover:text-white" aria-label="Close">×</button>
        </header>
        <Steps step={step} />

        <div ref={panel} className="max-h-[calc(92vh-9.5rem)] overflow-y-auto">
          {step === 'seats' && (
            <div className="grid gap-5 p-5 md:grid-cols-[auto_1fr]">
              <div ref={cabin} className="mx-auto max-h-[52vh] overflow-y-auto rounded-[2.5rem_2.5rem_1rem_1rem] border-2 border-line bg-paper px-3 pb-3 md:max-h-[58vh]">
                <p className="sticky top-0 z-10 bg-paper pb-1 pt-4 text-center text-xs text-mute">Front of aircraft</p>
                <div className="grid grid-cols-[1.25rem_repeat(3,2rem)_1.25rem_repeat(3,2rem)_1.25rem] gap-1 text-center text-xs text-mute" aria-hidden>
                  <span />{CABIN_LETTERS.slice(0, 3).map((l) => <span key={l}>{l}</span>)}<span />{CABIN_LETTERS.slice(3).map((l) => <span key={l}>{l}</span>)}<span />
                </div>
                {seats === null ? (
                  <p className="px-6 py-16 text-center text-mute">Loading seat map…</p>
                ) : (
                  <div role="group" aria-label="Seat map" className="mt-1 space-y-1">
                    {Array.from({ length: CABIN_ROWS }, (_, r) => r + 1).map((row) => {
                      const exit = EXIT_ROWS.includes(row);
                      const cell = (l: string) => <Seat key={l} label={`${row}${l}`} view={seats[`${row}${l}`]} selected={selected.includes(`${row}${l}`)} onToggle={toggle} />;
                      return (
                        <div key={row} className={cx('grid grid-cols-[1.25rem_repeat(3,2rem)_1.25rem_repeat(3,2rem)_1.25rem] items-center gap-1', exit && 'my-2')}>
                          <span className={cx('text-[10px] font-semibold', exit ? 'text-stop' : 'text-transparent')}>{exit ? 'Exit' : '.'}</span>
                          {CABIN_LETTERS.slice(0, 3).map(cell)}
                          <span className="text-center text-[10px] text-mute">{row}</span>
                          {CABIN_LETTERS.slice(3).map(cell)}
                          <span className={cx('text-right text-[10px] font-semibold', exit ? 'text-stop' : 'text-transparent')}>{exit ? 'Exit' : '.'}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="font-display text-2xl font-semibold text-navy">Choose your seats</h2>
                  <p className="text-sm text-mute">Yellow seats are released by the airline. Pick up to {max}, by tapping the map or with a quick pick.</p>
                </div>
                <HowItWorks />

                <div className="rounded-lg border border-line p-3">
                  <p className="mb-2 text-sm font-semibold">Quick pick</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`party-${offer.offerId}`}>Party size</label>
                    <select id={`party-${offer.offerId}`} value={party} onChange={(e) => setParty(Number(e.target.value))} className="rounded-md border border-line bg-card px-2 py-1.5 text-sm">
                      {Array.from({ length: max }, (_, i) => <option key={i} value={i + 1}>{i + 1} {i ? 'people' : 'person'}</option>)}
                    </select>
                    <Button variant="dark" className="px-3 py-1.5 text-sm" onClick={seatTogether} disabled={!seats}>Seat us together</Button>
                    <Button variant="ghost" className="px-3 py-1.5 text-sm" onClick={() => quickPick('window')} disabled={!seats}>+ Window</Button>
                    <Button variant="ghost" className="px-3 py-1.5 text-sm" onClick={() => quickPick('aisle')} disabled={!seats}>+ Aisle</Button>
                  </div>
                </div>

                <ul className="grid grid-cols-2 gap-2 text-sm">
                  <Legend cls="border-sign bg-sign">Available</Legend>
                  <Legend cls="border-go bg-go">Your pick</Legend>
                  <Legend cls="border-line bg-[repeating-linear-gradient(45deg,#d9dfe8_0_3px,#fff_3px_6px)]">Held by someone</Legend>
                  <Legend cls="border-navy bg-navy">Booked</Legend>
                  <Legend cls="border-line bg-card opacity-60">Not released</Legend>
                  <li className="flex items-center gap-2"><span aria-hidden className="text-[10px] font-semibold text-stop">Exit</span>Extra legroom</li>
                </ul>
                <div className="rounded-lg bg-paper p-4">
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm text-mute">Selected</p>
                    <p className="text-sm"><span className="text-mute">{selected.length} × {formatPKR(fare)} = </span><strong>{formatPKR(selected.length * fare)}</strong></p>
                  </div>
                  {selected.length ? (
                    <ul className="mt-2 space-y-1.5">
                      {selected.map((l) => (
                        <li key={l} className="flex items-center justify-between gap-2 rounded-md bg-card px-3 py-1.5">
                          <span><strong className="font-display text-lg text-navy">{l}</strong> <span className="text-sm text-mute">{seatDescription(l)}</span></span>
                          <button type="button" onClick={() => setSelected(selected.filter((x) => x !== l))} className="text-lg leading-none text-mute hover:text-stop" aria-label={`Remove seat ${l}`}>×</button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 font-display text-xl font-bold text-navy">No seats yet</p>
                  )}
                  {selected.some(isExitRow) && (
                    <p className="mt-2 text-sm text-stop">Exit-row seats: passengers must be 15 or older and willing to help in an emergency.</p>
                  )}
                </div>
                <Notice>{error}</Notice>
                <Button variant="primary" className="py-3" disabled={!selected.length || busy} onClick={hold}>
                  {busy ? 'Holding seats…' : selected.length ? `Hold ${selected.length} seat${selected.length > 1 ? 's' : ''} for ${HOLD_LABEL}` : 'Pick a seat'}
                </Button>
              </div>
            </div>
          )}

          {step === 'details' && (
            <form onSubmit={confirm} className="space-y-4 p-5">
              <div className={cx('rounded-lg p-4 transition-colors', urgent ? 'bg-stop/10' : 'bg-sign/20')} role="timer" aria-live="off">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{selected.length > 1 ? 'Seats' : 'Seat'} {selected.join(', ')} held for you</p>
                  <span ref={timerText} className={cx('inline-block font-display text-3xl font-bold tabular-nums', urgent ? 'text-stop' : 'text-navy')}>{mmss(left)}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                  <div className={cx('h-full rounded-full transition-[width] duration-300 ease-linear', urgent ? 'bg-stop' : 'bg-navy')} style={{ width: `${(left / HOLD_MS) * 100}%` }} />
                </div>
                <p className="sr-only" aria-live="polite">{urgent ? 'Less than one minute left on your seat hold.' : ''}</p>
              </div>
              <p className="text-sm text-mute">Enter each passenger&apos;s name exactly as on their CNIC or passport, then confirm before the timer ends. You can change seats, but that releases your hold.</p>
              {selected.map((s, i) => (
                <Field key={s} label={`Seat ${s}: passenger ${i + 1} full name`} hint={i === 0 ? 'As written on CNIC or passport.' : undefined}>
                  <input className={inputCls} required minLength={2} maxLength={60} autoComplete={i === 0 && channel === 'subscriber' ? 'name' : 'off'}
                    value={names[s] ?? ''} onChange={(e) => setNames({ ...names, [s]: e.target.value })} />
                </Field>
              ))}
              <Field label={channel === 'agency' ? 'Customer phone or email' : 'Phone or email'}>
                <input className={inputCls} required value={contact} onChange={(e) => setContact(e.target.value)} placeholder="0300 1234567" />
              </Field>
              <div className="flex items-center justify-between rounded-md bg-paper px-4 py-3">
                <span className="text-mute">{selected.length} × {formatPKR(fare)}</span>
                <span className="font-display text-2xl font-bold text-navy">{formatPKR(selected.length * fare)}</span>
              </div>
              <Notice>{error}</Notice>
              <div className="flex flex-wrap gap-3">
                <Button type="submit" variant="primary" className="flex-1 py-3" disabled={busy}>{busy ? 'Booking…' : `Confirm booking, ${formatPKR(selected.length * fare)}`}</Button>
                <Button type="button" variant="ghost" onClick={changeSeats}>Change seats</Button>
              </div>
              <p className="text-center text-xs text-mute">Demo mode: no payment is taken.</p>
            </form>
          )}

          {step === 'done' && done && (
            <div className="relative p-5 sm:p-6">
              <div ref={stamp} aria-hidden className="pointer-events-none absolute right-6 top-5 -rotate-8 rounded-md border-4 border-go px-3 py-1 font-display text-2xl font-bold text-go">Confirmed</div>
              <p className="text-sm text-mute">Booking reference</p>
              <p className="font-display text-5xl font-bold tracking-wider text-navy">{done.booking.reference}</p>
              <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
                {done.booking.passengers.map((p, i) => (
                  <li key={p + i} className="flex justify-between px-4 py-2"><span className="font-semibold">{p}</span><span className="font-display text-xl font-bold text-navy">Seat {done.booking.seatNumbers[i]}</span></li>
                ))}
              </ul>
              <p className="mt-4 text-lg">{done.booking.seats} seat{done.booking.seats > 1 && 's'}, <strong>{formatPKR(done.booking.total)}</strong></p>
              <p className="mt-1 text-sm text-mute">
                {AIRPORTS[offer.origin]} to {AIRPORTS[offer.destination]}. Demo mode: no payment was taken. In production the fare is charged by {offer.airlineName}.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href={`/ticket/${done.booking.bookingId}`} target="_blank" className="rounded-md bg-sign px-4 py-2 font-semibold text-navy hover:brightness-95">View e-ticket</Link>
                <Link href="/dashboard/bookings" className="rounded-md bg-navy px-4 py-2 font-semibold text-white">{channel === 'agency' ? 'View agency bookings' : 'View my bookings'}</Link>
                <a href={done.ticketingUrl} target="_blank" rel="noopener noreferrer" className="rounded-md border border-line px-4 py-2 font-semibold hover:border-mute">Airline e-ticket page</a>
              </div>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}

function Seat({ label, view, selected, onToggle }: { label: string; view?: SeatView; selected: boolean; onToggle: (l: string, el: HTMLElement) => void }) {
  const pickable = view === 'open' || view === 'mine';
  const state = selected ? 'selected' : !view ? 'not released' : view === 'held' ? 'held by another customer' : view === 'booked' ? 'booked' : 'available';
  return (
    <button type="button" data-seat {...(view && { 'data-released': '' })} disabled={!pickable} aria-pressed={pickable ? selected : undefined}
      aria-label={`Seat ${label}, ${state}${view ? `, ${seatDescription(label).toLowerCase()}` : ''}`} title={view ? `${label}: ${seatDescription(label)}` : undefined}
      onClick={(e) => onToggle(label, e.currentTarget)}
      className={cx('h-8 w-8 rounded-t-lg rounded-b-sm border-2 text-[10px] font-bold transition-colors',
        selected ? 'border-go bg-go text-white'
          : view === 'open' || view === 'mine' ? 'border-sign bg-sign text-navy hover:brightness-95'
            : view === 'held' ? 'cursor-not-allowed border-line bg-[repeating-linear-gradient(45deg,#d9dfe8_0_3px,#fff_3px_6px)] text-mute'
              : view === 'booked' ? 'cursor-not-allowed border-navy bg-navy text-white/70'
                : 'cursor-default border-line bg-card text-transparent opacity-60')}>
      {view ? label.replace(/\d+/, '') : ''}
    </button>
  );
}

function Legend({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <li className="flex items-center gap-2"><span aria-hidden className={cx('h-4 w-4 rounded-t-md rounded-b-sm border-2', cls)} />{children}</li>;
}

function Steps({ step }: { step: Step }) {
  const steps: [Step, string][] = [['seats', 'Seats'], ['details', 'Passengers'], ['done', 'Confirmed']];
  const at = steps.findIndex(([s]) => s === step);
  return (
    <ol className="flex border-b border-line text-sm" aria-label="Booking progress">
      {steps.map(([s, label], i) => (
        <li key={s} aria-current={i === at ? 'step' : undefined}
          className={cx('flex-1 border-b-2 px-3 py-2 text-center font-semibold', i === at ? 'border-sign text-navy' : i < at ? 'border-go text-go' : 'border-transparent text-mute')}>
          {i < at ? '✓ ' : `${i + 1}. `}{label}
        </li>
      ))}
    </ol>
  );
}

const HELP_KEY = 'flylast-booking-help-collapsed';

/** Step-by-step instructions; remembers if the viewer collapsed them (per browser only). */
function HowItWorks() {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem(HELP_KEY) === '1') setOpen(false);
    } catch {}
  }, []);
  return (
    <details open={open} onToggle={(e) => {
      const isOpen = (e.currentTarget as HTMLDetailsElement).open;
      setOpen(isOpen);
      try { localStorage.setItem(HELP_KEY, isOpen ? '0' : '1'); } catch {}
    }} className="rounded-lg border border-sign/60 bg-sign/10 p-3 text-sm">
      <summary className="cursor-pointer font-semibold text-navy">How booking works</summary>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink">
        <li>Tap yellow seats on the map, or use <strong>Seat us together</strong> for your party.</li>
        <li>Click <strong>Hold seats</strong>. Nobody else can take them for {HOLD_LABEL}.</li>
        <li>Enter each passenger&apos;s name as on their CNIC or passport, and a phone or email.</li>
        <li>Confirm before the timer ends. If it runs out, the seats are released.</li>
        <li>Show your booking reference at check-in. Print the e-ticket from My Bookings.</li>
      </ol>
      <p className="mt-2 text-mute">You can cancel from My Bookings until the airline&apos;s booking cutoff, and the seats go back on sale.</p>
    </details>
  );
}
