import { useQuery } from '@tanstack/react-query';
import { api, getAccessToken } from '../../lib/api';
import { queryClient } from '../../lib/queryClient';

export const membersQueryKey = (guildId: string) => ['members', guildId] as const;

export function useMembersQuery(guildId: string | null | undefined) {
  return useQuery({
    queryKey: membersQueryKey(guildId!),
    queryFn: () => api.guilds.getMembers(guildId!, { limit: 100 }),
    enabled: !!guildId && !!getAccessToken(),
  });
}

export function invalidateMembers(guildId: string) {
  return queryClient.invalidateQueries({ queryKey: membersQueryKey(guildId) });
}
