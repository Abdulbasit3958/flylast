'use client';
import { Button, Empty, Notice, PageTitle, useLoad } from '@/components/ui';
import { api } from '@/lib/firebase-client';

type Agency = { uid: string; orgName: string; email: string; authorized: boolean };

export default function AirlineAgencies() {
  const { data, error, reload, setError } = useLoad(() => api<{ agencies: Agency[] }>('/api/airline/agencies'));
  async function set(a: Agency) {
    try {
      await api('/api/airline/agencies', { body: { agencyId: a.uid, active: !a.authorized } });
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <PageTitle title="Agency access">
        Choose which approved travel agencies may distribute your offers. Agencies see your live offers read-only and can&apos;t change price, seats or timing.
      </PageTitle>
      <Notice>{error}</Notice>
      {data && !data.agencies.length && <Empty>No approved travel agencies on FlyLast yet.</Empty>}
      <ul className="divide-y divide-line rounded-lg border border-line bg-card">
        {data?.agencies.map((a) => (
          <li key={a.uid} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-semibold">{a.orgName}</p>
              <p className="text-sm text-mute">{a.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={a.authorized ? 'text-sm font-semibold text-go' : 'text-sm text-mute'}>{a.authorized ? 'Authorized' : 'No access'}</span>
              <Button variant={a.authorized ? 'danger' : 'dark'} onClick={() => set(a)}>{a.authorized ? 'Revoke access' : 'Authorize'}</Button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
