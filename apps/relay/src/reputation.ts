/**
 * relay/reputation.ts — Relay reputation scoring engine.
 *
 * Scoring factors:
 *   - Uptime (30%): percentage of successful health checks
 *   - Delivery success rate (30%): envelopes delivered / total
 *   - Latency p99 (20%): lower is better, capped at 1000ms
 *   - Age (10%): older relays get more trust, capped at 30 days
 *   - Community reports (10%): deducted for abuse reports
 *
 * Score range: 0-100. New relays start at 50.
 * Below 20: auto-delisted from directory.
 */

import type Redis from 'ioredis';

export interface ReputationData {
  score: number;
  uptime: number;
  deliveryRate: number;
  latencyP99: number;
  ageHours: number;
  reports: number;
  lastUpdated: string;
}

export class ReputationEngine {
  constructor(private redis: Redis) {}

  async calculateScore(relayDomain: string): Promise<ReputationData> {
    const statsKey = `relay:stats:${relayDomain}`;
    const stats = await this.redis.hgetall(statsKey);

    const totalChecks = parseInt(stats.totalChecks || '0', 10);
    const successChecks = parseInt(stats.successChecks || '0', 10);
    const totalEnvelopes = parseInt(stats.totalEnvelopes || '0', 10);
    const deliveredEnvelopes = parseInt(stats.deliveredEnvelopes || '0', 10);
    const latencyP99 = parseFloat(stats.latencyP99 || '500');
    const registeredAt = stats.registeredAt ? new Date(stats.registeredAt).getTime() : Date.now();
    const reports = parseInt(stats.reports || '0', 10);

    const uptime = totalChecks > 0 ? (successChecks / totalChecks) * 100 : 50;
    const deliveryRate = totalEnvelopes > 0 ? (deliveredEnvelopes / totalEnvelopes) * 100 : 50;
    const latencyScore = Math.max(0, 100 - (latencyP99 / 10));
    const ageHours = (Date.now() - registeredAt) / (1000 * 60 * 60);
    const ageScore = Math.min(100, (ageHours / (24 * 30)) * 100);
    const reportPenalty = Math.min(100, reports * 10);

    const score = Math.round(
      uptime * 0.3 +
      deliveryRate * 0.3 +
      latencyScore * 0.2 +
      ageScore * 0.1 +
      Math.max(0, 100 - reportPenalty) * 0.1,
    );

    const data: ReputationData = {
      score: Math.max(0, Math.min(100, score)),
      uptime: Math.round(uptime * 100) / 100,
      deliveryRate: Math.round(deliveryRate * 100) / 100,
      latencyP99,
      ageHours: Math.round(ageHours),
      reports,
      lastUpdated: new Date().toISOString(),
    };

    await this.redis.set(`relay:rep:${relayDomain}`, JSON.stringify(data), 'EX', 300);
    return data;
  }

  async recordHealthCheck(relayDomain: string, success: boolean, latencyMs: number): Promise<void> {
    const key = `relay:stats:${relayDomain}`;
    const pipeline = this.redis.pipeline();
    pipeline.hincrby(key, 'totalChecks', 1);
    if (success) pipeline.hincrby(key, 'successChecks', 1);
    pipeline.hset(key, 'latencyP99', String(latencyMs));
    await pipeline.exec();
  }

  async recordDelivery(relayDomain: string, success: boolean): Promise<void> {
    const key = `relay:stats:${relayDomain}`;
    const pipeline = this.redis.pipeline();
    pipeline.hincrby(key, 'totalEnvelopes', 1);
    if (success) pipeline.hincrby(key, 'deliveredEnvelopes', 1);
    await pipeline.exec();
  }

  async addReport(relayDomain: string, reporterDomain: string, reason: string): Promise<void> {
    await this.redis.hincrby(`relay:stats:${relayDomain}`, 'reports', 1);
    await this.redis.lpush(`relay:reports:${relayDomain}`, JSON.stringify({
      reporter: reporterDomain,
      reason,
      timestamp: new Date().toISOString(),
    }));
    await this.redis.ltrim(`relay:reports:${relayDomain}`, 0, 99);
  }

  async getScore(relayDomain: string): Promise<ReputationData | null> {
    const raw = await this.redis.get(`relay:rep:${relayDomain}`);
    if (!raw) return null;
    return JSON.parse(raw);
  }

  async initRelay(relayDomain: string): Promise<void> {
    await this.redis.hset(`relay:stats:${relayDomain}`, {
      totalChecks: '0',
      successChecks: '0',
      totalEnvelopes: '0',
      deliveredEnvelopes: '0',
      latencyP99: '500',
      registeredAt: new Date().toISOString(),
      reports: '0',
    });
  }

  async shouldDelist(relayDomain: string): Promise<boolean> {
    const data = await this.getScore(relayDomain);
    if (!data) return false;
    return data.score < 20;
  }
}
