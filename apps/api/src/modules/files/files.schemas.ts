import { z } from 'zod';

export const uploadFileSchema = z.object({
  purpose: z
    .enum(['upload', 'emoji', 'sticker', 'avatar', 'banner', 'server-icon'])
    .default('upload'),
  contextId: z.string().optional(), // guildId, userId, etc.
  description: z.string().max(1024).optional(), // alt text
  spoiler: z
    .string()
    .transform((v) => v === 'true')
    .or(z.boolean())
    .default(false),
});

export type UploadFileInput = z.infer<typeof uploadFileSchema>;
