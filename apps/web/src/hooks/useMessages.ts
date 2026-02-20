import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useMessagesStore } from '@/stores/messages.store';
import { useEffect } from 'react';
import type { Message } from '@gratonite/types';

const PAGE_SIZE = 50;

export function useMessages(channelId: string | undefined) {
  const setMessages = useMessagesStore((s) => s.setMessages);
  const prependMessages = useMessagesStore((s) => s.prependMessages);

  const query = useInfiniteQuery({
    queryKey: ['messages', channelId],
    queryFn: async ({ pageParam }) => {
      const messages = await api.messages.list(channelId!, {
        before: pageParam as string | undefined,
        limit: PAGE_SIZE,
      });
      // API returns newest-first (DESC) — reverse to oldest-first for display
      return messages.reverse();
    },
    getNextPageParam: (lastPage: Message[]) => {
      // If we got less than PAGE_SIZE messages, there are no more
      if (lastPage.length < PAGE_SIZE) return undefined;
      // After reversal, oldest message is first — use its ID as cursor for "before"
      return lastPage[0]?.id;
    },
    initialPageParam: undefined as string | undefined,
    enabled: !!channelId,
  });

  // Sync first page into store
  useEffect(() => {
    if (query.data && channelId) {
      const allPages = query.data.pages;
      if (allPages.length === 1) {
        // Initial load — set messages
        const messages = allPages[0]!;
        setMessages(channelId, messages, messages.length >= PAGE_SIZE);
      } else if (allPages.length > 1) {
        // Pagination — prepend oldest page
        const oldestPage = allPages[allPages.length - 1]!;
        prependMessages(channelId, oldestPage, oldestPage.length >= PAGE_SIZE);
      }
    }
  }, [query.data, channelId, setMessages, prependMessages]);

  return query;
}
