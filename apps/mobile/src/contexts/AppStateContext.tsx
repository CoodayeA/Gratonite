import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { guilds as guildsApi, relationships as relApi, notifications as notifApi, readState as readStateApi } from '../lib/api';
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

  // Load initial data when user is available
  useEffect(() => {
    if (!user) return;
    refreshGuilds();
    refreshDMs();
    refreshNotificationCount();

    // Load read states
    readStateApi.getAll().then((states) => {
      for (const rs of states) {
        unreadStore.setReadState(rs.channelId, rs.lastReadMessageId, rs.mentionCount);
      }
    }).catch(() => {});
  }, [user, refreshGuilds, refreshDMs, refreshNotificationCount]);

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
        if (data.authorId !== user.id) {
          const isMention = data.content?.includes(`@${user.username}`) || false;
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
