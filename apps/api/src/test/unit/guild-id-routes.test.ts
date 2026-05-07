import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';

const dbSelectMock = vi.hoisted(() => vi.fn(() => {
  throw new Error('DB should not be touched for malformed guild IDs');
}));

vi.mock('../../middleware/auth', () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.userId = '00000000-0000-0000-0000-000000000001';
    next();
  },
}));

vi.mock('../../db/index', () => ({
  db: {
    select: dbSelectMock,
  },
}));

vi.mock('../../lib/webhook-dispatch', () => ({
  dispatchInteraction: vi.fn(),
  dispatchEvent: vi.fn(),
  processActions: vi.fn(),
}));

const { commandsRouter } = await import('../../routes/commands');
const { stickersRouter } = await import('../../routes/stickers');

async function withApp<T>(callback: (baseUrl: string) => Promise<T>): Promise<T> {
  const app = express();
  app.use(express.json());
  app.use('/guilds/:guildId/commands', commandsRouter);
  app.use('/guilds/:guildId/stickers', stickersRouter);

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Expected TCP server address');
  }

  try {
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

describe('guild-scoped route validation', () => {
  afterEach(() => {
    dbSelectMock.mockClear();
  });

  it('rejects malformed guild IDs for commands before DB access', async () => {
    await withApp(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/guilds/channel/commands`);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        code: 'VALIDATION_ERROR',
        message: 'guildId must be a valid UUID',
      });
      expect(dbSelectMock).not.toHaveBeenCalled();
    });
  });

  it('rejects malformed guild IDs for stickers before DB access', async () => {
    await withApp(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/guilds/channel/stickers`);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        code: 'VALIDATION_ERROR',
        message: 'guildId must be a valid UUID',
      });
      expect(dbSelectMock).not.toHaveBeenCalled();
    });
  });
});
