import { create } from 'zustand';

// ── Types ────────────────────────────────────────────

export type PresenceStatus = 'online' | 'idle' | 'dnd' | 'invisible' | 'offline';

export interface Activity {
  name: string;
  type: number;
  details?: string;
  state?: string;
}

export interface ClientStatus {
  desktop?: string;
  mobile?: string;
  web?: string;
}

export interface PresenceEntry {
  userId: string;
  status: PresenceStatus;
  activities?: Activity[];
  clientStatus?: ClientStatus;
}

// ── Default ──────────────────────────────────────────

const DEFAULT_PRESENCE: Omit<PresenceEntry, 'userId'> = {
  status: 'offline',
  activities: [],
};

// ── State ────────────────────────────────────────────

interface PresenceState {
  /** All presences keyed by user ID */
  presences: Map<string, PresenceEntry>;

  // Actions
  setPresence: (userId: string, status: PresenceStatus, activities?: Activity[], clientStatus?: ClientStatus) => void;
  setPresences: (entries: PresenceEntry[]) => void;
  getPresence: (userId: string) => PresenceEntry;
  getStatus: (userId: string) => PresenceStatus;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  presences: new Map(),

  setPresence: (userId, status, activities, clientStatus) => {
    const { presences } = get();
    const next = new Map(presences);
    next.set(userId, {
      userId,
      status,
      activities: activities ?? [],
      clientStatus,
    });
    set({ presences: next });
  },

  setPresences: (entries) => {
    const { presences } = get();
    const next = new Map(presences);

    for (const entry of entries) {
      next.set(entry.userId, entry);
    }

    set({ presences: next });
  },

  getPresence: (userId) => {
    const entry = get().presences.get(userId);
    return entry ?? { userId, ...DEFAULT_PRESENCE };
  },

  getStatus: (userId) => {
    return get().presences.get(userId)?.status ?? 'offline';
  },
}));
