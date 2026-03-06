/**
 * lib/workflow-executor.ts — Executes workflows triggered by guild events.
 *
 * Called from socket/index.ts (and potentially from HTTP route handlers) when
 * a trigger-worthy event occurs (member join, message sent, etc.).
 *
 * Design: fire-and-forget from the call site — callers wrap in try/catch so
 * workflow errors never affect normal operation.
 */

import { db } from '../db';
import { workflows, workflowTriggers, workflowActions } from '../db/schema/workflows';
import { eq, and } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkflowContext = {
  guildId: string;
  userId?: string;
  channelId?: string;
  messageId?: string;
  messageContent?: string;
  reactionEmoji?: string;
};

export type TriggerType =
  | 'member_join'
  | 'message_sent'
  | 'reaction_added'
  | 'member_leave';

// ---------------------------------------------------------------------------
// executeWorkflows — entry point
// ---------------------------------------------------------------------------

export async function executeWorkflows(
  guildId: string,
  triggerType: TriggerType,
  context: WorkflowContext,
  io?: any,
): Promise<void> {
  // 1. Find all enabled workflows for this guild
  const matchingWorkflows = await db
    .select()
    .from(workflows)
    .where(and(eq(workflows.guildId, guildId), eq(workflows.enabled, true)));

  for (const workflow of matchingWorkflows) {
    // 2. Check if this workflow has a trigger of the given type
    const triggers = await db
      .select()
      .from(workflowTriggers)
      .where(
        and(
          eq(workflowTriggers.workflowId, workflow.id),
          eq(workflowTriggers.type, triggerType),
        ),
      );

    if (triggers.length === 0) continue;

    // 3. Get actions sorted by orderIndex (SQL column: order)
    const actions = await db
      .select()
      .from(workflowActions)
      .where(eq(workflowActions.workflowId, workflow.id))
      .orderBy(workflowActions.orderIndex);

    // 4. Execute each action sequentially
    for (const action of actions) {
      try {
        await executeAction(action, context, io);
      } catch (err) {
        console.error(`[workflow-executor] action ${action.type} failed (workflow=${workflow.id}):`, err);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// executeAction — dispatch to action handler
// ---------------------------------------------------------------------------

async function executeAction(action: any, context: WorkflowContext, io?: any): Promise<void> {
  const config = (action.config ?? {}) as Record<string, any>;

  switch (action.type) {
    case 'send_message': {
      if (config.channelId && config.content && io) {
        io.to(`channel:${config.channelId}`).emit('MESSAGE_CREATE', {
          id: crypto.randomUUID(),
          channelId: config.channelId,
          content: config.content,
          author: { id: 'system', username: 'Automation', discriminator: '0000' },
          createdAt: new Date().toISOString(),
          isSystem: true,
        });
      }
      break;
    }

    case 'add_role':
    case 'remove_role': {
      // Role assignment requires guild member update — log for now
      console.log(`[workflow] ${action.type} roleId=${config.roleId} userId=${context.userId}`);
      break;
    }

    case 'create_thread': {
      // Thread creation requires channel write access — log for now
      console.log(`[workflow] create_thread channelId=${config.channelId} name=${config.name}`);
      break;
    }

    case 'pin_message': {
      // Pin message — log for now
      console.log(`[workflow] pin_message messageId=${context.messageId}`);
      break;
    }

    default: {
      console.warn(`[workflow-executor] unknown action type: ${action.type}`);
    }
  }
}
