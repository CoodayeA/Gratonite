import { Router, Request, Response } from 'express';
import { OpenApiGeneratorV3, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

export const openapiRouter = Router();
export const openapiRegistry = new OpenAPIRegistry();

// Register core schemas
openapiRegistry.register('User', z.object({
  id: z.string().uuid(),
  username: z.string(),
  displayName: z.string(),
  avatarHash: z.string().nullable(),
  bio: z.string().nullable(),
  status: z.enum(['online', 'idle', 'dnd', 'invisible', 'offline']),
  isBot: z.boolean(),
  createdAt: z.string(),
}));

openapiRegistry.register('Guild', z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  iconHash: z.string().nullable(),
  ownerId: z.string().uuid(),
  memberCount: z.number(),
  isDiscoverable: z.boolean(),
  createdAt: z.string(),
}));

openapiRegistry.register('Channel', z.object({
  id: z.string().uuid(),
  guildId: z.string().uuid().nullable(),
  name: z.string(),
  type: z.enum(['GUILD_TEXT', 'GUILD_VOICE', 'GUILD_CATEGORY', 'DM', 'GROUP_DM']),
  topic: z.string().nullable(),
  position: z.number(),
  createdAt: z.string(),
}));

openapiRegistry.register('Message', z.object({
  id: z.string().uuid(),
  channelId: z.string().uuid(),
  authorId: z.string().uuid().nullable(),
  content: z.string().nullable(),
  attachments: z.array(z.any()),
  edited: z.boolean(),
  createdAt: z.string(),
}));

// Register key API paths
openapiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/auth/register',
  summary: 'Create a new account',
  request: { body: { content: { 'application/json': { schema: z.object({
    username: z.string().min(2).max(32),
    email: z.string().email(),
    password: z.string().min(8),
    displayName: z.string().optional(),
  })}}}},
  responses: { 201: { description: 'Account created' }, 409: { description: 'Username or email taken' }},
});

openapiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/auth/login',
  summary: 'Authenticate and get tokens',
  request: { body: { content: { 'application/json': { schema: z.object({
    login: z.string(),
    password: z.string(),
    mfaCode: z.string().optional(),
  })}}}},
  responses: { 200: { description: 'Login successful' }, 401: { description: 'Invalid credentials' }},
});

openapiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/guilds/@me',
  summary: 'Get guilds the current user is a member of',
  responses: { 200: { description: 'List of guilds' }},
});

openapiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/guilds',
  summary: 'Create a new guild',
  request: { body: { content: { 'application/json': { schema: z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
  })}}}},
  responses: { 201: { description: 'Guild created' }},
});

openapiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/channels/{channelId}/messages',
  summary: 'Get messages in a channel',
  request: { params: z.object({ channelId: z.string().uuid() }) },
  responses: { 200: { description: 'List of messages' }},
});

openapiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/channels/{channelId}/messages',
  summary: 'Send a message',
  request: {
    params: z.object({ channelId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: z.object({
      content: z.string().optional(),
      attachments: z.array(z.any()).optional(),
    })}}}
  },
  responses: { 201: { description: 'Message sent' }},
});

// Generate the spec
const generator = new OpenApiGeneratorV3(openapiRegistry.definitions);
const spec = generator.generateDocument({
  openapi: '3.0.3',
  info: {
    title: 'Gratonite API',
    version: '1.0.0',
    description: 'API for the Gratonite communication platform',
  },
  servers: [
    { url: 'https://api.gratonite.chat', description: 'Production' },
    { url: 'http://localhost:3000', description: 'Development' },
  ],
  security: [{ bearerAuth: [] }],
});

// Add security scheme
spec.components = spec.components || {};
spec.components.securitySchemes = {
  bearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  },
};

// Serve the spec
openapiRouter.get('/openapi.json', (_req: Request, res: Response) => {
  res.json(spec);
});
