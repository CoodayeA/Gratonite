/**
 * routes/message-components.ts — Interactive Message Components v2.
 * Mounted at /channels/:channelId/messages/:messageId/components
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { messages } from '../db/schema/messages';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getIO } from '../lib/socket-io';
import { logger } from '../lib/logger';

export const messageComponentsRouter = Router({ mergeParams: true });

const interactSchema = z.object({
  action: z.string().min(1).max(100),
  value: z.string().max(4000).optional(),
});

// POST /channels/:channelId/messages/:messageId/components/:componentId/interact
messageComponentsRouter.post('/:componentId/interact', requireAuth, validate(interactSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    const messageId = req.params.messageId as string;
    const componentId = req.params.componentId as string;
    const { action, value } = req.body;

    // Fetch the message
    const [message] = await db.select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);

    if (!message) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Message not found' });
      return;
    }

    if (message.channelId !== channelId) {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'Message does not belong to this channel' });
      return;
    }

    // Parse existing components
    const components = (message.components as any[]) || [];

    // Find the target component by searching action rows
    let targetComponent: any = null;
    let actionRowIndex = -1;
    let componentIndex = -1;

    for (let i = 0; i < components.length; i++) {
      const row = components[i];
      if (row.components && Array.isArray(row.components)) {
        for (let j = 0; j < row.components.length; j++) {
          const comp = row.components[j];
          if (comp.custom_id === componentId || comp.id === componentId) {
            targetComponent = comp;
            actionRowIndex = i;
            componentIndex = j;
            break;
          }
        }
      }
      if (targetComponent) break;
    }

    if (!targetComponent) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Component not found in message' });
      return;
    }

    // Handle interaction based on component type and action
    const updatedComponent = { ...targetComponent };

    switch (action) {
      case 'click': {
        // Button click — track click count and last clicker
        updatedComponent.interaction_count = (updatedComponent.interaction_count || 0) + 1;
        updatedComponent.last_interacted_by = req.userId;
        updatedComponent.last_interacted_at = new Date().toISOString();
        break;
      }
      case 'select': {
        // Select menu — store selected value
        updatedComponent.selected_values = updatedComponent.selected_values || [];
        if (value && !updatedComponent.selected_values.includes(value)) {
          updatedComponent.selected_values.push(value);
        }
        updatedComponent.last_interacted_by = req.userId;
        updatedComponent.last_interacted_at = new Date().toISOString();
        break;
      }
      case 'toggle': {
        // Toggle button — flip disabled/active state
        updatedComponent.disabled = !updatedComponent.disabled;
        updatedComponent.last_interacted_by = req.userId;
        updatedComponent.last_interacted_at = new Date().toISOString();
        break;
      }
      case 'vote': {
        // Poll-style voting
        updatedComponent.votes = updatedComponent.votes || {};
        const userId = req.userId!;
        if (updatedComponent.votes[userId]) {
          delete updatedComponent.votes[userId];
        } else {
          updatedComponent.votes[userId] = value || true;
        }
        updatedComponent.vote_count = Object.keys(updatedComponent.votes).length;
        break;
      }
      default: {
        // Generic interaction — store action and value
        updatedComponent.last_action = action;
        updatedComponent.last_value = value;
        updatedComponent.last_interacted_by = req.userId;
        updatedComponent.last_interacted_at = new Date().toISOString();
      }
    }

    // Write back updated component
    const updatedComponents = [...components];
    updatedComponents[actionRowIndex] = {
      ...updatedComponents[actionRowIndex],
      components: [...updatedComponents[actionRowIndex].components],
    };
    updatedComponents[actionRowIndex].components[componentIndex] = updatedComponent;

    await db.update(messages)
      .set({ components: updatedComponents })
      .where(eq(messages.id, messageId));

    getIO().to(`channel:${channelId}`).emit('MESSAGE_COMPONENT_INTERACT', {
      messageId,
      componentId,
      action,
      value,
      userId: req.userId,
      updatedComponent,
    });

    res.json({ component: updatedComponent, messageId });
  } catch (err) {
    logger.error('[message-components] POST interact error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});
