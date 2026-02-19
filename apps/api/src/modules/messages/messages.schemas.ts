import { z } from 'zod';

export const createMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  nonce: z.string().max(64).optional(),
  tts: z.boolean().optional(),
  messageReference: z
    .object({
      messageId: z.string(),
    })
    .optional(),
  stickerIds: z.array(z.string()).max(3).optional(),
});

export const updateMessageSchema = z.object({
  content: z.string().min(0).max(4000),
});

export const getMessagesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().optional(),
  after: z.string().optional(),
  around: z.string().optional(),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type UpdateMessageInput = z.infer<typeof updateMessageSchema>;
