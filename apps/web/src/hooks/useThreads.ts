import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Thread } from '@gratonite/types';

export function useThreads(channelId: string | undefined) {
  return useQuery({
    queryKey: ['threads', channelId],
    queryFn: () => api.threads.list(channelId!),
    enabled: !!channelId,
    initialData: [] as Thread[],
  });
}
