import { useQuery } from '@tanstack/react-query';
import { api, getAccessToken } from '../../lib/api';
import { queryClient } from '../../lib/queryClient';

export const guildsQueryKey = ['guilds', '@me'] as const;

export function useGuildsQuery() {
  return useQuery({
    queryKey: guildsQueryKey,
    queryFn: () => api.guilds.getMine(),
    enabled: !!getAccessToken(),
  });
}

export function invalidateGuilds() {
  return queryClient.invalidateQueries({ queryKey: guildsQueryKey });
}
