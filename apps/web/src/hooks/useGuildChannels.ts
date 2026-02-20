import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useChannelsStore } from '@/stores/channels.store';
import { useEffect } from 'react';

export function useGuildChannels(guildId: string | undefined) {
  const setGuildChannels = useChannelsStore((s) => s.setGuildChannels);

  const query = useQuery({
    queryKey: ['channels', guildId],
    queryFn: () => api.channels.getGuildChannels(guildId!),
    enabled: !!guildId,
  });

  useEffect(() => {
    if (query.data && guildId) {
      setGuildChannels(guildId, query.data);
    }
  }, [query.data, guildId, setGuildChannels]);

  return query;
}
