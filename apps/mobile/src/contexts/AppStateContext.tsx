import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AppState as RNAppState } from 'react-native';
import { guilds as guildsApi, relationships as relApi, notifications as notifApi, readState as readStateApi, users as usersApi } from '../lib/api';
import {
  onPresenceUpdate,
  onNotificationCreate,
  onMessageCreate,
  onReadStateUpdate,
} from '../lib/socket';
import { presenceStore } from '../lib/presenceStore';
import { unreadStore } from '../lib/unreadStore';
import { useAuth } from './AuthContext';
import type { Guild, DMChannel } from '../types';

interface AppStateContextType {
  guilds: Guild[];
  dmChannels: DMChannel[];
  notificationCount: number;
  refreshGuilds: () => Promise<void>;
  refreshDMs: () => Promise<void>;
  refreshNotificationCount: () => Promise<void>;
}

const AppStateContext = createContext<AppStateContextType | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userRef = React.useRef(user);
  userRef.current = user;
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [dmChannels, setDmChannels] = useState<DMChannel[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);

  const refreshGuilds = useCallback(async () => {
    try {
      const data = await guildsApi.getMine();
      setGuilds(data);
    } catch {
      // ignore
    }
  }, []);

  const refreshDMs = useCallback(async () => {
    try {
      const data = await relApi.getDMChannels();
      setDmChannels(data);
    } catch {
      // ignore
    }
  }, []);

  const refreshNotificationCount = useCallback(async () => {
    try {
      const res = await notifApi.unreadCount();
      setNotificationCount(res.count);
    } catch {
      // ignore
    }
  }, []);

  // Fetch real presence statuses for friends from the API
  const refreshPresences = useCallback(async () => {
    try {
      const rels = await relApi.getAll();
      const friendIds = rels
        .filter((r) => r.type === 'friend' && r.user?.id)
        .map((r) => r.user!.id);
      if (friendIds.length === 0) return;
      // Treat missing users in the API response as offline so stale "online"
      // dots don't stick around when a friend disconnects.
      presenceStore.setBulk(friendIds.map((userId) => ({ userId, status: 'offline' })));
      // API caps at 200 per call
      for (let i = 0; i < friendIds.length; i += 200) {
        const batch = friendIds.slice(i, i + 200);
        const presences = await usersApi.getPresences(batch);
        presenceStore.setBulk(
          presences.map((p) => ({ userId: p.userId, status: p.status as any })),
        );
      }
    } catch {
      // ignore — presence is best-effort
    }
  }, []);

  // Load initial data when user is available
  useEffect(() => {
    if (!user) return;
    refreshGuilds();
    refreshDMs();
    refreshNotificationCount();
    refreshPresences();

    // Load read states
    readStateApi.getAll().then((states) => {
      for (const rs of states) {
        unreadStore.setReadState(rs.channelId, rs.lastReadMessageId, rs.mentionCount);
      }
    }).catch(() => {});
  }, [user, refreshGuilds, refreshDMs, refreshNotificationCount, refreshPresences]);

  // Re-fetch presences when the app returns to foreground
  useEffect(() => {
    if (!user) return;
    const sub = RNAppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refreshPresences();
      }
    });
    return () => sub.remove();
  }, [user, refreshPresences]);

  // Socket subscriptions
  useEffect(() => {
    if (!user) return;

    const unsubs = [
      onPresenceUpdate((data) => {
        presenceStore.set(data.userId, data.status as any);
      }),
      onNotificationCreate(() => {
        setNotificationCount((c) => c + 1);
      }),
      onMessageCreate((data: any) => {
        const currentUser = userRef.current;
        if (currentUser && data.authorId !== currentUser.id) {
          const isMention = data.content?.includes(`@${currentUser.username}`) || false;
          unreadStore.incrementUnread(data.channelId, isMention);
        }
      }),
      onReadStateUpdate((data) => {
        unreadStore.markRead(data.channelId, data.lastReadMessageId);
      }),
    ];

    return () => unsubs.forEach((u) => u());
  }, [user]);

  return (
    <AppStateContext.Provider
      value={{ guilds, dmChannels, notificationCount, refreshGuilds, refreshDMs, refreshNotificationCount }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppStateContextType {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
