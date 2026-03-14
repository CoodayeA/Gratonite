/**
 * routes/bot-framework.ts — Bot SDK docs page + API key management.
 * Mounted at /bots/framework
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';

export const botFrameworkRouter = Router();

// GET /bots/framework/docs — return SDK documentation
botFrameworkRouter.get('/docs', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  res.json({
    version: '1.0.0',
    baseUrl: '/api/v1',
    authentication: 'Bot token via Authorization: Bot <token> header',
    endpoints: [
      { method: 'GET', path: '/guilds/:guildId', description: 'Get guild info' },
      { method: 'GET', path: '/channels/:channelId/messages', description: 'Get messages' },
      { method: 'POST', path: '/channels/:channelId/messages', description: 'Send a message' },
      { method: 'PUT', path: '/channels/:channelId/messages/:messageId/reactions/:emoji/@me', description: 'Add reaction' },
      { method: 'GET', path: '/guilds/:guildId/members', description: 'List members' },
      { method: 'POST', path: '/channels/:channelId/messages/:messageId/components/:actionId', description: 'Handle component interaction' },
    ],
    events: [
      { name: 'message_create', description: 'New message in a channel the bot has access to' },
      { name: 'guild_member_add', description: 'A new member joins a guild' },
      { name: 'guild_member_remove', description: 'A member leaves a guild' },
      { name: 'reaction_add', description: 'A reaction is added to a message' },
      { name: 'interaction_create', description: 'A slash command or component interaction' },
    ],
    quickStart: [
      'Create a bot application at /bots/applications',
      'Install the bot in your server via the bot store',
      'Use the bot token to authenticate API requests',
      'Listen for WebSocket events on the /ws endpoint',
    ],
    rateLimits: {
      global: '50 requests/second',
      perRoute: '5 requests/second',
      messageCreate: '5 messages/5 seconds per channel',
    },
    sdkExample: `
const GratoniteBot = require('gratonite-bot-sdk');
const bot = new GratoniteBot({ token: 'YOUR_BOT_TOKEN' });

bot.on('message_create', async (msg) => {
  if (msg.content === '!ping') {
    await bot.sendMessage(msg.channelId, { content: 'Pong!' });
  }
});

bot.connect();
    `.trim(),
  });
});

// GET /bots/framework/templates — starter bot templates
botFrameworkRouter.get('/templates', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  res.json([
    { id: 'welcome', name: 'Welcome Bot', description: 'Greets new members', language: 'javascript' },
    { id: 'moderation', name: 'Moderation Bot', description: 'Auto-mod with warn/kick/ban commands', language: 'javascript' },
    { id: 'music', name: 'Music Bot', description: 'Play music in voice channels', language: 'javascript' },
    { id: 'poll', name: 'Poll Bot', description: 'Create and manage polls', language: 'javascript' },
    { id: 'leveling', name: 'Leveling Bot', description: 'Track XP and levels', language: 'javascript' },
  ]);
});
