import type { PresenceStatus } from '@/stores/presence.store';

const STORAGE_KEY = 'gratonite_presence_status_pref';
const EVENT_NAME = 'gratonite:presence-pref-change';

export type PresencePreference = Exclude<PresenceStatus, 'offline'>;

export function readPresencePreference(): PresencePreference {
  if (typeof window === 'undefined') return 'online';
  const value = window.localStorage.getItem(STORAGE_KEY);
  if (value === 'idle' || value === 'dnd' || value === 'online' || value === 'invisible') return value;
  return 'online';
}

export function savePresencePreference(status: PresencePreference): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, status);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: status }));
}

export function subscribePresencePreference(listener: (status: PresencePreference) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<PresencePreference>).detail;
    if (detail === 'online' || detail === 'idle' || detail === 'dnd' || detail === 'invisible') listener(detail);
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
