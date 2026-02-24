const hasPerf = typeof window !== 'undefined' && typeof performance !== 'undefined';
const enabled =
  hasPerf &&
  (import.meta.env.DEV || import.meta.env['VITE_ENABLE_PERF_TELEMETRY'] === '1');

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

function randomToken() {
  return Math.random().toString(36).slice(2, 10);
}

const activeInteractions = new Map<string, { name: string; token: string; startMark: string }>();

export function startInteraction(name: string, metadata?: Record<string, string>) {
  if (!enabled) return null;
  const token = randomToken();
  const startMark = `${name}:${token}:start`;
  performance.mark(startMark);
  if (metadata && Object.keys(metadata).length > 0) {
    console.debug(`[perf] ${name} start`, metadata);
  }
  return { name, token, startMark };
}

export function endInteractionAfterPaint(
  interaction: { name: string; token: string; startMark: string } | null,
  metadata?: Record<string, string | number>,
) {
  if (!enabled || !interaction) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const endMark = `${interaction.name}:${interaction.token}:paint`;
      const measureName = `${interaction.name}:${interaction.token}`;
      performance.mark(endMark);
      try {
        performance.measure(measureName, interaction.startMark, endMark);
        const entries = performance.getEntriesByName(measureName);
        const last = entries[entries.length - 1];
        if (last) {
          console.debug(`[perf] ${interaction.name}: ${last.duration.toFixed(1)}ms`, metadata ?? {});
        }
      } finally {
        performance.clearMarks(interaction.startMark);
        performance.clearMarks(endMark);
        performance.clearMeasures(measureName);
      }
    });
  });
}

export function startNamedInteraction(key: string, name: string, metadata?: Record<string, string>) {
  if (!enabled) return;
  const started = startInteraction(name, metadata);
  if (!started) return;
  activeInteractions.set(key, started);
}

export function endNamedInteractionAfterPaint(
  key: string,
  metadata?: Record<string, string | number>,
) {
  if (!enabled) return;
  const interaction = activeInteractions.get(key) ?? null;
  if (!interaction) return;
  activeInteractions.delete(key);
  endInteractionAfterPaint(interaction, metadata);
}
