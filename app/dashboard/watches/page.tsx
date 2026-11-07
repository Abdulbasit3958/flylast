'use client';
import { useState } from 'react';
import { Button, Empty, Field, inputCls, Notice, PageTitle, useLoad } from '@/components/ui';
import { AIRPORTS } from '@/lib/domain';
import { api } from '@/lib/firebase-client';

type Watch = { id: string; origin: string; destination: string };

export default function Watches() {
  const { data, error, reload, setError } = useLoad(() => api<{ watches: Watch[]; limit: number }>('/api/watches'));
  const [origin, setOrigin] = useState('KHI');
  const [destination, setDestination] = useState('ISB');

  const act = (fn: () => Promise<unknown>) => async () => {
    setError('');
    try {
      await fn();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const used = data?.watches.length ?? 0;
  return (
    <>
      <PageTitle title="Watched routes">
        We show released seats on these routes in Notifications, as long as your plan covers the offer.
      </PageTitle>
      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-card p-4" onSubmit={(e) => { e.preventDefault(); act(() => api('/api/watches', { body: { origin, destination } }))(); }}>
        <Field label="From">
          <select className={inputCls} value={origin} onChange={(e) => setOrigin(e.target.value)}>
            {Object.entries(AIRPORTS).map(([c, n]) => <option key={c} value={c}>{n} ({c})</option>)}
          </select>
        </Field>
        <Field label="To">
          <select className={inputCls} value={destination} onChange={(e) => setDestination(e.target.value)}>
            {Object.entries(AIRPORTS).map(([c, n]) => <option key={c} value={c}>{n} ({c})</option>)}
          </select>
        </Field>
        <Button type="submit" disabled={!!data && used >= data.limit}>Watch route</Button>
        {data && <p className="text-sm text-mute">{used} of {data.limit} watches used</p>}
      </form>
      <div className="mt-3"><Notice>{error}</Notice></div>
      <div className="mt-6">
        {data && !used && <Empty>No routes watched yet. Add the trips you take most.</Empty>}
        <ul className="grid gap-3 sm:grid-cols-2">
          {data?.watches.map((w) => (
            <li key={w.id} className="flex items-center justify-between rounded-lg border border-line bg-card px-4 py-3">
              <span className="font-display text-3xl font-bold text-navy">{w.origin} › {w.destination}</span>
              <Button variant="ghost" className="text-sm" onClick={act(() => api('/api/watches', { method: 'DELETE', body: { id: w.id } }))}>Stop watching</Button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
