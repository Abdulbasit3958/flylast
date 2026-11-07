'use client';
import { signInWithEmailAndPassword } from 'firebase/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/components/auth';
import { AuthShell, authMessage } from '@/components/auth-shell';
import { Button, Field, inputCls, Notice } from '@/components/ui';
import { auth } from '@/lib/firebase-client';

const DEMO = ['traveller', 'airline', 'agency', 'admin'];

export default function Login() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      await refresh();
      router.push('/dashboard');
    } catch (err) {
      setError(authMessage(err));
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Sign in">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <input className={inputCls} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <input className={inputCls} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Notice>{error}</Notice>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
      </form>
      <p className="mt-6 text-mute">
        New to FlyLast? <Link className="font-semibold text-navy underline" href="/register">Create an account</Link>
      </p>
      {process.env.NEXT_PUBLIC_USE_EMULATOR === '1' && (
        <div className="mt-8 rounded-lg border border-line bg-card p-4 text-sm">
          <p className="font-semibold">Demo accounts (password demo1234)</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DEMO.map((r) => (
              <button key={r} type="button" className="rounded border border-line px-2 py-1 hover:border-navy" onClick={() => { setEmail(`${r}@flylast.demo`); setPassword('demo1234'); }}>
                {r}
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthShell>
  );
}
