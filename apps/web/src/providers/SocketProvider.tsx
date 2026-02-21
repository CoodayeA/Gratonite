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

    // ---- Message events ----
    socket.on('MESSAGE_CREATE', (data: Message) => {
      useMessagesStore.getState().addMessage(data);
      const currentChannelId = useChannelsStore.getState().currentChannelId;
      if (data.channelId !== currentChannelId) {
        useUnreadStore.getState().markUnread(data.channelId);
        const currentUser = useAuthStore.getState().user;
        if (!currentUser || data.authorId === currentUser.id) return;
        const author = (data as Message & { author?: { displayName?: string } }).author;
        const title = author?.displayName ?? 'New message';
        const body = data.content ?? 'You received a new message.';

        // Build a route for click-to-navigate on desktop notifications
        const route = data.guildId
          ? `/guild/${data.guildId}/channel/${data.channelId}`
          : `/dm/${data.channelId}`;
        notifyDesktop({ title, body, route });

        // Play notification sound based on context
        const isDm = !data.guildId;
        const isMention = data.mentions?.includes(currentUser.id);
        if (isMention) {
          playSound('mention');
        } else if (isDm) {
          playSound('dm');
        } else {
          playSound('message');
        }
      } else {
        useUnreadStore.getState().markRead(data.channelId);
      }
    });

    socket.on('MESSAGE_UPDATE', (data: Message) => {
      useMessagesStore.getState().updateMessage(data.channelId, data.id, data);
    });

    socket.on('MESSAGE_DELETE', (data: { id: string; channelId: string }) => {
      useMessagesStore.getState().removeMessage(data.channelId, data.id);
    });

    // ---- Typing events ----
    socket.on('TYPING_START', (data: { channelId: string; userId: string }) => {
      useMessagesStore.getState().setTyping(data.channelId, data.userId, Date.now());
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
    });

    socket.on('GUILD_UPDATE', (data: Guild) => {
      useGuildsStore.getState().updateGuild(data.id, data);
    });

    socket.on('GUILD_DELETE', (data: { id: string }) => {
      useGuildsStore.getState().removeGuild(data.id);
    });

    socket.on('GUILD_MEMBER_ADD', (data: { guildId: string }) => {
      // Could refresh member list — for MVP just note the event
      console.log('[Gateway] Member added to guild', data.guildId);
    });

    socket.on('GUILD_MEMBER_REMOVE', (data: { guildId: string; userId: string }) => {
      console.log('[Gateway] Member removed from guild', data.guildId);
    });

    // ---- DM Call events ----
    socket.on('CALL_INVITE', (data: { channelId: string; type: 'voice' | 'video'; fromUserId: string; fromDisplayName: string }) => {
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
      disconnectSocket();
      connectedRef.current = false;
    };
  }, [isAuthenticated]);

  return <>{children}</>;
}
