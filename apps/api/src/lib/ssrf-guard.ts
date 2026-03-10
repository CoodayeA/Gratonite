/**
 * lib/ssrf-guard.ts — SSRF protection for outbound HTTP requests.
 *
 * Resolves hostnames and blocks requests to private/reserved IP ranges.
 * Used by federation handshake, webhook creation, and any other endpoint
 * that fetches user-supplied URLs.
 */

import dns from 'node:dns/promises';
import net from 'node:net';

/**
 * Check whether an IP address belongs to a private or reserved range.
 *
 * Blocked ranges:
 *   IPv4: 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16,
 *          169.254.0.0/16, 0.0.0.0
 *   IPv6: ::1, fc00::/7 (unique local), fe80::/10 (link-local), ::
 */
export function isPrivateIP(ip: string): boolean {
  // Normalize IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 -> 127.0.0.1)
  const normalized = ip.replace(/^::ffff:/i, '');

  if (net.isIPv4(normalized)) {
    const parts = normalized.split('.').map(Number);
    const [a, b] = parts;

    if (a === 127) return true;                         // 127.0.0.0/8 (loopback)
    if (a === 10) return true;                          // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
    if (a === 192 && b === 168) return true;             // 192.168.0.0/16
    if (a === 169 && b === 254) return true;             // 169.254.0.0/16 (link-local)
    if (a === 0) return true;                            // 0.0.0.0/8

    return false;
  }

  if (net.isIPv6(normalized)) {
    const lower = normalized.toLowerCase();

    if (lower === '::1' || lower === '::') return true;  // loopback / unspecified

    // fc00::/7 — unique local addresses (fc00:: through fdff::)
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;

    // fe80::/10 — link-local
    if (lower.startsWith('fe80')) return true;

    return false;
  }

  // If we can't parse it, block it to be safe
  return true;
}

/**
 * Resolve a hostname and verify none of the resolved IPs are private.
 * Throws if the hostname resolves to a private IP or cannot be resolved.
 */
export async function assertNotPrivateHost(hostname: string): Promise<void> {
  // If the hostname is already an IP literal, check directly
  if (net.isIP(hostname)) {
    if (isPrivateIP(hostname)) {
      throw new Error(`Blocked request to private IP: ${hostname}`);
    }
    return;
  }

  let addresses: string[];
  try {
    // Resolve all A (IPv4) and AAAA (IPv6) records
    const results = await dns.resolve4(hostname);
    let v6results: string[] = [];
    try {
      v6results = await dns.resolve6(hostname);
    } catch {
      // No AAAA records is fine
    }
    addresses = [...results, ...v6results];
  } catch {
    throw new Error(`Could not resolve hostname: ${hostname}`);
  }

  if (addresses.length === 0) {
    throw new Error(`No addresses found for hostname: ${hostname}`);
  }

  for (const addr of addresses) {
    if (isPrivateIP(addr)) {
      throw new Error(`Blocked request to private IP: ${addr} (resolved from ${hostname})`);
    }
  }
}

/**
 * Validate a URL for outbound requests:
 *  1. Must be a valid URL
 *  2. Must use HTTPS (optionally allow HTTP via `allowHttp`)
 *  3. Hostname must not resolve to a private IP
 *
 * Returns the parsed URL on success.
 * Throws a descriptive Error on failure.
 */
export async function validateOutboundUrl(
  rawUrl: string,
  options?: { allowHttp?: boolean },
): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL format');
  }

  const allowHttp = options?.allowHttp ?? false;
  if (parsed.protocol !== 'https:' && !(allowHttp && parsed.protocol === 'http:')) {
    throw new Error('URL must use HTTPS');
  }

  await assertNotPrivateHost(parsed.hostname);

  return parsed;
}
