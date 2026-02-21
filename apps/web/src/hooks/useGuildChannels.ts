import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useChannelsStore } from '@/stores/channels.store';
import { useEffect, useRef } from 'react';

export function useGuildChannels(guildId: string | undefined) {
  const setGuildChannels = useChannelsStore((s) => s.setGuildChannels);
  const lastUpdatedRef = useRef(0);

  const query = useQuery({
    queryKey: ['channels', guildId],
    queryFn: () => api.channels.getGuildChannels(guildId!),
    enabled: !!guildId,
  });

  useEffect(() => {
    if (!query.data || !guildId) return;
    if (query.dataUpdatedAt === lastUpdatedRef.current) return;
    lastUpdatedRef.current = query.dataUpdatedAt;
    if (query.data && guildId) {
      setGuildChannels(guildId, query.data);
    }
  }, [query.data, query.dataUpdatedAt, guildId, setGuildChannels]);

  return query;
}
