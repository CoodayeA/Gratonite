import { useEffect } from 'react';
import {
  onMessageCreate,
  onGuildUpdate,
  onGuildJoined,
  onGuildLeft,
  onGuildDelete,
  onChannelUpdate,
  onChannelDelete,
  onGuildMemberAdd,
  onGuildMemberRemove,
  onFriendAccepted,
  onFriendRemoved,
  onDmChannelCreate,
} from '../../lib/socket';
import { invalidateMessages } from './useMessagesQuery';
import { invalidateGuilds } from './useGuildsQuery';
import { invalidateChannels } from './useChannelsQuery';
import { invalidateMembers } from './useMembersQuery';
import { invalidateFriends } from './useFriendsQuery';
import { invalidateDmChannels } from './useDmChannelsQuery';

/**
 * Registers socket event listeners that invalidate React Query caches
 * when real-time events arrive. Mount once near the app root.
 */
export function useQuerySocketSync() {
  useEffect(() => {
    const unsubs = [
      onMessageCreate((data) => {
        invalidateMessages(data.channelId);
      }),
      onGuildUpdate(() => {
        invalidateGuilds();
      }),
      onGuildJoined(() => {
        invalidateGuilds();
      }),
      onGuildLeft(() => {
        invalidateGuilds();
      }),
      onGuildDelete(() => {
        invalidateGuilds();
      }),
      onChannelUpdate((data) => {
        invalidateChannels(data.guildId);
      }),
      onChannelDelete((data) => {
        invalidateChannels(data.guildId);
      }),
      onGuildMemberAdd((data) => {
        invalidateMembers(data.guildId);
      }),
      onGuildMemberRemove((data) => {
        invalidateMembers(data.guildId);
      }),
      onFriendAccepted(() => {
        invalidateFriends();
      }),
      onFriendRemoved(() => {
        invalidateFriends();
      }),
      onDmChannelCreate(() => {
        invalidateDmChannels();
      }),
    ];

    return () => unsubs.forEach((fn) => fn());
  }, []);
}
