import { Logo } from './brand';

export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_1.2fr]">
      <aside className="hidden flex-col justify-between bg-navy p-10 text-white lg:flex">
        <Logo light />
        <p className="font-display text-5xl font-bold leading-[0.95]">
          Last-minute seats,
          <br />
          released by the airline.
        </p>
        <p className="text-sm text-white/60">Subscriptions are for individual travellers. Airlines and agencies join free.</p>
      </aside>
      <section className="flex flex-col justify-center px-4 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h1 className="mb-6 font-display text-4xl font-semibold text-navy">{title}</h1>
          {children}
        </div>
      </section>
    </main>
  );
}

export function authMessage(e: unknown) {
  const code = (e as { code?: string }).code ?? '';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'Email or password is incorrect.';
  if (code.includes('email-already-in-use')) return 'An account with this email already exists. Sign in instead.';
  if (code.includes('weak-password')) return 'Use a password with at least 6 characters.';
  if (code.includes('invalid-email')) return 'Enter a valid email address.';
  if (code.includes('network-request-failed')) return 'Can’t reach the sign-in service. Is the Firebase emulator running?';
  return (e as Error).message;
}
