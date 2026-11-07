'use client';
import { useState } from 'react';
import { useAuth } from '@/components/auth';
import { Button, fmtTime, Notice, PageTitle, PlanCards, useLoad } from '@/components/ui';
import { formatPKR, type Plan } from '@/lib/domain';
import { api } from '@/lib/firebase-client';

export default function SubscriptionPage() {
  const { me, refresh } = useAuth();
  const { data } = useLoad(() => api<{ plans: Plan[] }>('/api/plans'));
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const { sub, plan, history = [] } = me ?? {};

  async function run(id: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(id);
    setMsg(null);
    try {
      await fn();
      await refresh();
      setMsg({ tone: 'ok', text: ok });
    } catch (e) {
      setMsg({ tone: 'error', text: (e as Error).message });
    }
    setBusy(null);
  }

  return (
    <>
      <PageTitle title="My subscription" />
      <section className="rounded-lg border border-line bg-card p-5">
        {sub && plan ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-display text-3xl font-semibold text-navy">{plan.planName}</p>
              <p className="text-mute">
                Active until {fmtTime(sub.expiryDate)}. {formatPKR(sub.priceAtPurchase)} per month{sub.demoMode && ', demo mode (no charge)'}.
              </p>
            </div>
            <Button variant="danger" disabled={!!busy} onClick={() => run('cancel', () => api('/api/subscriptions/cancel', { method: 'POST' }), 'Subscription cancelled.')}>
              {busy === 'cancel' ? 'Cancelling…' : 'Cancel subscription'}
            </Button>
          </div>
        ) : (
          <p className="text-mute">No active plan. Pick one below to unlock fares, route watches and booking links.</p>
        )}
      </section>
      <div className="mt-3"><Notice tone={msg?.tone}>{msg?.text}</Notice></div>

      <h2 className="mb-1 mt-10 font-display text-3xl font-semibold text-navy">Subscription plans</h2>
      <p className="mb-5 text-mute">Demo mode activates a plan instantly for 30 days without taking payment. Switching plans replaces your current one.</p>
      <PlanCards plans={data?.plans ?? []} currentPlanId={plan?.planId} busy={busy} cta="Activate"
        onPick={(p) => run(p.planId, () => api('/api/subscriptions/activate', { body: { planId: p.planId } }), `${p.planName} is active. Your offers are unlocked.`)} />

      {history.length > 0 && (
        <>
          <h2 className="mb-3 mt-10 font-display text-2xl font-semibold text-navy">History</h2>
          <ul className="divide-y divide-line rounded-lg border border-line bg-card">
            {history.map((h) => (
              <li key={h.subscriptionId} className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm">
                <span className="font-semibold capitalize">{h.planId}</span>
                <span className="text-mute">{fmtTime(h.startDate)} to {fmtTime(h.expiryDate)}</span>
                <span>{formatPKR(h.priceAtPurchase)}</span>
                <span className={h.status === 'active' && h.expiryDate > Date.now() ? 'text-go' : 'text-mute'}>
                  {h.status === 'active' && h.expiryDate > Date.now() ? 'Active' : h.status === 'active' ? 'Expired' : 'Cancelled'}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
