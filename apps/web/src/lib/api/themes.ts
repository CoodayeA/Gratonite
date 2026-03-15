/**
 * Themes domain: theme store API calls.
 */
import { apiFetch } from './_core';

export interface ThemeItem {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  vars: Record<string, string>;
  creatorId: string;
  isPublished: boolean;
  downloads: number;
  averageRating: number;
  createdAt: string;
  updatedAt: string;
}

export const themesApi = {
  browse: (params?: { q?: string; tag?: string }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.tag) qs.set('tag', params.tag);
    const query = qs.toString();
    return apiFetch<ThemeItem[]>(`/themes${query ? `?${query}` : ''}`);
  },
  get: (themeId: string) =>
    apiFetch<ThemeItem>(`/themes/${themeId}`),
  create: (data: { name: string; description?: string; tags?: string[]; vars: Record<string, string> }) =>
    apiFetch<ThemeItem>('/themes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (themeId: string, data: { name?: string; description?: string; tags?: string[]; vars?: Record<string, string> }) =>
    apiFetch<ThemeItem>(`/themes/${themeId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  publish: (themeId: string) =>
    apiFetch<void>(`/themes/${themeId}/publish`, { method: 'POST' }),
  delete: (themeId: string) =>
    apiFetch<void>(`/themes/${themeId}`, { method: 'DELETE' }),
  myThemes: () =>
    apiFetch<ThemeItem[]>('/users/@me/themes'),
  rate: (themeId: string, rating: number) =>
    apiFetch<{ averageRating: number; totalRatings: number }>(`/themes/${themeId}/rate`, {
      method: 'POST',
      body: JSON.stringify({ rating }),
    }),
  download: (themeId: string) =>
    apiFetch<ThemeItem>(`/themes/${themeId}/download`, { method: 'POST' }),
};
