/**
 * relay/connections.ts — Connection map for tracking connected instances.
 *
 * Uses Redis hash for persistence across relay restarts and for
 * multi-process relay deployments.
 */

import type { WebSocket } from 'ws';
import type Redis from 'ioredis';

export interface ConnectedInstance {
  domain: string;
  publicKeyPem: string;
  socketId: string;
  connectedAt: string;
}

export class ConnectionManager {
  private localSockets = new Map<string, WebSocket>(); // socketId → ws
  private domainToSocket = new Map<string, string>();   // domain → socketId
  private socketToDomain = new Map<string, string>();   // socketId → domain

  constructor(private redis: Redis) {}

  /** Register a newly authenticated instance connection. */
  async addConnection(domain: string, socketId: string, ws: WebSocket, publicKeyPem: string): Promise<void> {
    // Remove any existing connection for this domain
    const existing = this.domainToSocket.get(domain);
    if (existing) {
      this.localSockets.delete(existing);
      this.socketToDomain.delete(existing);
    }

    this.localSockets.set(socketId, ws);
    this.domainToSocket.set(domain, socketId);
    this.socketToDomain.set(socketId, domain);

    // Store in Redis for cross-process visibility
    await this.redis.hset('relay:connections', domain, JSON.stringify({
      domain,
      publicKeyPem,
      socketId,
      connectedAt: new Date().toISOString(),
    }));
  }

  /** Remove a disconnected instance. */
  async removeConnection(socketId: string): Promise<string | null> {
    const domain = this.socketToDomain.get(socketId);
    if (!domain) return null;

    this.localSockets.delete(socketId);
    this.domainToSocket.delete(domain);
    this.socketToDomain.delete(socketId);
    await this.redis.hdel('relay:connections', domain);
    return domain;
  }

  /** Get the WebSocket for a domain (local connections only). */
  getSocket(domain: string): WebSocket | null {
    const socketId = this.domainToSocket.get(domain);
    if (!socketId) return null;
    return this.localSockets.get(socketId) ?? null;
  }

  /** Check if a domain is connected (locally or via Redis). */
  async isConnected(domain: string): Promise<boolean> {
    if (this.domainToSocket.has(domain)) return true;
    const exists = await this.redis.hexists('relay:connections', domain);
    return exists === 1;
  }

  /** Get all locally connected domains. */
  getLocalDomains(): string[] {
    return Array.from(this.domainToSocket.keys());
  }

  /** Get all connected domains (local + Redis). */
  async getAllDomains(): Promise<string[]> {
    const all = await this.redis.hkeys('relay:connections');
    return all;
  }

  /** Get connection count. */
  getLocalCount(): number {
    return this.localSockets.size;
  }

  /** Send data to a specific domain's socket. */
  sendTo(domain: string, data: string | Buffer): boolean {
    const ws = this.getSocket(domain);
    if (!ws || ws.readyState !== 1) return false; // 1 = OPEN
    ws.send(data);
    return true;
  }

  /** Broadcast to all connected instances. */
  broadcast(data: string | Buffer, exclude?: string): void {
    for (const [domain, socketId] of this.domainToSocket) {
      if (domain === exclude) continue;
      const ws = this.localSockets.get(socketId);
      if (ws && ws.readyState === 1) {
        ws.send(data);
      }
    }
  }
}
