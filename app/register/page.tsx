'use client';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth';
import { AuthShell, authMessage } from '@/components/auth-shell';
import { Button, cx, Field, inputCls, Notice } from '@/components/ui';
import { api, auth } from '@/lib/firebase-client';

const TYPES = [
  { role: 'traveller', label: 'Traveller', note: 'Free account. Pick a subscription plan to unlock fares and booking links.' },
  { role: 'airline', label: 'Airline', note: 'Free, no subscription. Our team approves your account before you can publish offers.' },
  { role: 'agency', label: 'Travel agency', note: 'Free, no subscription. Our team approves your account; airlines authorize which offers you can sell.' },
] as const;
type RoleType = (typeof TYPES)[number]['role'];

export default function Register() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [role, setRole] = useState<RoleType>('traveller');
  const [form, setForm] = useState({ name: '', orgName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('type');
    if (t === 'airline' || t === 'agency') setRole(t);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await createUserWithEmailAndPassword(auth, form.email, form.password).catch(async (err) => {
        // Finish a registration that created the login but not the profile.
        if (!String(err.code).includes('email-already-in-use')) throw err;
        await signInWithEmailAndPassword(auth, form.email, form.password);
      });
      await api('/api/register', { body: { role, name: form.name, orgName: form.orgName } });
      await refresh();
      router.push(role === 'traveller' ? '/dashboard/subscription' : '/dashboard');
    } catch (err) {
      setError(authMessage(err));
      setBusy(false);
    }
  }

  const current = TYPES.find((t) => t.role === role)!;
  return (
    <AuthShell title="Create your account">
      <div role="tablist" aria-label="Account type" className="mb-2 grid grid-cols-3 rounded-md border border-line bg-card p-1">
        {TYPES.map((t) => (
          <button key={t.role} role="tab" aria-selected={role === t.role} type="button" onClick={() => setRole(t.role)}
            className={cx('rounded px-2 py-2 text-sm font-semibold', role === t.role ? 'bg-navy text-white' : 'text-mute hover:text-ink')}>
            {t.label}
          </button>
        ))}
      </div>
      <p className="mb-6 text-sm text-mute">{current.note}</p>
      <form onSubmit={submit} className="space-y-4">
        <Field label={role === 'traveller' ? 'Your name' : 'Contact person'}>
          <input className={inputCls} required autoComplete="name" value={form.name} onChange={set('name')} />
        </Field>
        {role !== 'traveller' && (
          <Field label={role === 'airline' ? 'Airline name' : 'Agency name'}>
            <input className={inputCls} required autoComplete="organization" value={form.orgName} onChange={set('orgName')} />
          </Field>
        )}
        <Field label="Email">
          <input className={inputCls} type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Password" hint="At least 6 characters.">
          <input className={inputCls} type="password" required minLength={6} autoComplete="new-password" value={form.password} onChange={set('password')} />
        </Field>
        <Notice>{error}</Notice>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Creating account…' : role === 'traveller' ? 'Create traveller account' : 'Register for approval'}
        </Button>
      </form>
      <p className="mt-6 text-mute">
        Already registered? <Link className="font-semibold text-navy underline" href="/login">Sign in</Link>
      </p>
    </AuthShell>
  );
}
