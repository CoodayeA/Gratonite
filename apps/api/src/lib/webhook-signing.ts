/**
 * lib/webhook-signing.ts — Shared HMAC-SHA256 signing for bot webhook events.
 *
 * Extracted from webhook-dispatch.ts so both outbound event dispatch and
 * interaction responses can use the same signing logic.
 */

import crypto from 'node:crypto';

/**
 * Produces an HMAC-SHA256 hex digest of `payload` using `secret`.
 * The digest is sent as the `X-Gratonite-Signature` header so the bot can
 * verify the event originated from Gratonite.
 */
export function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Delivers a signed webhook POST with retry on 5xx errors.
 * Exponential backoff: 1s, 5s, 30s.
 */
export async function deliverWebhookWithRetry(
  url: string,
  payload: string,
  headers: Record<string, string>,
  maxRetries = 3,
): Promise<{ ok: boolean; status: number; body: string }> {
  const delays = [1000, 5000, 30000];
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: payload,
        signal: controller.signal,
      });
      clearTimeout(timer);
      const body = await res.text();
      if (res.ok) return { ok: true, status: res.status, body };
      if (res.status >= 500 && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, delays[attempt]));
        continue;
      }
      return { ok: false, status: res.status, body };
    } catch {
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, delays[attempt]));
        continue;
      }
    }
  }
  return { ok: false, status: 0, body: '' };
}
