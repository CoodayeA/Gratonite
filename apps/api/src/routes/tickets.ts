import { Router, Request, Response } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { tickets, ticketConfig } from '../db/schema/tickets';
import { channels } from '../db/schema/channels';
import { messages } from '../db/schema/messages';
import { users } from '../db/schema/users';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { hasPermission } from './roles';

export const ticketsRouter = Router({ mergeParams: true });

// GET /guilds/:guildId/tickets/config
ticketsRouter.get('/config', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;
    const [config] = await db.select().from(ticketConfig).where(eq(ticketConfig.guildId, guildId)).limit(1);
    res.json(config || { guildId, categoryChannelId: null, supportRoleId: null, autoCloseHours: 48, greeting: 'A staff member will be with you shortly.' });
  } catch (err) {
    console.error('[tickets] GET config error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// PUT /guilds/:guildId/tickets/config
ticketsRouter.put('/config', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;
    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' });
      return;
    }
    const { categoryChannelId, supportRoleId, autoCloseHours, greeting } = req.body;
    const [upserted] = await db.insert(ticketConfig)
      .values({ guildId, categoryChannelId: categoryChannelId || null, supportRoleId: supportRoleId || null, autoCloseHours: autoCloseHours ?? 48, greeting: greeting ?? 'A staff member will be with you shortly.' })
      .onConflictDoUpdate({
        target: ticketConfig.guildId,
        set: { categoryChannelId: categoryChannelId || null, supportRoleId: supportRoleId || null, autoCloseHours: autoCloseHours ?? 48, greeting: greeting ?? 'A staff member will be with you shortly.' },
      })
      .returning();
    res.json(upserted);
  } catch (err) {
    console.error('[tickets] PUT config error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// GET /guilds/:guildId/tickets
ticketsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;
    const status = req.query.status as string | undefined;
    const assignee = req.query.assignee as string | undefined;

    let conditions = [eq(tickets.guildId, guildId)];
    if (status) conditions.push(eq(tickets.status, status));
    if (assignee === 'me') conditions.push(eq(tickets.assigneeId, req.userId!));

    const rows = await db.select({
      id: tickets.id,
      guildId: tickets.guildId,
      channelId: tickets.channelId,
      authorId: tickets.authorId,
      assigneeId: tickets.assigneeId,
      status: tickets.status,
      subject: tickets.subject,
      priority: tickets.priority,
      createdAt: tickets.createdAt,
      closedAt: tickets.closedAt,
      authorUsername: users.username,
      authorDisplayName: users.displayName,
    })
      .from(tickets)
      .leftJoin(users, eq(tickets.authorId, users.id))
      .where(and(...conditions))
      .orderBy(desc(tickets.createdAt))
      .limit(100);

    res.json(rows);
  } catch (err) {
    console.error('[tickets] GET error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /guilds/:guildId/tickets — open ticket
ticketsRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;
    const { subject, priority } = req.body as { subject: string; priority?: string };
    if (!subject || !subject.trim()) {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'subject is required' });
      return;
    }

    const validPriorities = ['low', 'medium', 'high'];
    const ticketPriority = validPriorities.includes(priority || '') ? priority! : 'medium';

    // Get config for category channel
    const [config] = await db.select().from(ticketConfig).where(eq(ticketConfig.guildId, guildId)).limit(1);

    // Create a private channel for the ticket
    const ticketNum = await db.select({ count: sql<number>`count(*)::int` }).from(tickets).where(eq(tickets.guildId, guildId));
    const num = (ticketNum[0]?.count || 0) + 1;

    const [channel] = await db.insert(channels).values({
      guildId,
      name: `ticket-${num}`,
      type: 'GUILD_TEXT',
      topic: subject,
      parentId: config?.categoryChannelId || null,
    }).returning();

    const [ticket] = await db.insert(tickets).values({
      guildId,
      channelId: channel.id,
      authorId: req.userId!,
      subject,
      priority: ticketPriority,
    }).returning();

    // Post greeting message in the ticket channel
    const greetingText = config?.greeting || 'A staff member will be with you shortly.';
    await db.insert(messages).values({
      channelId: channel.id,
      content: `**Ticket: ${subject}**\nPriority: ${ticketPriority}\n\n${greetingText}`,
    });

    res.status(201).json({ ...ticket, channel });
  } catch (err) {
    console.error('[tickets] POST error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// PATCH /guilds/:guildId/tickets/:id — update ticket
ticketsRouter.patch('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;
    const id = req.params.id as string;

    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Requires support role or MANAGE_GUILD' });
      return;
    }

    const { status, assigneeId, priority } = req.body as { status?: string; assigneeId?: string; priority?: string };
    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (assigneeId !== undefined) updates.assigneeId = assigneeId || null;
    if (priority) updates.priority = priority;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'No fields to update' });
      return;
    }

    const [updated] = await db.update(tickets)
      .set(updates)
      .where(and(eq(tickets.id, id), eq(tickets.guildId, guildId)))
      .returning();

    if (!updated) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Ticket not found' });
      return;
    }
    res.json(updated);
  } catch (err) {
    console.error('[tickets] PATCH error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /guilds/:guildId/tickets/:id/close — close ticket
ticketsRouter.post('/:id/close', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;
    const id = req.params.id as string;

    const [ticket] = await db.select().from(tickets)
      .where(and(eq(tickets.id, id), eq(tickets.guildId, guildId)))
      .limit(1);

    if (!ticket) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Ticket not found' });
      return;
    }

    // Only author or staff can close
    const isAuthor = ticket.authorId === req.userId;
    const isStaff = await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD);
    if (!isAuthor && !isStaff) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Cannot close this ticket' });
      return;
    }

    // Save transcript from channel messages
    let transcript: unknown[] = [];
    if (ticket.channelId) {
      const msgs = await db.select({
        id: messages.id,
        authorId: messages.authorId,
        content: messages.content,
        createdAt: messages.createdAt,
      })
        .from(messages)
        .where(eq(messages.channelId, ticket.channelId))
        .orderBy(messages.createdAt)
        .limit(500);
      transcript = msgs;
    }

    const [closed] = await db.update(tickets)
      .set({ status: 'closed', closedAt: new Date(), transcript })
      .where(eq(tickets.id, id))
      .returning();

    res.json(closed);
  } catch (err) {
    console.error('[tickets] POST close error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});
