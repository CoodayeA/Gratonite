import type { BotMessageEvent, BotInteractionEvent } from '@gratonite/types';

export interface BotConfig {
  /** Bot API token from the developer portal */
  token: string;
  /** Webhook URL that Gratonite sends events to (for verification) */
  webhookUrl?: string;
  /** Port for the built-in webhook server (default: 3001) */
  port?: number;
}

export type EventHandler<T = any> = (event: T) => void | Promise<void>;

export class GratoniteBot {
  private config: BotConfig;
  private handlers: Map<string, EventHandler[]> = new Map();
  private server: any = null;

  constructor(config: BotConfig) {
    this.config = config;
  }

  /** Register an event handler */
  on(event: string, handler: EventHandler): this {
    const handlers = this.handlers.get(event) || [];
    handlers.push(handler);
    this.handlers.set(event, handlers);
    return this;
  }

  /** Handle message_create events */
  onMessage(handler: EventHandler<BotMessageEvent>): this {
    return this.on('message_create', handler);
  }

  /** Handle interaction events (button clicks, select menus) */
  onInteraction(handler: EventHandler<BotInteractionEvent>): this {
    return this.on('interaction_create', handler);
  }

  /** Start the webhook server to receive events from Gratonite */
  async start(): Promise<void> {
    // Dynamic import to avoid bundling http for non-server use
    const http = await import('http');
    const port = this.config.port || 3001;

    this.server = http.createServer(async (req, res) => {
      if (req.method !== 'POST') {
        res.writeHead(405).end();
        return;
      }

      const body = await this.readBody(req);
      try {
        const event = JSON.parse(body);
        await this.dispatch(event.type, event);
        res.writeHead(200).end('ok');
      } catch (err) {
        res.writeHead(400).end('invalid payload');
      }
    });

    this.server.listen(port, () => {
      console.log(`[GratoniteBot] Webhook server listening on port ${port}`);
    });
  }

  /** Stop the webhook server */
  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve) => this.server.close(resolve));
      this.server = null;
    }
  }

  /** Send a message to a channel via the Gratonite API */
  async sendMessage(channelId: string, content: string, options?: {
    embeds?: any[];
    components?: any[];
    replyToId?: string;
  }): Promise<any> {
    return this.apiRequest('POST', `/api/v1/channels/${channelId}/messages`, {
      content,
      ...options,
    });
  }

  /** Add a reaction to a message */
  async addReaction(channelId: string, messageId: string, emoji: string): Promise<void> {
    await this.apiRequest('PUT', `/api/v1/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`);
  }

  /** Get guild info */
  async getGuild(guildId: string): Promise<any> {
    return this.apiRequest('GET', `/api/v1/guilds/${guildId}`);
  }

  /** Get channel info */
  async getChannel(channelId: string): Promise<any> {
    return this.apiRequest('GET', `/api/v1/channels/${channelId}`);
  }

  private async dispatch(eventType: string, event: any): Promise<void> {
    const handlers = this.handlers.get(eventType) || [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        console.error(`[GratoniteBot] Error in ${eventType} handler:`, err);
      }
    }
  }

  private async apiRequest(method: string, path: string, body?: any): Promise<any> {
    const baseUrl = process.env.GRATONITE_API_URL || 'https://api.gratonite.chat';
    const url = `${baseUrl}${path}`;

    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.config.token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'GratoniteBot/0.1.0',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API request failed: ${res.status} ${text}`);
    }

    const contentType = res.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return res.json();
    }
  }

  private readBody(req: any): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk: string) => { data += chunk; });
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });
  }
}
