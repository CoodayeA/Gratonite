const enabled = import.meta.env.DEV && typeof window !== 'undefined' && typeof performance !== 'undefined';

export function mark(name: string) {
  if (!enabled) return;
  performance.mark(name);
}

export function measure(name: string, start: string, end: string) {
  if (!enabled) return;
  try {
    performance.measure(name, start, end);
    const entries = performance.getEntriesByName(name);
    const last = entries[entries.length - 1];
    if (last) {
      console.debug(`[perf] ${name}: ${last.duration.toFixed(1)}ms`);
    }
  } finally {
    performance.clearMarks(start);
    performance.clearMarks(end);
    performance.clearMeasures(name);
  }
}

export function profileRender(
  id: string,
  phase: 'mount' | 'update' | 'nested-update',
  actualDuration: number,
  baseDuration: number,
) {
  if (!enabled) return;
  console.debug(
    `[render] ${id} ${phase} ${actualDuration.toFixed(1)}ms (base ${baseDuration.toFixed(1)}ms)`,
  );
}
