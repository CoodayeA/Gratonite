/**
 * Web client feature experiments. Enable at build time via Vite env:
 *   VITE_EXPERIMENT_<SCREAMING_SNAKE_ID>=1
 * Example: VITE_EXPERIMENT_VERBOSE_SOCKET_LOGS=1
 */

export const WEB_EXPERIMENTS = [
  {
    id: 'verbose_socket_logs',
    description: 'In development, log Socket.IO event names and payloads to the console.',
  },
  {
    id: 'reduced_motion_composer',
    description: 'Reduce motion globally (animations/transitions ~0ms) for accessibility testing.',
  },
] as const;

export type WebExperimentId = (typeof WEB_EXPERIMENTS)[number]['id'];

function envKey(id: WebExperimentId): string {
  return `VITE_EXPERIMENT_${id.toUpperCase()}`;
}

export function isExperimentEnabled(id: WebExperimentId): boolean {
  const key = envKey(id);
  const v = (import.meta.env as Record<string, string | boolean | undefined>)[key];
  return v === '1' || v === 'true' || v === true;
}

export function getWebExperimentSnapshot(): Array<{ id: WebExperimentId; description: string; envKey: string; enabled: boolean }> {
  return WEB_EXPERIMENTS.map((e) => ({
    id: e.id,
    description: e.description,
    envKey: envKey(e.id),
    enabled: isExperimentEnabled(e.id),
  }));
}

/** Call once at startup (e.g. from main.tsx) to apply body classes and other side effects. */
export function applyWebExperimentsToDocument(): void {
  if (typeof document === 'undefined') return;
  document.body.classList.toggle('gratonite-exp-reduced-motion', isExperimentEnabled('reduced_motion_composer'));
}
