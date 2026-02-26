import { useEffect, useRef } from 'react';
import { useGuildsStore } from '@/stores/guilds.store';
import { useChannelsStore } from '@/stores/channels.store';
import { useMessagesStore } from '@/stores/messages.store';
import { useUnreadStore } from '@/stores/unread.store';
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket';
import { notifyDesktop } from '@/lib/desktop';
import { playSound, stopSound } from '../lib/audio';
import { clearRingTimeout } from '../lib/dmCall';
import { useCallStore } from '@/stores/call.store';
import { useAuthStore } from '@/stores/auth.store';
import { queryClient } from '@/lib/queryClient';
import { useVoiceStore } from '@/stores/voice.store';
import { usePresenceStore } from '@/stores/presence.store';
import { readPresencePreference } from '@/lib/presencePrefs';
import { getCachedSoundboardSound, playSoundboardClip } from '@/lib/soundboard';
import type { Message, Channel, Guild } from '@gratonite/types';

/**
 * SocketProvider — connects when authenticated, disconnects on logout.
 * Registers all gateway event handlers for real-time updates.
 */
export function SocketProvider({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const connectedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      if (connectedRef.current) {
        disconnectSocket();
        connectedRef.current = false;
      }
      return;
    }

    const socket = connectSocket();
    connectedRef.current = true;

    const getBlockedIds = () => {
      const raw = queryClient.getQueryData(['relationships']);
      const rels = Array.isArray(raw) ? raw as Array<{ targetId: string; type: string }> : [];
      return new Set(rels.filter((r) => r.type === 'blocked').map((r) => r.targetId));
    };

    // ---- Message events ----
    socket.on('MESSAGE_CREATE', (data: Message) => {
      const blockedIds = getBlockedIds();
      if (blockedIds.has(String(data.authorId))) return;
      useMessagesStore.getState().addMessage(data);
      useChannelsStore.getState().updateChannel(data.channelId, { lastMessageId: data.id });
      if (!data.guildId) {
        queryClient.invalidateQueries({ queryKey: ['relationships', 'dms'] });
      }
      const currentChannelId = useChannelsStore.getState().currentChannelId;
      const currentUser = useAuthStore.getState().user;
      if (!currentUser || data.authorId === currentUser.id) return;

      const author = (data as Message & { author?: { displayName?: string } }).author;
      const title = author?.displayName ?? 'New message';
      const body = data.content ?? 'You received a new message.';
      const route = data.guildId
        ? `/guild/${data.guildId}/channel/${data.channelId}`
        : `/dm/${data.channelId}`;
      const isDm = !data.guildId;
      const isMention = data.mentions?.includes(currentUser.id);
      const isCurrentChannel = data.channelId === currentChannelId;
      const isWindowHidden = typeof document !== 'undefined' && document.visibilityState !== 'visible';

      if (!isCurrentChannel || isMention) {
        if (isMention) {
          useUnreadStore.getState().markMention(data.channelId);
        } else {
          useUnreadStore.getState().markUnread(data.channelId);
        }
      }

      if (!isCurrentChannel) {
        notifyDesktop({ title, body, route });
      } else if (isMention && isWindowHidden) {
        // Mention in the current open channel should still notify when the tab/app is not visible.
        notifyDesktop({ title, body, route });
      }

      // Mentions always get mention sound. Otherwise standard channel/DM sounds only when not actively viewing.
      if (isMention) {
        playSound('mention');
      } else if (!isCurrentChannel) {
        if (isDm) {
          playSound('dm');
        } else {
          playSound('message');
        }
      }

      if (isCurrentChannel && !isMention) {
        useUnreadStore.getState().markRead(data.channelId);
      } else {
        // Keep unread until the user actually reads the mentioned/off-channel message.
      }
    });

    socket.on('MESSAGE_UPDATE', (data: Message) => {
      useMessagesStore.getState().updateMessage(data.channelId, data.id, data);
    });

    socket.on('MESSAGE_DELETE', (data: { id: string; channelId: string }) => {
      useMessagesStore.getState().removeMessage(data.channelId, data.id);
    });

    socket.on('MESSAGE_REACTION_ADD', (data: { channelId: string; messageId: string; emoji: { name: string } | string; userId: string }) => {
      const emojiName = typeof data.emoji === 'string' ? data.emoji : data.emoji.name;
      useMessagesStore.getState().addReaction(data.channelId, data.messageId, emojiName, data.userId);
    });

    socket.on('MESSAGE_REACTION_REMOVE', (data: { channelId: string; messageId: string; emoji: { name: string } | string; userId: string }) => {
      const emojiName = typeof data.emoji === 'string' ? data.emoji : data.emoji.name;
      useMessagesStore.getState().removeReaction(data.channelId, data.messageId, emojiName, data.userId);
    });

    socket.on('THREAD_CREATE', (data: { parentId?: string }) => {
      if (data.parentId) {
        queryClient.invalidateQueries({ queryKey: ['threads', data.parentId] });
      }
    });

    socket.on('THREAD_UPDATE', (data: { parentId?: string }) => {
      if (data.parentId) {
        queryClient.invalidateQueries({ queryKey: ['threads', data.parentId] });
      }
    });

    socket.on('THREAD_DELETE', (data: { parentId?: string }) => {
      if (data.parentId) {
        queryClient.invalidateQueries({ queryKey: ['threads', data.parentId] });
      }
    });

    // ---- Typing events ----
    socket.on('TYPING_START', (data: { channelId: string; userId: string }) => {
      const blockedIds = getBlockedIds();
      if (blockedIds.has(String(data.userId))) return;
      useMessagesStore.getState().setTyping(data.channelId, data.userId, Date.now());
    });

    socket.on('READY', () => {
      const preferredStatus = readPresencePreference();
      socket.emit('PRESENCE_UPDATE', { status: preferredStatus });
      const currentUser = useAuthStore.getState().user;
      if (currentUser?.id) {
        usePresenceStore.getState().upsert({ userId: currentUser.id, status: preferredStatus });
      }

      // Re-subscribe state on initial connect / reconnect. Some page effects emit before
      // the socket is connected, and guild subscriptions are intentionally guarded by
      // socket.connected checks in page-level code.
      const currentGuildId = useGuildsStore.getState().currentGuildId;
      if (currentGuildId) {
        socket.emit('GUILD_SUBSCRIBE', { guildId: currentGuildId });
      }

      const { currentChannelId, channels } = useChannelsStore.getState();
      if (currentChannelId) {
        socket.emit('CHANNEL_SUBSCRIBE', { channelId: currentChannelId });
      }

      // Keep DM realtime and DM list updates resilient across reconnects.
      for (const channel of channels.values()) {
        if (channel.type === 'DM' || channel.type === 'GROUP_DM') {
          socket.emit('CHANNEL_SUBSCRIBE', { channelId: channel.id });
        }
      }
    });

    socket.on('PRESENCE_UPDATE', (data: { userId: string; status: 'online' | 'idle' | 'dnd' | 'offline' }) => {
      if (!data?.userId) return;
      usePresenceStore.getState().upsert({
        userId: data.userId,
        status: data.status,
      });
    });

    socket.on('VOICE_STATE_UPDATE', (data: any) => {
      useVoiceStore.getState().updateVoiceState(data);
    });

    socket.on('SOUNDBOARD_PLAY', (data: { guildId: string; channelId: string; soundId: string; userId: string; volume: number }) => {
      const blockedIds = getBlockedIds();
      if (blockedIds.has(String(data.userId))) return;
      const call = useCallStore.getState();
      if (call.status !== 'connected' || call.mode !== 'guild' || call.channelId !== String(data.channelId)) return;
      const sound = getCachedSoundboardSound(String(data.guildId), String(data.soundId));
      if (!sound) return;
      playSoundboardClip(sound, { volumeScale: data.volume ?? 1 });
    });

    // ---- Channel events ----
    socket.on('CHANNEL_CREATE', (data: Channel) => {
      useChannelsStore.getState().addChannel(data);
    });

    socket.on('CHANNEL_UPDATE', (data: Channel) => {
      useChannelsStore.getState().updateChannel(data.id, data);
    });

    socket.on('CHANNEL_DELETE', (data: { id: string }) => {
      useChannelsStore.getState().removeChannel(data.id);
      useUnreadStore.getState().markRead(data.id);
    });

    // ---- Guild events ----
    socket.on('GUILD_CREATE', (data: Guild) => {
      useGuildsStore.getState().addGuild(data);
      socket.emit('GUILD_SUBSCRIBE', { guildId: data.id });
    });

    socket.on('GUILD_UPDATE', (data: Guild) => {
      useGuildsStore.getState().updateGuild(data.id, data);
    });

    socket.on('GUILD_DELETE', (data: { id: string }) => {
      useGuildsStore.getState().removeGuild(data.id);
    });

    socket.on('USER_UPDATE', () => {
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
      queryClient.invalidateQueries({ queryKey: ['relationships', 'dms'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'summaries'] });
    });

    socket.on('GUILD_MEMBER_ADD', (data: { guildId: string; userId?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['members', data.guildId] });
      const currentUser = useAuthStore.getState().user;
      if (currentUser?.id && data.userId === currentUser.id) {
        socket.emit('GUILD_SUBSCRIBE', { guildId: data.guildId });
        queryClient.invalidateQueries({ queryKey: ['guilds', '@me'] });
      }
    });

    socket.on('GUILD_MEMBER_REMOVE', (data: { guildId: string; userId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['members', data.guildId] });
      const currentUser = useAuthStore.getState().user;
      if (currentUser?.id && data.userId === currentUser.id) {
        socket.emit('GUILD_UNSUBSCRIBE', { guildId: data.guildId });
        queryClient.invalidateQueries({ queryKey: ['guilds', '@me'] });
      }
    });

    // ---- DM Call events ----
    socket.on('CALL_INVITE', (data: { channelId: string; type: 'voice' | 'video'; fromUserId: string; fromDisplayName: string }) => {
      const blockedIds = getBlockedIds();
      if (blockedIds.has(String(data.fromUserId))) {
        socket.emit('CALL_DECLINE', { channelId: data.channelId, toUserId: data.fromUserId });
        return;
      }
      const callState = useCallStore.getState();
      if (callState.status !== 'idle') {
        socket.emit('CALL_DECLINE', { channelId: data.channelId, toUserId: data.fromUserId });
        return;
      }

      useCallStore.getState().setState({
        incomingCall: {
          channelId: data.channelId,
          fromUserId: data.fromUserId,
          fromDisplayName: data.fromDisplayName,
          type: data.type,
        },
      });
      notifyDesktop({
        title: `${data.fromDisplayName} is calling`,
        body: data.type === 'video' ? 'Incoming video call' : 'Incoming voice call',
      });

      playSound('ringtone');

      // Auto-decline after 30s
      const incomingTimeout = setTimeout(() => {
        const st = useCallStore.getState();
        if (st.incomingCall?.channelId === data.channelId) {
          stopSound('ringtone');
          st.setState({ incomingCall: null });
          socket.emit('CALL_DECLINE', { channelId: data.channelId, toUserId: data.fromUserId });
        }
      }, 30000);
      // Store for cleanup
      (window as any).__incomingCallTimeout = incomingTimeout;
    });

    socket.on('CALL_ACCEPT', (data: { channelId: string; fromUserId: string }) => {
      const outgoing = useCallStore.getState().outgoingCall;
      if (outgoing?.channelId === data.channelId) {
        useCallStore.getState().setState({
          outgoingCall: { ...outgoing, status: 'accepted' },
        });
        stopSound('outgoing-ring');
        clearRingTimeout();
        playSound('call-connect');
      }
    });

    socket.on('CALL_DECLINE', (data: { channelId: string; fromUserId: string }) => {
      const outgoing = useCallStore.getState().outgoingCall;
      if (outgoing?.channelId === data.channelId) {
        useCallStore.getState().setState({
          outgoingCall: { ...outgoing, status: 'declined' },
        });
        stopSound('outgoing-ring');
        clearRingTimeout();
      }
    });

    socket.on('CALL_CANCEL', (data: { channelId: string; fromUserId: string }) => {
      const incoming = useCallStore.getState().incomingCall;
      if (incoming?.channelId === data.channelId) {
        useCallStore.getState().setState({ incomingCall: null });
        stopSound('ringtone');
        clearTimeout((window as any).__incomingCallTimeout);
      }
    });

    return () => {
      usePresenceStore.getState().clear();
      disconnectSocket();
      connectedRef.current = false;
    };
  }, [isAuthenticated]);

  return <>{children}</>;
}
