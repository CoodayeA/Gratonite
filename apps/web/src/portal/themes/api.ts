/**
 * Portal theme network calls. Thin wrappers around apiFetch.
 */
import { apiFetch } from '../../lib/api';
import type { PortalTheme } from './types';

export interface ResolvedThemeResponse {
  guildDefault: PortalTheme | null;
  memberOverride: PortalTheme | null;
  isOwner: boolean;
}

export interface PortalThemePresetRow {
  id: string;
  guildId: string;
  name: string;
  theme: PortalTheme;
  createdBy: string | null;
  createdAt: string;
}

const base = (guildId: string) => `/api/v1/guilds/${guildId}/portal-theme`;

export const portalThemeApi = {
  fetchResolved: (guildId: string) =>
    apiFetch<ResolvedThemeResponse>(base(guildId)),

  saveGuildDefault: (guildId: string, theme: PortalTheme) =>
    apiFetch<{ theme: PortalTheme }>(`${base(guildId)}/default`, {
      method: 'PUT',
      body: JSON.stringify(theme),
    }),

  saveMemberOverride: (guildId: string, theme: PortalTheme) =>
    apiFetch<{ theme: PortalTheme }>(`${base(guildId)}/me`, {
      method: 'PUT',
      body: JSON.stringify(theme),
    }),

  clearMemberOverride: (guildId: string) =>
    apiFetch<void>(`${base(guildId)}/me`, { method: 'DELETE' }),

  listPresets: (guildId: string) =>
    apiFetch<{ presets: PortalThemePresetRow[] }>(`${base(guildId)}/presets`),

  savePreset: (guildId: string, name: string, theme: PortalTheme) =>
    apiFetch<{ preset: PortalThemePresetRow }>(`${base(guildId)}/presets`, {
      method: 'POST',
      body: JSON.stringify({ name, theme }),
    }),

  deletePreset: (guildId: string, presetId: string) =>
    apiFetch<void>(`${base(guildId)}/presets/${presetId}`, { method: 'DELETE' }),
};
