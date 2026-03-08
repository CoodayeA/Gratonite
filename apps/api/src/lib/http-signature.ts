/** http-signature.ts — HTTP Signature helpers for federation request signing/verification. */

import crypto from 'node:crypto';
import { Request } from 'express';

/**
 * Sign an outbound HTTP request using Ed25519.
 * Returns headers that should be merged into the fetch call.
 */
export function signRequest(
  method: string,
  url: string,
  body: string,
  keyId: string,
  privateKeyPem: string,
): Record<string, string> {
  const parsedUrl = new URL(url);
  const date = new Date().toUTCString();
  const digest = body
    ? `SHA-256=${crypto.createHash('sha256').update(body).digest('base64')}`
    : '';

  const signingString = [
    `(request-target): ${method.toLowerCase()} ${parsedUrl.pathname}${parsedUrl.search}`,
    `host: ${parsedUrl.host}`,
    `date: ${date}`,
    ...(digest ? [`digest: ${digest}`] : []),
  ].join('\n');

  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const signature = crypto.sign(null, Buffer.from(signingString), privateKey).toString('base64');

  const headers: Record<string, string> = {
    Host: parsedUrl.host,
    Date: date,
    Signature: `keyId="${keyId}",algorithm="ed25519",headers="(request-target) host date${digest ? ' digest' : ''}",signature="${signature}"`,
  };

  if (digest) {
    headers['Digest'] = digest;
  }

  return headers;
}

/**
 * Verify an inbound HTTP request's Signature header against a known public key.
 * Reconstructs the signing string from the request, checks the Ed25519 signature,
 * and validates the Digest header against the actual request body.
 */
export function verifyRequest(req: Request, publicKeyPem: string): boolean {
  try {
    const signatureHeader = req.headers['signature'] as string | undefined;
    if (!signatureHeader) return false;

    // Parse Signature header fields
    const paramsMap = new Map<string, string>();
    const paramRegex = /(\w+)="([^"]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = paramRegex.exec(signatureHeader)) !== null) {
      paramsMap.set(match[1], match[2]);
    }

    const headersField = paramsMap.get('headers');
    const signatureB64 = paramsMap.get('signature');

    if (!headersField || !signatureB64) return false;

    const headerNames = headersField.split(' ');

    // Reconstruct the signing string using the same order specified in headers=""
    const signingParts: string[] = [];
    for (const name of headerNames) {
      if (name === '(request-target)') {
        const method = req.method.toLowerCase();
        const target = req.originalUrl || req.url;
        signingParts.push(`(request-target): ${method} ${target}`);
      } else {
        const value = req.headers[name.toLowerCase()];
        if (!value) return false;
        signingParts.push(`${name}: ${Array.isArray(value) ? value[0] : value}`);
      }
    }

    const signingString = signingParts.join('\n');

    const publicKey = crypto.createPublicKey(publicKeyPem);
    const signatureValid = crypto.verify(null, Buffer.from(signingString), publicKey, Buffer.from(signatureB64, 'base64'));
    if (!signatureValid) return false;

    // Verify Digest header matches actual request body (prevents body tampering)
    const digestHeader = req.headers['digest'] as string | undefined;
    if (digestHeader && req.body) {
      const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const expectedDigest = `SHA-256=${crypto.createHash('sha256').update(bodyStr).digest('base64')}`;
      if (digestHeader !== expectedDigest) return false;
    }

    return true;
  } catch {
    return false;
  }
}
