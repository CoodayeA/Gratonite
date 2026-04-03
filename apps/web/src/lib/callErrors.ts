/**
 * User-facing call / LiveKit error mapping and optional Sentry reporting.
 * Keep messages short and actionable; never log raw tokens or PII in tags.
 */
import * as Sentry from '@sentry/react';
import { ApiRequestError } from './api';

/** Map connection failures to a single line suitable for toasts. */
export function mapLiveKitConnectionError(err: unknown): string {
  let message = err instanceof Error ? err.message : String(err || 'Failed to connect to voice');

  if (message.includes('signal connection') || message.includes('WebSocket')) {
    return 'Could not connect to voice server. Check your connection and try again.';
  }
  const lower = message.toLowerCase();
  if (lower.includes('permission') || lower.includes('denied') || lower.includes('notallowed')) {
    return 'Microphone or camera permission was denied. Allow access in your browser settings and retry.';
  }
  if (lower.includes('token') && (lower.includes('expired') || lower.includes('invalid'))) {
    return 'Voice session expired. Leave voice and join again.';
  }
  if (lower.includes('timed out') || lower.includes('timeout')) {
    return 'Voice connection timed out. The voice server may be unavailable.';
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Network error while connecting to voice. Check your connection.';
  }

  if (message.length > 180) {
    message = `${message.slice(0, 177)}…`;
  }
  return message;
}

export type CallErrorToast = { title: string; description: string };

/** DM / API-aware call errors (join token, permissions). */
export function classifyCallErrorToast(error: unknown): CallErrorToast {
  if (error instanceof ApiRequestError) {
    if (error.status === 403) {
      return {
        title: 'Call permission denied',
        description: 'You cannot join this call from your current account. Check channel permissions and try again.',
      };
    }
    if (error.status === 404) {
      return {
        title: 'Call target unavailable',
        description: 'The call channel could not be found. Re-open the DM and retry.',
      };
    }
    if (error.status === 400) {
      return {
        title: 'Invalid call target',
        description: 'This target is not a voice-capable channel. Re-open the DM and try again.',
      };
    }
    if (error.status === 503) {
      return {
        title: 'Voice service unavailable',
        description: 'The voice service is currently unavailable. Retry in a few moments.',
      };
    }
  }

  const raw = (error instanceof Error ? error.message : String(error || '')).toLowerCase();
  if (raw.includes('timed out') || raw.includes('timeout')) {
    return {
      title: 'Call timed out',
      description: 'Could not connect before timeout. Check network connectivity and retry.',
    };
  }
  if (raw.includes('permission') || raw.includes('forbidden')) {
    return {
      title: 'Call permission denied',
      description: 'You do not have permission for this call. Verify access and retry.',
    };
  }
  if (raw.includes('not found')) {
    return {
      title: 'Call target unavailable',
      description: 'This call target was not found. Re-open the DM and retry.',
    };
  }
  if (raw.includes('unavailable') || raw.includes('not configured')) {
    return {
      title: 'Voice service unavailable',
      description: 'Voice service is unavailable right now. Retry in a few moments.',
    };
  }

  return {
    title: 'Call failed',
    description: 'Could not connect to the call. Please retry.',
  };
}

/**
 * Return a secondary troubleshooting hint for a connection error message,
 * or null when no specific guidance is available.
 */
export function getConnectionErrorHint(errorMsg: string): string | null {
  const lower = errorMsg.toLowerCase();

  if (lower.includes('permission') || lower.includes('denied') || lower.includes('notallowed') || lower.includes('microphone') || lower.includes('camera')) {
    const isElectron = typeof window !== 'undefined' && 'electron' in window;
    const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);
    const isWindows = typeof navigator !== 'undefined' && /win/i.test(navigator.platform);
    if (isElectron && isMac) {
      return 'Open System Settings → Privacy & Security → Microphone and enable Gratonite.';
    }
    if (isElectron && isWindows) {
      return 'Open Windows Settings → Privacy → Microphone and allow Gratonite.';
    }
    return 'Click the camera/lock icon in your browser address bar and allow microphone access, then retry.';
  }

  if (lower.includes('signal connection') || lower.includes('websocket')) {
    return 'A firewall or proxy may be blocking WebSocket traffic on port 443. Try on a different network.';
  }

  if (lower.includes('timed out') || lower.includes('timeout')) {
    return 'The voice server did not respond in time. Check your connection or try again shortly.';
  }

  if (lower.includes('token') && (lower.includes('expired') || lower.includes('invalid'))) {
    return 'Leave the channel, wait a moment, then rejoin to get a fresh session token.';
  }

  if (lower.includes('network') || lower.includes('failed to fetch')) {
    return 'Verify your internet connection is stable and no VPN is blocking UDP/RTC traffic.';
  }

  return null;
}

export function captureCallErrorSentry(
  err: unknown,
  tags: Record<string, string>,
): void {
  if (!import.meta.env.PROD) return;
  const error = err instanceof Error ? err : new Error(String(err));
  Sentry.captureException(error, {
    tags: {
      ...tags,
    },
  });
}
