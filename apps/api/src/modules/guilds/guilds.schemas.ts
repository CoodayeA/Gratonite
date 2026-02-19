import { z } from 'zod';

export const createGuildSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(1000).optional(),
});

export const updateGuildSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(1000).nullable().optional(),
  preferredLocale: z.string().max(10).optional(),
  nsfwLevel: z.enum(['default', 'explicit', 'safe', 'age_restricted']).optional(),
  verificationLevel: z.enum(['none', 'low', 'medium', 'high', 'very_high']).optional(),
  explicitContentFilter: z
    .enum(['disabled', 'members_without_roles', 'all_members'])
    .optional(),
  defaultMessageNotifications: z.enum(['all_messages', 'only_mentions']).optional(),
  discoverable: z.boolean().optional(),
});

export const createRoleSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.number().int().min(0).max(0xffffff).optional(),
  hoist: z.boolean().optional(),
  mentionable: z.boolean().optional(),
  permissions: z.number().optional(),
});

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.number().int().min(0).max(0xffffff).optional(),
  hoist: z.boolean().optional(),
  mentionable: z.boolean().optional(),
  permissions: z.number().optional(),
  position: z.number().int().min(0).optional(),
});

export const reorderRolesSchema = z.object({
  roles: z.array(
    z.object({
      id: z.string(),
      position: z.number().int().min(0),
    }),
  ),
});

export type CreateGuildInput = z.infer<typeof createGuildSchema>;
export type UpdateGuildInput = z.infer<typeof updateGuildSchema>;
export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
