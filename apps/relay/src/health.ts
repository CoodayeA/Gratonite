/**
 * relay/health.ts — Health endpoint + Prometheus metrics for relay monitoring.
 */

import http from 'node:http';
import type Redis from 'ioredis';
import type { ConnectionManager } from './connections';

export interface RelayMetrics {
  connectionsTotal: number;
  envelopesForwarded: number;
  envelopesDropped: number;
  meshPeers: number;
  uptimeSeconds: number;
  memoryMb: number;
}

const startTime = Date.now();
let envelopesForwarded = 0;
let envelopesDropped = 0;
let meshPeerCount = 0;

export function incrementForwarded(): void { envelopesForwarded++; }
export function incrementDropped(): void { envelopesDropped++; }
export function setMeshPeers(n: number): void { meshPeerCount = n; }

export function getMetrics(connections: ConnectionManager): RelayMetrics {
  const mem = process.memoryUsage();
  return {
    connectionsTotal: connections.getLocalCount(),
    envelopesForwarded,
    envelopesDropped,
    meshPeers: meshPeerCount,
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    memoryMb: Math.round(mem.rss / 1024 / 1024),
  };
}

/**
 * Start an HTTP health/metrics server on the given port.
 */
export function startHealthServer(
  port: number,
  relayDomain: string,
  connections: ConnectionManager,
  redis?: Redis,
): http.Server {
  const server = http.createServer(async (req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      const metrics = getMetrics(connections);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        relay: relayDomain,
        ...metrics,
      }));
      return;
    }

    if (req.url === '/.well-known/gratonite-relay' && req.method === 'GET') {
      const metrics = getMetrics(connections);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        type: 'gratonite-relay',
        version: '1.0.0',
        domain: relayDomain,
        protocol: 'gratonite-relay/v1',
        connections: metrics.connectionsTotal,
        uptime: metrics.uptimeSeconds,
        meshPeers: metrics.meshPeers,
      }));
      return;
    }

    if (req.url === '/metrics' && req.method === 'GET') {
      const m = getMetrics(connections);
      const lines = [
        '# HELP relay_connections_total Current number of connected instances',
        '# TYPE relay_connections_total gauge',
        `relay_connections_total ${m.connectionsTotal}`,
        '# HELP relay_envelopes_forwarded_total Total envelopes forwarded',
        '# TYPE relay_envelopes_forwarded_total counter',
        `relay_envelopes_forwarded_total ${m.envelopesForwarded}`,
        '# HELP relay_envelopes_dropped_total Total envelopes dropped',
        '# TYPE relay_envelopes_dropped_total counter',
        `relay_envelopes_dropped_total ${m.envelopesDropped}`,
        '# HELP relay_mesh_peers Connected mesh relay peers',
        '# TYPE relay_mesh_peers gauge',
        `relay_mesh_peers ${m.meshPeers}`,
        '# HELP relay_uptime_seconds Relay uptime in seconds',
        '# TYPE relay_uptime_seconds gauge',
        `relay_uptime_seconds ${m.uptimeSeconds}`,
        '# HELP relay_memory_mb RSS memory usage in MB',
        '# TYPE relay_memory_mb gauge',
        `relay_memory_mb ${m.memoryMb}`,
      ];
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(lines.join('\n') + '\n');
      return;
    }

    // Discovery eligibility — hub polls this to find trustworthy instances
    if (req.url === '/instances' && req.method === 'GET' && redis) {
      const hubSecret = process.env.RELAY_HUB_SECRET;
      if (hubSecret && req.headers['x-hub-secret'] !== hubSecret) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return;
      }

      const domains = connections.getLocalDomains();
      const instances = [];

      for (const domain of domains) {
        const meta = await redis.hgetall(`instance:${domain}:meta`);
        const firstSeen = parseInt(meta.firstSeen || '0', 10);
        const connectedHours = (Date.now() - firstSeen) / 3600000;
        const reports = parseInt(meta.reports || '0', 10);

        instances.push({
          domain,
          connectedSince: meta.firstSeen,
          connectedHours: Math.floor(connectedHours),
          reports,
          discoveryEligible: connectedHours >= 48 && reports === 0,
          publicKeyPem: meta.publicKeyPem || null,
        });
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ instances, relayDomain }));
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  server.listen(port, () => {
    console.log(`[relay:health] Health/metrics server on port ${port}`);
  });

  return server;
}
