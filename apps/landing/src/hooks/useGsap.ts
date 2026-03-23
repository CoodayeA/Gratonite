'use client';

import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Wraps gsap.context() for automatic cleanup on unmount.
 * If the user prefers reduced motion, the callback is a no-op.
 */
export function useGsap(
  callback: (self: gsap.Context) => void,
  deps: React.DependencyList = [],
) {
  const containerRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!containerRef.current) return;
    if (prefersReducedMotion) {
      // Show all elements immediately when reduced motion is preferred
      containerRef.current.querySelectorAll<HTMLElement>('[style*="opacity"]').forEach(el => {
        el.style.opacity = '1';
      });
      return;
    }
    const ctx = gsap.context(callback, containerRef.current);
    return () => ctx.revert();
  }, deps);

  return containerRef;
}

export { gsap, ScrollTrigger, prefersReducedMotion };
