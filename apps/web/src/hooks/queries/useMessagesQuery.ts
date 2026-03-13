import { useInfiniteQuery } from '@tanstack/react-query';
import { api, getAccessToken } from '../../lib/api';
import { queryClient } from '../../lib/queryClient';

export const messagesQueryKey = (channelId: string) => ['messages', channelId] as const;

export function useMessagesQuery(channelId: string | null | undefined) {
  return useInfiniteQuery({
    queryKey: messagesQueryKey(channelId!),
    queryFn: ({ pageParam }) =>
      api.messages.list(channelId!, {
        limit: 50,
        ...(pageParam ? { before: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < 50) return undefined;
      // API returns newest-first, so the last element is the oldest
      return lastPage[lastPage.length - 1]?.id;
    },
    enabled: !!channelId && !!getAccessToken(),
  });
}

export function invalidateMessages(channelId: string) {
  return queryClient.invalidateQueries({ queryKey: messagesQueryKey(channelId) });
}
