import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { requireAuth } from '../middleware/auth';
import { hasPermission } from './roles';
import { Permissions } from '../db/schema/roles';
import { guildForms, guildFormResponses } from '../db/schema/guild-forms';
import { memberRoles } from '../db/schema/roles';
import { users } from '../db/schema/users';

export const guildFormsRouter = Router({ mergeParams: true });

// GET /guilds/:guildId/forms — list forms
guildFormsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params as Record<string, string>;
    const forms = await db.select().from(guildForms).where(eq(guildForms.guildId, guildId)).orderBy(desc(guildForms.createdAt));
    res.json(forms);
  } catch (err) {
    logger.error('[guild-forms] GET list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /guilds/:guildId/forms — create form
guildFormsRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params as Record<string, string>;
    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
      res.status(403).json({ error: 'Missing MANAGE_GUILD permission' }); return;
    }

    const { title, description, fields, responseChannelId, roleOnApproval } = req.body;
    if (!title) { res.status(400).json({ error: 'title is required' }); return; }

    const [form] = await db.insert(guildForms).values({
      guildId,
      title,
      description: description || null,
      fields: fields || [],
      responseChannelId: responseChannelId || null,
      roleOnApproval: roleOnApproval || null,
      createdBy: req.userId!,
    }).returning();
    res.status(201).json(form);
  } catch (err) {
    logger.error('[guild-forms] POST error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /guilds/:guildId/forms/:id — get single form (public for filling)
guildFormsRouter.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId, id } = req.params as Record<string, string>;
    const [form] = await db.select().from(guildForms).where(and(eq(guildForms.id, id), eq(guildForms.guildId, guildId))).limit(1);
    if (!form) { res.status(404).json({ error: 'Form not found' }); return; }
    res.json(form);
  } catch (err) {
    logger.error('[guild-forms] GET single error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /guilds/:guildId/forms/:id — update form
guildFormsRouter.patch('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId, id } = req.params as Record<string, string>;
    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
      res.status(403).json({ error: 'Missing MANAGE_GUILD permission' }); return;
    }

    const updates: Record<string, unknown> = {};
    const { title, description, fields, responseChannelId, roleOnApproval, status } = req.body;
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (fields !== undefined) updates.fields = fields;
    if (responseChannelId !== undefined) updates.responseChannelId = responseChannelId;
    if (roleOnApproval !== undefined) updates.roleOnApproval = roleOnApproval;
    if (status !== undefined) updates.status = status;

    const [form] = await db.update(guildForms).set(updates).where(and(eq(guildForms.id, id), eq(guildForms.guildId, guildId))).returning();
    if (!form) { res.status(404).json({ error: 'Form not found' }); return; }
    res.json(form);
  } catch (err) {
    logger.error('[guild-forms] PATCH error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /guilds/:guildId/forms/:id — delete form
guildFormsRouter.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId, id } = req.params as Record<string, string>;
    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
      res.status(403).json({ error: 'Missing MANAGE_GUILD permission' }); return;
    }

    const [deleted] = await db.delete(guildForms).where(and(eq(guildForms.id, id), eq(guildForms.guildId, guildId))).returning();
    if (!deleted) { res.status(404).json({ error: 'Form not found' }); return; }
    res.json({ success: true });
  } catch (err) {
    logger.error('[guild-forms] DELETE error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /guilds/:guildId/forms/:id/responses — submit response
guildFormsRouter.post('/:id/responses', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId, id } = req.params as Record<string, string>;
    const [form] = await db.select().from(guildForms).where(and(eq(guildForms.id, id), eq(guildForms.guildId, guildId))).limit(1);
    if (!form) { res.status(404).json({ error: 'Form not found' }); return; }
    if (form.status !== 'open') { res.status(400).json({ error: 'Form is closed' }); return; }

    const { answers } = req.body;
    if (!answers) { res.status(400).json({ error: 'answers is required' }); return; }

    const [response] = await db.insert(guildFormResponses).values({
      formId: id,
      userId: req.userId!,
      answers,
    }).returning();
    res.status(201).json(response);
  } catch (err) {
    logger.error('[guild-forms] POST response error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /guilds/:guildId/forms/:id/responses — list responses (paginated)
guildFormsRouter.get('/:id/responses', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId, id } = req.params as Record<string, string>;
    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
      res.status(403).json({ error: 'Missing MANAGE_GUILD permission' }); return;
    }

    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;

    const responses = await db.select({
      id: guildFormResponses.id,
      formId: guildFormResponses.formId,
      userId: guildFormResponses.userId,
      answers: guildFormResponses.answers,
      status: guildFormResponses.status,
      reviewedBy: guildFormResponses.reviewedBy,
      reviewedAt: guildFormResponses.reviewedAt,
      createdAt: guildFormResponses.createdAt,
      username: users.username,
      displayName: users.displayName,
    }).from(guildFormResponses)
      .innerJoin(users, eq(guildFormResponses.userId, users.id))
      .where(eq(guildFormResponses.formId, id))
      .orderBy(desc(guildFormResponses.createdAt))
      .limit(limit)
      .offset(offset);

    const [countRow] = await db.select({ count: sql<number>`count(*)::int` }).from(guildFormResponses).where(eq(guildFormResponses.formId, id));
    res.json({ responses, total: countRow?.count ?? 0 });
  } catch (err) {
    logger.error('[guild-forms] GET responses error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /guilds/:guildId/forms/:id/responses/:responseId — review response
guildFormsRouter.patch('/:id/responses/:responseId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId, id, responseId } = req.params as Record<string, string>;
    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
      res.status(403).json({ error: 'Missing MANAGE_GUILD permission' }); return;
    }

    const { status } = req.body;
    if (!status || !['approved', 'rejected'].includes(status)) {
      res.status(400).json({ error: 'status must be approved or rejected' }); return;
    }

    const [response] = await db.update(guildFormResponses).set({
      status,
      reviewedBy: req.userId!,
      reviewedAt: new Date(),
    }).where(and(eq(guildFormResponses.id, responseId), eq(guildFormResponses.formId, id))).returning();

    if (!response) { res.status(404).json({ error: 'Response not found' }); return; }

    // If approved and form has roleOnApproval, assign the role
    if (status === 'approved') {
      const [form] = await db.select().from(guildForms).where(eq(guildForms.id, id)).limit(1);
      if (form?.roleOnApproval) {
        await db.insert(memberRoles).values({
          userId: response.userId,
          roleId: form.roleOnApproval,
          guildId,
        }).onConflictDoNothing();
      }
    }

    res.json(response);
  } catch (err) {
    logger.error('[guild-forms] PATCH response error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
