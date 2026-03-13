import { useRef, useCallback } from 'react';
import { queryClient } from '../lib/queryClient';
import { api } from '../lib/api';
import { messagesQueryKey } from './queries/useMessagesQuery';
import { userQueryKey } from './queries/useUserQuery';

const PREFETCH_DELAY = 200;

/**
 * Returns onMouseEnter/onMouseLeave handlers that prefetch
 * a channel's messages after a 200ms hover delay.
 */
export function usePrefetchChannel(channelId: string | null | undefined) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onMouseEnter = useCallback(() => {
    if (!channelId) return;
    timerRef.current = setTimeout(() => {
      queryClient.prefetchQuery({
        queryKey: messagesQueryKey(channelId),
        queryFn: () => api.messages.list(channelId, { limit: 50 }),
        staleTime: 30_000,
      });
    }, PREFETCH_DELAY);
  }, [channelId]);

  const onMouseLeave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return { onMouseEnter, onMouseLeave };
}

/**
 * Returns onMouseEnter/onMouseLeave handlers that prefetch
 * a user's profile after a 200ms hover delay.
 */
export function usePrefetchUser(userId: string | null | undefined) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onMouseEnter = useCallback(() => {
    if (!userId) return;
    timerRef.current = setTimeout(() => {
      queryClient.prefetchQuery({
        queryKey: userQueryKey(userId),
        queryFn: () => api.users.get(userId),
        staleTime: 60_000,
      });
    }, PREFETCH_DELAY);
  }, [userId]);

  const onMouseLeave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return { onMouseEnter, onMouseLeave };
}
