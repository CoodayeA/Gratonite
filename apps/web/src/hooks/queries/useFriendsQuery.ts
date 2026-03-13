import { useQuery } from '@tanstack/react-query';
import { api, getAccessToken } from '../../lib/api';
import { queryClient } from '../../lib/queryClient';

export const friendsQueryKey = ['friends'] as const;

export function useFriendsQuery() {
  return useQuery({
    queryKey: friendsQueryKey,
    queryFn: () => api.relationships.getAll(),
    enabled: !!getAccessToken(),
  });
}

export function invalidateFriends() {
  return queryClient.invalidateQueries({ queryKey: friendsQueryKey });
}
