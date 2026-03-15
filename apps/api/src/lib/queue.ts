/**
 * lib/queue.ts — BullMQ queue factory.
 *
 * Creates queues and workers that reuse the existing Redis connection config.
 * BullMQ requires its own connections (it cannot share an ioredis instance)
 * so we parse REDIS_URL and pass the connection options.
 */

import { Queue, Worker, type Processor, type WorkerOptions, type QueueOptions } from 'bullmq';
import { logger } from './logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const parsed = new URL(redisUrl);

const connection = {
  host: parsed.hostname || '127.0.0.1',
  port: Number(parsed.port) || 6379,
  password: parsed.password || undefined,
  db: parsed.pathname ? Number(parsed.pathname.slice(1)) || 0 : 0,
  username: parsed.username || undefined,
};

/** All queues created by the factory — used for Bull Board and shutdown. */
export const allQueues: Queue[] = [];

/** All workers created by the factory — used for graceful shutdown. */
export const allWorkers: Worker[] = [];

/** Create a BullMQ Queue with the shared Redis connection config. */
export function createQueue(name: string, opts?: Partial<QueueOptions>): Queue {
  const q = new Queue(name, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 500 },
    },
    ...opts,
  });
  allQueues.push(q);
  return q;
}

/** Create a BullMQ Worker with the shared Redis connection config. */
export function createWorker<T = any>(
  name: string,
  processor: Processor<T>,
  opts?: Partial<WorkerOptions>,
): Worker<T> {
  const w = new Worker<T>(name, processor, {
    connection,
    concurrency: 1,
    ...opts,
  });

  w.on('failed', (job, err) => {
    logger.error(`[bullmq] Job ${job?.name}#${job?.id} in queue "${name}" failed:`, err);
  });

  w.on('error', (err) => {
    logger.error(`[bullmq] Worker "${name}" error:`, err);
  });

  allWorkers.push(w);
  return w;
}

/** Gracefully close all queues and workers. */
export async function closeAllQueues(): Promise<void> {
  await Promise.allSettled([
    ...allWorkers.map(w => w.close()),
    ...allQueues.map(q => q.close()),
  ]);
}
