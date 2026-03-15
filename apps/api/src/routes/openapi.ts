import { Router, Request, Response } from 'express';

export const openapiRouter = Router();

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Gratonite API',
    version: '1.0.0',
    description: 'API for the Gratonite communication platform. All endpoints require Bearer JWT authentication unless noted.',
  },
  servers: [
    { url: 'https://api.gratonite.chat/api/v1', description: 'Production' },
    { url: 'http://localhost:4000/api/v1', description: 'Development' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          username: { type: 'string' },
          displayName: { type: 'string' },
          avatarHash: { type: 'string', nullable: true },
          bio: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['online', 'idle', 'dnd', 'invisible', 'offline'] },
          isBot: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Guild: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          iconHash: { type: 'string', nullable: true },
          ownerId: { type: 'string', format: 'uuid' },
          memberCount: { type: 'integer' },
          isDiscoverable: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Channel: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          guildId: { type: 'string', format: 'uuid', nullable: true },
          name: { type: 'string' },
          type: { type: 'string', enum: ['GUILD_TEXT', 'GUILD_VOICE', 'GUILD_CATEGORY', 'DM', 'GROUP_DM'] },
          topic: { type: 'string', nullable: true },
          position: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Message: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          channelId: { type: 'string', format: 'uuid' },
          authorId: { type: 'string', format: 'uuid', nullable: true },
          content: { type: 'string', nullable: true },
          attachments: { type: 'array', items: { type: 'object' } },
          edited: { type: 'boolean' },
          embeds: { type: 'array', items: { type: 'object' } },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Create a new account',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'email', 'password'],
                properties: {
                  username: { type: 'string', minLength: 2, maxLength: 32 },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  displayName: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Account created successfully' },
          '409': { description: 'Username or email already taken' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Authenticate and receive tokens',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['login', 'password'],
                properties: {
                  login: { type: 'string', description: 'Username or email' },
                  password: { type: 'string' },
                  mfaCode: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Login successful' },
          '401': { description: 'Invalid credentials or MFA required' },
        },
      },
    },
    '/guilds/@me': {
      get: {
        tags: ['Guilds'],
        summary: 'List guilds the current user belongs to',
        responses: {
          '200': {
            description: 'Array of guilds',
            content: { 'application/json': { schema: { type: 'array', items: { '$ref': '#/components/schemas/Guild' } } } },
          },
        },
      },
    },
    '/guilds': {
      post: {
        tags: ['Guilds'],
        summary: 'Create a new guild',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', minLength: 1, maxLength: 100 },
                  description: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Guild created', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Guild' } } } },
        },
      },
    },
    '/guilds/{guildId}': {
      get: {
        tags: ['Guilds'],
        summary: 'Get guild details',
        parameters: [{ name: 'guildId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Guild details', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Guild' } } } },
          '404': { description: 'Guild not found' },
        },
      },
    },
    '/channels/{channelId}/messages': {
      get: {
        tags: ['Messages'],
        summary: 'Get messages in a channel',
        parameters: [
          { name: 'channelId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          { name: 'before', in: 'query', schema: { type: 'string', format: 'date-time' } },
        ],
        responses: {
          '200': { description: 'Array of messages', content: { 'application/json': { schema: { type: 'array', items: { '$ref': '#/components/schemas/Message' } } } } },
        },
      },
      post: {
        tags: ['Messages'],
        summary: 'Send a message',
        parameters: [{ name: 'channelId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  content: { type: 'string' },
                  replyToId: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Message sent', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Message' } } } },
        },
      },
    },
    '/users/@me': {
      get: {
        tags: ['Users'],
        summary: 'Get current user profile',
        responses: {
          '200': { description: 'User profile', content: { 'application/json': { schema: { '$ref': '#/components/schemas/User' } } } },
        },
      },
    },
  },
};

openapiRouter.get('/openapi.json', (_req: Request, res: Response) => {
  res.json(spec);
});
