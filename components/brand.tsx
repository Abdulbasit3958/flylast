import Link from 'next/link';

export function Logo({ light }: { light?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2 font-display text-2xl font-bold tracking-tight">
      <span aria-hidden className="grid h-7 w-7 place-items-center rounded-sm bg-sign text-base text-navy">FL</span>
      <span className={light ? 'text-white' : 'text-navy'}>FlyLast</span>
    </Link>
  );
}
