// ---------------------------------------------------------------------------
// Client-side error reporter
// Captures unhandled errors and promise rejections, deduplicates, batches,
// and sends them to the API. Uses fetch directly to avoid circular deps.
// ---------------------------------------------------------------------------

const API_URL = (import.meta.env.VITE_API_URL ?? '/api/v1').replace(/\/$/, '');
const ENDPOINT = `${API_URL.endsWith('/api/v1') ? API_URL : `${API_URL}/api/v1`}/client-errors`;

const MAX_PER_MINUTE = 10;
const BATCH_INTERVAL_MS = 5_000;

interface ClientError {
  message: string;
  stack?: string;
  url: string;
  timestamp: string;
  userAgent: string;
  userId?: string;
  componentStack?: string;
  sessionId?: string;
}

const seen = new Set<string>();
const pending: ClientError[] = [];
let sentThisMinute = 0;
let minuteResetTimer: ReturnType<typeof setTimeout> | null = null;

function errorHash(message: string, stack?: string): string {
  const firstFrame = stack?.split('\n')[1]?.trim() ?? '';
  return `${message}::${firstFrame}`;
}

function getUserId(): string | undefined {
  try {
    const raw = localStorage.getItem('gratonite:userId');
    return raw ?? undefined;
  } catch {
    return undefined;
  }
}

function getSessionId(): string | undefined {
  try {
    return sessionStorage.getItem('gratonite:sessionId') ?? undefined;
  } catch {
    return undefined;
  }
}

function enqueue(err: ClientError) {
  const hash = errorHash(err.message, err.stack);
  if (seen.has(hash)) return;
  seen.add(hash);
  pending.push(err);
}

function flush() {
  if (pending.length === 0) return;
  if (sentThisMinute >= MAX_PER_MINUTE) return;

  const batch = pending.splice(0, MAX_PER_MINUTE - sentThisMinute);
  sentThisMinute += batch.length;

  if (!minuteResetTimer) {
    minuteResetTimer = setTimeout(() => {
      sentThisMinute = 0;
      minuteResetTimer = null;
    }, 60_000);
  }

  for (const err of batch) {
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(err),
      }).catch(() => {
        // Silently drop — avoid cascading errors
      });
    } catch {
      // noop
    }
  }
}

/** Report an error manually (e.g. from ErrorBoundary) */
export function reportError(
  error: Error,
  extra?: { componentStack?: string },
) {
  enqueue({
    message: error.message,
    stack: error.stack,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    userId: getUserId(),
    sessionId: getSessionId(),
    componentStack: extra?.componentStack,
  });
}

/** Initialize global error handlers and batch flush timer. Call once in main.tsx. */
export function init() {
  window.addEventListener('error', (event) => {
    enqueue({
      message: event.message ?? String(event.error),
      stack: event.error?.stack,
      url: event.filename ?? window.location.href,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      userId: getUserId(),
      sessionId: getSessionId(),
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const err = event.reason;
    enqueue({
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      userId: getUserId(),
      sessionId: getSessionId(),
    });
  });

  setInterval(flush, BATCH_INTERVAL_MS);
}
