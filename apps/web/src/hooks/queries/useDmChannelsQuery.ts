import { useQuery } from '@tanstack/react-query';
import { api, getAccessToken } from '../../lib/api';
import { queryClient } from '../../lib/queryClient';

export const dmChannelsQueryKey = ['dmChannels'] as const;

export function useDmChannelsQuery() {
  return useQuery({
    queryKey: dmChannelsQueryKey,
    queryFn: () => api.relationships.getDmChannels(),
    enabled: !!getAccessToken(),
  });
}

export function invalidateDmChannels() {
  return queryClient.invalidateQueries({ queryKey: dmChannelsQueryKey });
}
