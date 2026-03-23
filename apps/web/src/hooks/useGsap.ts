import { useRef, useEffect, useCallback } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Wraps gsap.context() for automatic cleanup on unmount.
 * Returns a stable `ctx` callback that receives (self) => void.
 * If the user prefers reduced motion, the callback is a no-op and
 * elements are set to their final state immediately.
 */
export function useGsap(
  callback: (self: gsap.Context) => void,
  deps: React.DependencyList = [],
) {
  const containerRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (prefersReducedMotion || !containerRef.current) return;
    const ctx = gsap.context(callback, containerRef.current);
    return () => ctx.revert();
  }, deps);

  return containerRef;
}

/** Fire-and-forget tween that respects reduced motion. */
export function gsapTo(
  targets: gsap.TweenTarget,
  vars: gsap.TweenVars,
) {
  if (prefersReducedMotion) return gsap.set(targets, { ...vars, duration: 0 });
  return gsap.to(targets, vars);
}

export { gsap, ScrollTrigger, prefersReducedMotion };
