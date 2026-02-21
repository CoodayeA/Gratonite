import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function usePinnedMessages(channelId: string | undefined) {
  return useQuery({
    queryKey: ['pins', channelId],
    queryFn: () => api.messages.getPins(channelId!),
    enabled: !!channelId,
  });
}
