import { useQuery } from '@tanstack/react-query';
import { api, getAccessToken } from '../../lib/api';
import { queryClient } from '../../lib/queryClient';

export const userQueryKey = (userId?: string) =>
  userId ? ['user', userId] : (['user', '@me'] as const);

export function useUserQuery(userId?: string) {
  return useQuery({
    queryKey: userQueryKey(userId),
    queryFn: (() => (userId ? api.users.get(userId) : api.users.getMe())) as any,
    enabled: !!getAccessToken(),
  });
}

export function invalidateUser(userId?: string) {
  return queryClient.invalidateQueries({ queryKey: userQueryKey(userId) });
}
