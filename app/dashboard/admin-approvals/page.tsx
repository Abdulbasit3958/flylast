'use client';
import { useState } from 'react';
import { Reveal } from '@/components/motion';
import { Button, cx, fmtTime, Notice, PageTitle, useLoad } from '@/components/ui';
import type { AppUser } from '@/lib/domain';
import { api } from '@/lib/firebase-client';

const ROLE = { traveller: 'Traveller', airline: 'Airline', agency: 'Travel agency', admin: 'Admin' };
const TABS = [
  { id: 'all', label: 'All users', match: () => true },
  { id: 'pending', label: 'Pending approval', match: (u: AppUser) => u.status === 'pending' },
  { id: 'traveller', label: 'Travellers', match: (u: AppUser) => u.role === 'traveller' },
  { id: 'airline', label: 'Airlines', match: (u: AppUser) => u.role === 'airline' },
  { id: 'agency', label: 'Travel agencies', match: (u: AppUser) => u.role === 'agency' },
  { id: 'admin', label: 'Admins', match: (u: AppUser) => u.role === 'admin' },
] as const;

export default function Users() {
  const { data, error, reload, setError } = useLoad(() => api<{ users: AppUser[] }>('/api/admin/users'));
  const [tab, setTab] = useState<(typeof TABS)[number]['id'] | null>(null);
  const [msg, setMsg] = useState('');
  const users = data?.users ?? [];
  const pending = users.filter((u) => u.status === 'pending').length;
  const active = tab ?? (pending ? 'pending' : 'all');
  const shown = users.filter(TABS.find((t) => t.id === active)!.match);

  async function decide(u: AppUser, status: 'approved' | 'rejected') {
    setTab(active); // stay on the current view while the queue updates
    try {
      await api('/api/admin/users', { body: { uid: u.uid, status } });
      setMsg(`${u.orgName} ${status === 'approved' ? 'approved. They can sign in and start now.' : 'rejected.'}`);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <PageTitle title="Users & approvals">
        Everyone registered on FlyLast. Airlines and travel agencies join free but need approval before they can release or sell seats.
      </PageTitle>
      <Notice>{error}</Notice>
      <div className="mb-3"><Notice tone="ok">{msg}</Notice></div>

      <div role="tablist" aria-label="Filter users" className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const n = users.filter(t.match).length;
          return (
            <button key={t.id} role="tab" aria-selected={active === t.id} onClick={() => setTab(t.id)}
              className={cx('shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold',
                active === t.id ? 'border-navy bg-navy text-white' : 'border-line bg-card text-ink hover:border-mute')}>
              {t.label} <span className={cx('ml-1 rounded-full px-1.5', active === t.id ? 'bg-sign text-navy' : t.id === 'pending' && n ? 'bg-sign/40' : 'bg-paper')}>{n}</span>
            </button>
          );
        })}
      </div>

      <ul className="divide-y divide-line rounded-lg border border-line bg-card">
        {data && !shown.length && <li className="px-4 py-6 text-mute">No users in this view.</li>}
        <Reveal key={active}>
          {shown.map((u) => {
            const business = u.role === 'airline' || u.role === 'agency';
            return (
              <li key={u.uid} className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0">
                <div className="min-w-0">
                  <p className="font-semibold">{u.orgName ?? u.name} <span className="font-normal text-mute">({ROLE[u.role]})</span></p>
                  <p className="text-sm text-mute">{business && `${u.name}, `}{u.email}. Joined {fmtTime(u.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cx('rounded px-2 py-0.5 text-sm font-semibold capitalize', u.status === 'approved' ? 'bg-go/10 text-go' : u.status === 'pending' ? 'bg-sign/30 text-navy' : 'bg-stop/10 text-stop')}>
                    {u.status === 'approved' && !business ? 'Active' : u.status}
                  </span>
                  {business && u.status !== 'approved' && <Button onClick={() => decide(u, 'approved')}>Approve</Button>}
                  {business && u.status !== 'rejected' && <Button variant="danger" onClick={() => decide(u, 'rejected')}>{u.status === 'approved' ? 'Suspend' : 'Reject'}</Button>}
                </div>
              </li>
            );
          })}
        </Reveal>
      </ul>
    </>
  );
}
