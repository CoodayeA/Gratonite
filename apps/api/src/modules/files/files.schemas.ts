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
  // Voice message fields (only for purpose='upload' with audio content)
  isVoiceMessage: z
    .string()
    .transform((v) => v === 'true')
    .or(z.boolean())
    .default(false),
  durationSecs: z.coerce.number().int().min(0).max(600).optional(), // max 10 minutes
  waveform: z.string().max(4096).optional(), // base64 encoded waveform data
});

export type UploadFileInput = z.infer<typeof uploadFileSchema>;
