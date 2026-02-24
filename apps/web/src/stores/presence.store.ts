import { create } from 'zustand';

export type PresenceStatus = 'online' | 'idle' | 'dnd' | 'invisible' | 'offline';

export interface PresenceEntry {
  userId: string;
  status: PresenceStatus;
  lastSeen?: number | null;
}

interface PresenceState {
  byUserId: Map<string, PresenceEntry>;
  setMany: (entries: PresenceEntry[]) => void;
  upsert: (entry: PresenceEntry) => void;
  clear: () => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  byUserId: new Map(),

  setMany: (entries) =>
    set((state) => {
      const next = new Map(state.byUserId);
      for (const entry of entries) next.set(entry.userId, entry);
      return { byUserId: next };
    }),

  upsert: (entry) =>
    set((state) => {
      const next = new Map(state.byUserId);
      next.set(entry.userId, entry);
      return { byUserId: next };
    }),

  clear: () => set({ byUserId: new Map() }),
}));
