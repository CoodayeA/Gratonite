/**
 * relay/mesh.ts — Relay-to-relay mesh protocol.
 *
 * Enables cross-relay delivery when sender and recipient are connected
 * to different relays. Uses bloom filter routing tables exchanged every 60s.
 *
 * Protocol events:
 *   MESH_HELLO    — Authenticate relay-to-relay connection
 *   MESH_SYNC     — Exchange bloom filter of connected instances
 *   MESH_FORWARD  — Forward envelope to destination via peer relay
 *   MESH_PING     — Keepalive
 *
 * Max 2-hop chain: Instance → Relay A → Relay B → Instance
 */

import { WebSocket } from 'ws';
import crypto from 'node:crypto';
import type Redis from 'ioredis';
import type { ConnectionManager } from './connections';
import { verifyMeshHello } from './auth';
import { incrementForwarded, setMeshPeers } from './health';

// ---------------------------------------------------------------------------
// Simple Bloom Filter (compact routing table)
// ---------------------------------------------------------------------------

class BloomFilter {
  private bits: Uint8Array;
  private hashCount: number;

  constructor(private size: number = 1024, hashCount: number = 7) {
    this.bits = new Uint8Array(size);
    this.hashCount = hashCount;
  }

  add(item: string): void {
    for (let i = 0; i < this.hashCount; i++) {
      const idx = this.hash(item, i) % (this.size * 8);
      this.bits[Math.floor(idx / 8)] |= 1 << (idx % 8);
    }
  }

  mightContain(item: string): boolean {
    for (let i = 0; i < this.hashCount; i++) {
      const idx = this.hash(item, i) % (this.size * 8);
      if (!(this.bits[Math.floor(idx / 8)] & (1 << (idx % 8)))) {
        return false;
      }
    }
    return true;
  }

  serialize(): string {
    return Buffer.from(this.bits).toString('base64');
  }

  static deserialize(data: string, size: number = 1024, hashCount: number = 7): BloomFilter {
    const bf = new BloomFilter(size, hashCount);
    bf.bits = new Uint8Array(Buffer.from(data, 'base64'));
    return bf;
  }

  private hash(item: string, seed: number): number {
    const data = `${seed}:${item}`;
    const hash = crypto.createHash('md5').update(data).digest();
    return hash.readUInt32LE(0);
  }
}

// ---------------------------------------------------------------------------
// Mesh Manager
// ---------------------------------------------------------------------------

interface MeshPeer {
  domain: string;
  ws: WebSocket;
  bloom: BloomFilter | null;
  connectedAt: number;
  lastPing: number;
}

export class MeshManager {
  private peers = new Map<string, MeshPeer>();
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private redis: Redis,
    private connections: ConnectionManager,
    private relayDomain: string,
  ) {
    // Start periodic sync
    this.syncInterval = setInterval(() => this.broadcastBloom(), 60_000);
    // Start keepalive
    this.pingInterval = setInterval(() => this.pingPeers(), 30_000);
  }

  /**
   * Connect to a peer relay.
   */
  async connectToPeer(
    peerDomain: string,
    peerUrl: string,
    myPublicKeyPem: string,
    myPrivateKeyPem: string,
  ): Promise<boolean> {
    if (this.peers.has(peerDomain)) return true;

    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(peerUrl);
        const timeout = setTimeout(() => {
          ws.terminate();
          resolve(false);
        }, 10_000);

        ws.on('open', () => {
          clearTimeout(timeout);

          // Send MESH_HELLO
          const timestamp = new Date().toISOString();
          const signedData = `relay:${this.relayDomain}:${timestamp}`;
          const signature = crypto
            .sign(null, Buffer.from(signedData), crypto.createPrivateKey(myPrivateKeyPem))
            .toString('base64');

          ws.send(JSON.stringify({
            type: 'MESH_HELLO',
            relayDomain: this.relayDomain,
            publicKeyPem: myPublicKeyPem,
            signature,
            timestamp,
          }));
        });

        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString());
            this.handleMeshMessage(peerDomain, ws, msg);

            if (msg.type === 'MESH_HELLO_ACK') {
              this.peers.set(peerDomain, {
                domain: peerDomain,
                ws,
                bloom: null,
                connectedAt: Date.now(),
                lastPing: Date.now(),
              });
              setMeshPeers(this.peers.size);
              console.log(`[mesh] Connected to peer: ${peerDomain}`);
              resolve(true);
            }
          } catch { /* ignore parse errors */ }
        });

        ws.on('close', () => {
          clearTimeout(timeout);
          this.peers.delete(peerDomain);
          setMeshPeers(this.peers.size);
          console.log(`[mesh] Peer disconnected: ${peerDomain}`);
        });

        ws.on('error', (err) => {
          clearTimeout(timeout);
          console.error(`[mesh] Peer connection error (${peerDomain}):`, err.message);
          resolve(false);
        });
      } catch {
        resolve(false);
      }
    });
  }

  /**
   * Handle incoming mesh protocol messages.
   */
  handleMeshMessage(peerDomain: string, ws: WebSocket, msg: any): void {
    switch (msg.type) {
      case 'MESH_HELLO': {
        // Incoming peer connection — verify and accept
        const valid = verifyMeshHello({
          relayDomain: msg.relayDomain,
          publicKeyPem: msg.publicKeyPem,
          signature: msg.signature,
          timestamp: msg.timestamp,
        });

        if (!valid) {
          ws.send(JSON.stringify({ type: 'MESH_HELLO_REJECT', reason: 'Invalid signature' }));
          ws.close();
          return;
        }

        this.peers.set(msg.relayDomain, {
          domain: msg.relayDomain,
          ws,
          bloom: null,
          connectedAt: Date.now(),
          lastPing: Date.now(),
        });
        setMeshPeers(this.peers.size);

        ws.send(JSON.stringify({
          type: 'MESH_HELLO_ACK',
          relayDomain: this.relayDomain,
        }));

        // Send our bloom filter immediately
        this.sendBloom(ws);
        console.log(`[mesh] Accepted peer: ${msg.relayDomain}`);
        break;
      }

      case 'MESH_SYNC': {
        // Peer is sharing their bloom filter of connected instances
        const peer = this.peers.get(peerDomain);
        if (peer && msg.bloom) {
          peer.bloom = BloomFilter.deserialize(msg.bloom);
        }
        break;
      }

      case 'MESH_FORWARD': {
        // Peer is asking us to deliver an envelope to a locally connected instance
        const envelope = msg.envelope;
        if (!envelope || !envelope.to) return;

        // Check hop count
        if (envelope.hops > 2) return;

        // Try local delivery
        const delivered = this.connections.sendTo(
          envelope.to,
          JSON.stringify({ type: 'RELAY_DELIVER', envelope }),
        );

        if (delivered) {
          incrementForwarded();
          ws.send(JSON.stringify({
            type: 'MESH_FORWARD_ACK',
            envelopeId: envelope.id,
            status: 'delivered',
          }));
        } else {
          ws.send(JSON.stringify({
            type: 'MESH_FORWARD_ACK',
            envelopeId: envelope.id,
            status: 'not_found',
          }));
        }
        break;
      }

      case 'MESH_PING': {
        const peer = this.peers.get(peerDomain);
        if (peer) peer.lastPing = Date.now();
        ws.send(JSON.stringify({ type: 'MESH_PONG' }));
        break;
      }

      case 'MESH_PONG': {
        const peer = this.peers.get(peerDomain);
        if (peer) peer.lastPing = Date.now();
        break;
      }
    }
  }

  /**
   * Try to forward an envelope to the destination via mesh peers.
   */
  async forwardToMesh(envelope: any): Promise<boolean> {
    const targetDomain = envelope.to;

    // Check each peer's bloom filter
    for (const [, peer] of this.peers) {
      if (!peer.bloom || !peer.ws || peer.ws.readyState !== WebSocket.OPEN) continue;

      if (peer.bloom.mightContain(targetDomain)) {
        peer.ws.send(JSON.stringify({
          type: 'MESH_FORWARD',
          envelope,
        }));
        return true; // Optimistic — we trust the bloom filter
      }
    }

    return false;
  }

  /**
   * Broadcast our bloom filter to all mesh peers.
   */
  private broadcastBloom(): void {
    const domains = this.connections.getLocalDomains();
    if (domains.length === 0) return;

    const bf = new BloomFilter(1024, 7);
    for (const domain of domains) {
      bf.add(domain);
    }

    const msg = JSON.stringify({
      type: 'MESH_SYNC',
      bloom: bf.serialize(),
      count: domains.length,
    });

    for (const [, peer] of this.peers) {
      if (peer.ws.readyState === WebSocket.OPEN) {
        peer.ws.send(msg);
      }
    }
  }

  private sendBloom(ws: WebSocket): void {
    const domains = this.connections.getLocalDomains();
    const bf = new BloomFilter(1024, 7);
    for (const domain of domains) {
      bf.add(domain);
    }
    ws.send(JSON.stringify({
      type: 'MESH_SYNC',
      bloom: bf.serialize(),
      count: domains.length,
    }));
  }

  /**
   * Ping all peers and remove stale ones.
   */
  private pingPeers(): void {
    const now = Date.now();
    for (const [domain, peer] of this.peers) {
      if (now - peer.lastPing > 90_000) {
        // 3 missed pings (30s interval)
        console.log(`[mesh] Removing stale peer: ${domain}`);
        peer.ws.terminate();
        this.peers.delete(domain);
        setMeshPeers(this.peers.size);
        continue;
      }

      if (peer.ws.readyState === WebSocket.OPEN) {
        peer.ws.send(JSON.stringify({ type: 'MESH_PING' }));
      }
    }
  }

  /** Get list of connected mesh peers. */
  getPeers(): string[] {
    return Array.from(this.peers.keys());
  }

  /** Shutdown mesh connections. */
  shutdown(): void {
    if (this.syncInterval) clearInterval(this.syncInterval);
    if (this.pingInterval) clearInterval(this.pingInterval);
    for (const [, peer] of this.peers) {
      peer.ws.close();
    }
    this.peers.clear();
  }
}
