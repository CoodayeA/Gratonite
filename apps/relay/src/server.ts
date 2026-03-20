/**
 * relay/server.ts — Gratonite federation relay server.
 *
 * A lightweight WebSocket server that routes encrypted envelopes between
 * Gratonite instances. The relay never reads message content — it only
 * sees {from, to, bucket_size, ciphertext} and forwards blindly.
 *
 * Features:
 *   - RELAY_HELLO handshake with Ed25519 verification
 *   - Connection tracking via Redis
 *   - Rate limiting per instance
 *   - Keepalive ping/pong (30s interval, 3 missed = disconnect)
 *   - Mesh relay-to-relay connections
 *   - TURN credential proxy for voice federation
 */

import 'dotenv/config';
import { WebSocketServer, WebSocket } from 'ws';
import Redis from 'ioredis';
import crypto from 'node:crypto';

import { verifyRelayHello } from './auth';
import { ConnectionManager } from './connections';
import { ReputationEngine } from './reputation';
import { MeshManager } from './mesh';
import { startHealthServer, incrementForwarded, incrementDropped } from './health';
import { generateTurnCredentials } from './turn-proxy';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.RELAY_PORT || '4100', 10);
const HEALTH_PORT = parseInt(process.env.RELAY_HEALTH_PORT || '4101', 10);
const RELAY_DOMAIN = process.env.RELAY_DOMAIN || 'localhost';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const RATE_LIMIT = parseInt(process.env.RELAY_RATE_LIMIT || '100', 10); // envelopes/sec/instance
const KEEPALIVE_INTERVAL = 30_000; // 30s
const MAX_MISSED_PONGS = 3;
const TURN_SERVER = process.env.TURN_SERVER || '';
const TURN_SECRET = process.env.TURN_SECRET || '';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: true });
const connections = new ConnectionManager(redis);
const reputation = new ReputationEngine(redis);

// Rate limit tracking: domain → { count, resetAt }
const rateLimits = new Map<string, { count: number; resetAt: number }>();

// Pending pong tracking: socketId → missedPongs
const pendingPongs = new Map<string, number>();

// Seen envelope IDs for deduplication (1 hour window)
const seenEnvelopes = new Map<string, number>();

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  await redis.connect();
  console.log(`[relay] Connected to Redis at ${REDIS_URL}`);

  const wss = new WebSocketServer({ port: PORT });
  console.log(`[relay] WebSocket server listening on port ${PORT}`);
  console.log(`[relay] Domain: ${RELAY_DOMAIN}`);

  // Start health/metrics HTTP server
  startHealthServer(HEALTH_PORT, RELAY_DOMAIN, connections, redis);

  // Start mesh manager
  const mesh = new MeshManager(redis, connections, RELAY_DOMAIN);

  // Keepalive interval
  setInterval(() => {
    for (const domain of connections.getLocalDomains()) {
      const ws = connections.getSocket(domain);
      if (!ws || ws.readyState !== WebSocket.OPEN) continue;

      const socketId = `${domain}`;
      const missed = pendingPongs.get(socketId) ?? 0;

      if (missed >= MAX_MISSED_PONGS) {
        console.log(`[relay] Disconnecting ${domain} — ${missed} missed pongs`);
        ws.terminate();
        pendingPongs.delete(socketId);
        continue;
      }

      pendingPongs.set(socketId, missed + 1);
      ws.ping();
    }
  }, KEEPALIVE_INTERVAL);

  // Clean up seen envelopes every 10 minutes
  setInterval(() => {
    const cutoff = Date.now() - 3600_000;
    for (const [id, ts] of seenEnvelopes) {
      if (ts < cutoff) seenEnvelopes.delete(id);
    }
  }, 600_000);

  // ---------------------------------------------------------------------------
  // WebSocket connection handler
  // ---------------------------------------------------------------------------

  wss.on('connection', (ws: WebSocket) => {
    const socketId = crypto.randomUUID();
    let authenticated = false;
    let instanceDomain = '';

    // Authentication timeout — must send RELAY_HELLO within 10s
    const authTimeout = setTimeout(() => {
      if (!authenticated) {
        ws.close(4001, 'Authentication timeout');
      }
    }, 10_000);

    ws.on('pong', () => {
      if (instanceDomain) {
        pendingPongs.set(instanceDomain, 0);
      }
    });

    ws.on('message', async (rawData: Buffer | string) => {
      let msg: any;
      try {
        msg = JSON.parse(typeof rawData === 'string' ? rawData : rawData.toString('utf-8'));
      } catch {
        ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid JSON' }));
        return;
      }

      // -----------------------------------------------------------------------
      // RELAY_HELLO — Authentication handshake
      // -----------------------------------------------------------------------
      if (msg.type === 'RELAY_HELLO' && !authenticated) {
        const valid = verifyRelayHello({
          domain: msg.domain,
          publicKeyPem: msg.publicKeyPem,
          signature: msg.signature,
          timestamp: msg.timestamp,
        });

        if (!valid) {
          ws.send(JSON.stringify({ type: 'RELAY_HELLO_REJECT', reason: 'Invalid signature' }));
          ws.close(4002, 'Authentication failed');
          return;
        }

        authenticated = true;
        instanceDomain = msg.domain;
        clearTimeout(authTimeout);

        await connections.addConnection(instanceDomain, socketId, ws, msg.publicKeyPem);
        pendingPongs.set(instanceDomain, 0);

        console.log(`[relay] Instance connected: ${instanceDomain}`);

        ws.send(JSON.stringify({
          type: 'RELAY_HELLO_ACK',
          relay: RELAY_DOMAIN,
          connectedInstances: connections.getLocalCount(),
        }));
        return;
      }

      if (!authenticated) {
        ws.send(JSON.stringify({ type: 'ERROR', message: 'Not authenticated' }));
        return;
      }

      // -----------------------------------------------------------------------
      // RELAY_SEND — Forward an encrypted envelope
      // -----------------------------------------------------------------------
      if (msg.type === 'RELAY_SEND') {
        const envelope = msg.envelope;
        if (!envelope || !envelope.to || !envelope.from || !envelope.payload) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid envelope' }));
          return;
        }

        // Rate limiting
        if (!checkRateLimit(instanceDomain)) {
          ws.send(JSON.stringify({ type: 'RELAY_RATE_LIMITED', retryAfterMs: 1000 }));
          incrementDropped();
          return;
        }

        // Deduplication
        if (envelope.id && seenEnvelopes.has(envelope.id)) {
          ws.send(JSON.stringify({ type: 'RELAY_DUPLICATE', envelopeId: envelope.id }));
          return;
        }
        if (envelope.id) seenEnvelopes.set(envelope.id, Date.now());

        // Verify sender matches authenticated domain
        if (envelope.from !== instanceDomain) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Sender domain mismatch' }));
          incrementDropped();
          return;
        }

        // Check hop count
        if (envelope.hops > 2) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Max hop count exceeded' }));
          incrementDropped();
          return;
        }

        // Try local delivery
        const delivered = connections.sendTo(
          envelope.to,
          JSON.stringify({ type: 'RELAY_DELIVER', envelope }),
        );

        if (delivered) {
          incrementForwarded();
          ws.send(JSON.stringify({ type: 'RELAY_DELIVERED', envelopeId: envelope.id }));
          reputation.recordDelivery(RELAY_DOMAIN, true).catch(() => {});
        } else {
          // Try mesh delivery
          envelope.hops = (envelope.hops || 0) + 1;
          const meshDelivered = await mesh.forwardToMesh(envelope);

          if (meshDelivered) {
            incrementForwarded();
            ws.send(JSON.stringify({ type: 'RELAY_DELIVERED', envelopeId: envelope.id, via: 'mesh' }));
          } else {
            incrementDropped();
            ws.send(JSON.stringify({ type: 'RELAY_UNDELIVERABLE', envelopeId: envelope.id, to: envelope.to }));
            reputation.recordDelivery(RELAY_DOMAIN, false).catch(() => {});
          }
        }
        return;
      }

      // -----------------------------------------------------------------------
      // RELAY_TURN_REQUEST — Request TURN credentials for voice federation
      // -----------------------------------------------------------------------
      if (msg.type === 'RELAY_TURN_REQUEST') {
        if (!TURN_SERVER || !TURN_SECRET) {
          ws.send(JSON.stringify({ type: 'RELAY_TURN_UNAVAILABLE' }));
          return;
        }

        const credentials = generateTurnCredentials(
          TURN_SERVER,
          TURN_SECRET,
          msg.userId || instanceDomain,
        );

        ws.send(JSON.stringify({ type: 'RELAY_TURN_CREDENTIALS', credentials }));
        return;
      }

      // Unknown message type
      ws.send(JSON.stringify({ type: 'ERROR', message: `Unknown type: ${msg.type}` }));
    });

    ws.on('close', async () => {
      clearTimeout(authTimeout);
      if (instanceDomain) {
        await connections.removeConnection(socketId);
        pendingPongs.delete(instanceDomain);
        console.log(`[relay] Instance disconnected: ${instanceDomain}`);
      }
    });

    ws.on('error', (err) => {
      console.error(`[relay] WebSocket error for ${instanceDomain || 'unknown'}:`, err.message);
    });
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[relay] Received ${signal}, shutting down...`);
    wss.close();
    await redis.quit();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

function checkRateLimit(domain: string): boolean {
  const now = Date.now();
  let entry = rateLimits.get(domain);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + 1000 };
    rateLimits.set(domain, entry);
  }

  entry.count++;
  return entry.count <= RATE_LIMIT;
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

main().catch((err) => {
  console.error('[relay] Fatal error:', err);
  process.exit(1);
});
