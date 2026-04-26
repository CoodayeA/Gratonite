// Lazy GSAP loader: keeps the heavy gsap bundle off the critical path.
// Callers `await loadGsap()` inside effects so gsap is fetched only when
// an animation is actually about to run.
let gsapPromise: Promise<typeof import('gsap').default> | null = null;

export function loadGsap(): Promise<typeof import('gsap').default> {
  if (!gsapPromise) {
    gsapPromise = import('gsap').then((m) => m.default);
  }
  return gsapPromise;
}
