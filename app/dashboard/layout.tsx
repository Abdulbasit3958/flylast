'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/components/auth';
import { Logo } from '@/components/brand';
import { PageFade } from '@/components/motion';
import { Button, cx } from '@/components/ui';
import type { Role } from '@/lib/domain';

// One nav per role. Business and admin roles have no subscription entries by design;
// this map is also the frontend route guard (unlisted paths redirect to the role's home).
const NAV: Record<Role, { href: string; label: string }[]> = {
  traveller: [
    { href: '/dashboard/offers', label: 'Exclusive Offers' },
    { href: '/dashboard/bookings', label: 'My Bookings' },
    { href: '/dashboard/subscription', label: 'My Subscription' },
    { href: '/dashboard/watches', label: 'Watched Routes' },
    { href: '/dashboard/ai', label: 'AI Deal Finder' },
    { href: '/dashboard/notifications', label: 'Notifications' },
  ],
  airline: [
    { href: '/dashboard/airline-offers', label: 'Empty-seat Releases' },
    { href: '/dashboard/bookings', label: 'Bookings & Manifest' },
    { href: '/dashboard/airline-agencies', label: 'Agency Access' },
  ],
  agency: [
    { href: '/dashboard/agency-offers', label: 'Authorized Releases' },
    { href: '/dashboard/bookings', label: 'Agency Bookings' },
  ],
  admin: [
    { href: '/dashboard/admin', label: 'Revenue & Activity' },
    { href: '/dashboard/admin-approvals', label: 'Users & Approvals' },
    { href: '/dashboard/admin-subscriptions', label: 'Traveller Subscriptions' },
    { href: '/dashboard/admin-plans', label: 'Plan Configuration' },
  ],
};

const NONE: { href: string; label: string }[] = [];
const ROLE_LABEL: Record<Role, string> = { traveller: 'Traveller', airline: 'Airline', agency: 'Travel agency', admin: 'Administrator' };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { fbUser, me, loading, logout } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const user = me?.user;
  const nav = user ? NAV[user.role] : NONE;
  const allowed = nav.some((n) => n.href === path);

  useEffect(() => {
    if (loading) return;
    if (!fbUser) router.replace('/login');
    else if (user?.status === 'approved' && !allowed) router.replace(nav[0].href);
  }, [loading, fbUser, user, allowed, nav, router]);

  if (loading || !fbUser) return <p className="p-8 text-mute">Loading…</p>;

  const signOut = async () => {
    await logout();
    router.replace('/');
  };

  if (!user || user.status !== 'approved') {
    return (
      <main className="mx-auto max-w-lg px-4 py-20">
        <Logo />
        <h1 className="mt-8 font-display text-4xl font-semibold text-navy">
          {!user ? 'Finish creating your account' : user.status === 'pending' ? 'Awaiting admin approval' : 'Registration not approved'}
        </h1>
        <p className="mt-3 text-mute">
          {!user
            ? 'Your login exists but your FlyLast profile doesn’t. Complete registration to continue.'
            : user.status === 'pending'
              ? `Thanks for registering ${user.orgName}. The FlyLast team reviews every airline and travel agency before they can use the marketplace. Business accounts are free, with no subscription.`
              : 'The FlyLast team did not approve this business account. Contact support if you think this is a mistake.'}
        </p>
        <div className="mt-6 flex gap-3">
          {!user && <Link href="/register" className="rounded-md bg-navy px-4 py-2 font-semibold text-white">Complete registration</Link>}
          <Button variant="ghost" onClick={signOut}>Sign out</Button>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr] print:block">
      <aside className="bg-navy text-white print:hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="flex items-center justify-between px-4 py-4 lg:block lg:px-5 lg:py-6">
          <Logo light />
          <Button variant="ghost" className="border-white/20 bg-transparent px-3 py-1 text-sm text-white lg:hidden" onClick={signOut}>Sign out</Button>
        </div>
        <nav aria-label="Dashboard" className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-1 lg:flex-col lg:px-3">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} aria-current={n.href === path ? 'page' : undefined}
              className={cx('shrink-0 rounded-md px-3 py-2 font-medium', n.href === path ? 'bg-sign text-navy' : 'text-white/80 hover:bg-white/10')}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden border-t border-white/10 p-5 text-sm lg:block">
          <p className="font-semibold">{user.orgName ?? user.name}</p>
          <p className="text-white/60">{ROLE_LABEL[user.role]}{user.role === 'traveller' && me?.plan && ` · ${me.plan.planName} plan`}</p>
          <button className="mt-3 text-white/80 underline hover:text-white" onClick={signOut}>Sign out</button>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-10">{allowed ? <PageFade key={path}>{children}</PageFade> : null}</main>
    </div>
  );
}
