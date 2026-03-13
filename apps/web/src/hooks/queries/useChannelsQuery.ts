import { useQuery } from '@tanstack/react-query';
import { api, getAccessToken } from '../../lib/api';
import { queryClient } from '../../lib/queryClient';

export const channelsQueryKey = (guildId: string) => ['channels', guildId] as const;

export function useChannelsQuery(guildId: string | null | undefined) {
  return useQuery({
    queryKey: channelsQueryKey(guildId!),
    queryFn: () => api.channels.getGuildChannels(guildId!),
    enabled: !!guildId && !!getAccessToken(),
  });
}

export function invalidateChannels(guildId: string) {
  return queryClient.invalidateQueries({ queryKey: channelsQueryKey(guildId) });
}
