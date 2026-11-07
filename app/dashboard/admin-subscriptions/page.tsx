'use client';
import { Button, fmtTime, Notice, PageTitle, useLoad } from '@/components/ui';
import { formatPKR, type Subscription } from '@/lib/domain';
import { api } from '@/lib/firebase-client';

type Row = Subscription & { travellerName: string; travellerEmail: string; isActive: boolean };

export default function AdminSubscriptions() {
  const { data, error, reload, setError } = useLoad(() => api<{ subscriptions: Row[] }>('/api/admin/subscriptions'));
  async function cancel(id: string) {
    try {
      await api('/api/admin/subscriptions', { body: { subscriptionId: id } });
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <PageTitle title="Traveller subscriptions">Every subscription belongs to an individual traveller. Business and admin accounts can&apos;t hold one.</PageTitle>
      <Notice>{error}</Notice>
      <div className="overflow-x-auto rounded-lg border border-line bg-card">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line text-mute">
            <tr><th className="px-4 py-2 font-medium">Traveller</th><th className="font-medium">Plan</th><th className="font-medium">Period</th><th className="font-medium">Price</th><th className="font-medium">Status</th><th /></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data && !data.subscriptions.length && <tr><td colSpan={6} className="px-4 py-6 text-mute">No traveller has subscribed yet.</td></tr>}
            {data?.subscriptions.map((s) => (
              <tr key={s.subscriptionId}>
                <td className="px-4 py-2"><p className="font-semibold">{s.travellerName}</p><p className="text-mute">{s.travellerEmail}</p></td>
                <td className="capitalize">{s.planId}{s.demoMode && <span className="text-mute"> (demo)</span>}</td>
                <td>{fmtTime(s.startDate)} to {fmtTime(s.expiryDate)}</td>
                <td>{formatPKR(s.priceAtPurchase)}</td>
                <td className={s.isActive ? 'font-semibold text-go' : 'text-mute'}>{s.isActive ? 'Active' : s.status === 'cancelled' ? 'Cancelled' : 'Expired'}</td>
                <td className="pr-4 text-right">{s.isActive && <Button variant="danger" className="px-3 py-1 text-sm" onClick={() => cancel(s.subscriptionId)}>Cancel</Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
