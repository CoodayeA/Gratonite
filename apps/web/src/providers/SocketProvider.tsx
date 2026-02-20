import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { useChannelsStore } from '@/stores/channels.store';
import { useMessagesStore } from '@/stores/messages.store';
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket';
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

    return () => {
      disconnectSocket();
      connectedRef.current = false;
    };
  }, [isAuthenticated]);

  return <>{children}</>;
}
