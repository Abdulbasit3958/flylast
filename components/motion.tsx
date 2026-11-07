'use client';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { Children, useRef } from 'react';

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);
export { gsap, ScrollTrigger, SplitText, useGSAP };

export const MOTION_OK = '(prefers-reduced-motion: no-preference)';

/** Staggers its element children in once, the first time it has any (i.e. after data loads). */
export function Reveal({ className, children, y = 14 }: { className?: string; children: React.ReactNode; y?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const count = Children.toArray(children).filter(Boolean).length;
  useGSAP(
    () => {
      const items = ref.current?.children;
      if (done.current || !items?.length) return;
      done.current = true;
      gsap.matchMedia().add(MOTION_OK, () => {
        gsap.from(items, { y, autoAlpha: 0, duration: 0.55, stagger: 0.07, ease: 'power3.out', clearProps: 'all' });
      });
    },
    { scope: ref, dependencies: [count] },
  );
  return <div ref={ref} className={className}>{children}</div>;
}

/** Soft entrance for each dashboard page (keyed by path in the layout). */
export function PageFade({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    gsap.matchMedia().add(MOTION_OK, () => {
      gsap.from(ref.current, { y: 10, autoAlpha: 0, duration: 0.45, ease: 'power2.out', clearProps: 'all' });
    });
  });
  return <div ref={ref}>{children}</div>;
}
