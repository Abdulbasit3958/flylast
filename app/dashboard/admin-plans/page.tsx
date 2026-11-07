'use client';
import { useState } from 'react';
import { Button, Field, inputCls, Notice, PageTitle, useLoad } from '@/components/ui';
import { AUDIENCE_LABEL, type Audience, type Plan } from '@/lib/domain';
import { api } from '@/lib/firebase-client';

export default function AdminPlans() {
  const { data, error, reload } = useLoad(() => api<{ plans: Plan[] }>('/api/admin/plans'));
  return (
    <>
      <PageTitle title="Plan configuration">
        Configure the traveller plans. Price changes apply to new activations; existing subscriptions keep the price they were activated at.
      </PageTitle>
      <Notice>{error}</Notice>
      <div className="grid gap-4 lg:grid-cols-3">
        {data?.plans.map((p) => <PlanEditor key={p.planId} plan={p} onSaved={reload} />)}
      </div>
    </>
  );
}

function PlanEditor({ plan, onSaved }: { plan: Plan; onSaved: () => void }) {
  const [p, setP] = useState(plan);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const toggleTier = (t: Audience) =>
    setP({ ...p, eligibleOfferTiers: p.eligibleOfferTiers.includes(t) ? p.eligibleOfferTiers.filter((x) => x !== t) : [...p.eligibleOfferTiers, t] });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api('/api/admin/plans', { method: 'PATCH', body: p });
      setMsg({ tone: 'ok', text: 'Plan saved.' });
      onSaved();
    } catch (err) {
      setMsg({ tone: 'error', text: (err as Error).message });
    }
  }

  return (
    <form onSubmit={save} className="space-y-3 rounded-lg border border-line bg-card p-5">
      <Field label="Plan name"><input className={inputCls} value={p.planName} onChange={(e) => setP({ ...p, planName: e.target.value })} /></Field>
      <Field label="Monthly price (PKR)"><input className={inputCls} type="number" min={1} value={p.monthlyPrice} onChange={(e) => setP({ ...p, monthlyPrice: Number(e.target.value) })} /></Field>
      <Field label="Watched route limit"><input className={inputCls} type="number" min={0} value={p.maxRouteWatches} onChange={(e) => setP({ ...p, maxRouteWatches: Number(e.target.value) })} /></Field>
      <fieldset>
        <legend className="mb-1 text-sm font-semibold">Offer tiers this plan can access</legend>
        {(Object.keys(AUDIENCE_LABEL) as Audience[]).map((t) => (
          <label key={t} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={p.eligibleOfferTiers.includes(t)} onChange={() => toggleTier(t)} /> {AUDIENCE_LABEL[t]}
          </label>
        ))}
      </fieldset>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.aiEnabled} onChange={(e) => setP({ ...p, aiEnabled: e.target.checked })} /> AI Deal Finder included</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.isActive} onChange={(e) => setP({ ...p, isActive: e.target.checked })} /> Available to new subscribers</label>
      <Notice tone={msg?.tone}>{msg?.text}</Notice>
      <Button type="submit" className="w-full">Save {p.planName}</Button>
    </form>
  );
}
