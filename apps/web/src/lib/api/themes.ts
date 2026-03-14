/**
 * Themes domain: theme store API calls.
 */
import { apiFetch } from './_core';

export const themesApi = {
  browse: (params?: { q?: string; tag?: string }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.tag) qs.set('tag', params.tag);
    const query = qs.toString();
    return apiFetch<any[]>(`/themes${query ? `?${query}` : ''}`);
  },
  get: (themeId: string) =>
    apiFetch<any>(`/themes/${themeId}`),
  create: (data: { name: string; description?: string; tags?: string[]; vars: Record<string, string> }) =>
    apiFetch<any>('/themes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (themeId: string, data: { name?: string; description?: string; tags?: string[]; vars?: Record<string, string> }) =>
    apiFetch<any>(`/themes/${themeId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  publish: (themeId: string) =>
    apiFetch<void>(`/themes/${themeId}/publish`, { method: 'POST' }),
  delete: (themeId: string) =>
    apiFetch<void>(`/themes/${themeId}`, { method: 'DELETE' }),
  myThemes: () =>
    apiFetch<any[]>('/users/@me/themes'),
  rate: (themeId: string, rating: number) =>
    apiFetch<any>(`/themes/${themeId}/rate`, {
      method: 'POST',
      body: JSON.stringify({ rating }),
    }),
  download: (themeId: string) =>
    apiFetch<any>(`/themes/${themeId}/download`, { method: 'POST' }),
};
