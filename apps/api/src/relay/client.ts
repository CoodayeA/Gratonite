/**
 * relay/client.ts — WebSocket client for connecting to a relay server.
 *
 * Connects outbound to the relay, performs RELAY_HELLO handshake,
 * handles auto-reconnect with jittered exponential backoff,
 * and supports dual-relay (primary + fallback).
 */

import WebSocket from 'ws';
import crypto from 'node:crypto';
import { getActiveKeyPair, signData } from '../federation/crypto';
import { logger } from '../lib/logger';
import type { RelayEnvelope } from './envelope';

export interface RelayClientOptions {
  instanceDomain: string;
  primaryRelayUrl: string;
  fallbackRelayUrl?: string;
}

type RelayEventHandler = (envelope: RelayEnvelope) => void;

export class RelayClient {
  private ws: WebSocket | null = null;
  private fallbackWs: WebSocket | null = null;
  private connected = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private handlers: RelayEventHandler[] = [];
  private instanceDomain: string;
  private primaryUrl: string;
  private fallbackUrl?: string;
  private relayDomain: string | null = null;

  constructor(options: RelayClientOptions) {
    this.instanceDomain = options.instanceDomain;
    this.primaryUrl = options.primaryRelayUrl;
    this.fallbackUrl = options.fallbackRelayUrl;
  }

  /** Register a handler for received envelopes. */
  onEnvelope(handler: RelayEventHandler): void {
    this.handlers.push(handler);
  }

  /** Connect to the primary relay (and fallback if configured). */
  async connect(): Promise<void> {
    this.connectToRelay(this.primaryUrl, 'primary');
    if (this.fallbackUrl) {
      this.connectToRelay(this.fallbackUrl, 'fallback');
    }
  }

  /** Disconnect from all relays. */
  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) { this.ws.close(); this.ws = null; }
    if (this.fallbackWs) { this.fallbackWs.close(); this.fallbackWs = null; }
    this.connected = false;
  }

  /** Send an envelope via the relay. */
  send(envelope: RelayEnvelope): boolean {
    const msg = JSON.stringify({ type: 'RELAY_SEND', envelope });

    // Try primary first
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(msg);
      return true;
    }

    // Fall back to secondary
    if (this.fallbackWs && this.fallbackWs.readyState === WebSocket.OPEN) {
      this.fallbackWs.send(msg);
      return true;
    }

    return false;
  }

  /** Whether connected to any relay. */
  isConnected(): boolean {
    return this.connected;
  }

  /** Get the connected relay domain. */
  getRelayDomain(): string | null {
    return this.relayDomain;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private connectToRelay(url: string, label: 'primary' | 'fallback'): void {
    try {
      const ws = new WebSocket(url);

      ws.on('open', () => {
        logger.info(`[relay:client] Connected to ${label} relay: ${url}`);
        this.performHandshake(ws);
      });

      ws.on('message', (data) => {
        this.handleMessage(data.toString(), label);
      });

      ws.on('close', (code, reason) => {
        logger.info(`[relay:client] ${label} relay disconnected: ${code} ${reason.toString()}`);
        if (label === 'primary') {
          this.connected = false;
          this.ws = null;
          this.scheduleReconnect(url, label);
        } else {
          this.fallbackWs = null;
        }
      });

      ws.on('error', (err) => {
        logger.error(`[relay:client] ${label} relay error: ${err.message}`);
      });

      ws.on('ping', () => {
        ws.pong();
      });

      if (label === 'primary') {
        this.ws = ws;
      } else {
        this.fallbackWs = ws;
      }
    } catch (err) {
      logger.error(`[relay:client] Failed to connect to ${label}:`, err);
      if (label === 'primary') {
        this.scheduleReconnect(url, label);
      }
    }
  }

  private performHandshake(ws: WebSocket): void {
    try {
      const kp = getActiveKeyPair();
      const timestamp = new Date().toISOString();
      const signature = signData(`${this.instanceDomain}:${timestamp}`);

      ws.send(JSON.stringify({
        type: 'RELAY_HELLO',
        domain: this.instanceDomain,
        publicKeyPem: kp.publicKeyPem,
        signature,
        timestamp,
      }));
    } catch (err) {
      logger.error('[relay:client] Handshake failed:', err);
    }
  }

  private handleMessage(raw: string, label: string): void {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    switch (msg.type) {
      case 'RELAY_HELLO_ACK':
        logger.info(`[relay:client] Authenticated with ${label} relay (${msg.relay}, ${msg.connectedInstances} instances)`);
        this.connected = true;
        this.reconnectAttempt = 0;
        this.relayDomain = msg.relay;
        break;

      case 'RELAY_HELLO_REJECT':
        logger.error(`[relay:client] ${label} relay rejected handshake: ${msg.reason}`);
        break;

      case 'RELAY_DELIVER':
        // Received an envelope from a remote instance via relay
        if (msg.envelope) {
          for (const handler of this.handlers) {
            try {
              handler(msg.envelope);
            } catch (err) {
              logger.error('[relay:client] Envelope handler error:', err);
            }
          }
        }
        break;

      case 'RELAY_DELIVERED':
        logger.debug(`[relay:client] Envelope ${msg.envelopeId} delivered${msg.via ? ` via ${msg.via}` : ''}`);
        break;

      case 'RELAY_UNDELIVERABLE':
        logger.warn(`[relay:client] Envelope ${msg.envelopeId} undeliverable to ${msg.to}`);
        break;

      case 'RELAY_RATE_LIMITED':
        logger.warn(`[relay:client] Rate limited, retry after ${msg.retryAfterMs}ms`);
        break;

      case 'RELAY_TURN_CREDENTIALS':
        // TURN credentials for voice federation — emit event
        logger.debug('[relay:client] Received TURN credentials');
        break;

      case 'ERROR':
        logger.error(`[relay:client] Relay error: ${msg.message}`);
        break;
    }
  }

  /** Jittered exponential backoff reconnection. */
  private scheduleReconnect(url: string, label: 'primary' | 'fallback'): void {
    this.reconnectAttempt++;
    // Backoff: 1s, 2s, 4s, 8s, 16s, 32s, 60s max
    const baseDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempt - 1), 60_000);
    // Add jitter: ±25%
    const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
    const delay = Math.max(1000, baseDelay + jitter);

    logger.info(`[relay:client] Reconnecting to ${label} in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempt})`);

    this.reconnectTimer = setTimeout(() => {
      this.connectToRelay(url, label);
    }, delay);
  }

  /** Request TURN credentials from the relay for voice federation. */
  requestTurnCredentials(userId: string): void {
    const ws = this.ws || this.fallbackWs;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'RELAY_TURN_REQUEST', userId }));
    }
  }
}
