import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useGuildsStore } from '@/stores/guilds.store';
import { useEffect } from 'react';

export function useGuilds() {
  const setGuilds = useGuildsStore((s) => s.setGuilds);

  const query = useQuery({
    queryKey: ['guilds', '@me'],
    queryFn: () => api.guilds.getMine(),
  });

  // Sync server data into Zustand store
  useEffect(() => {
    if (query.data) {
      setGuilds(query.data);
    }
  }, [query.data, setGuilds]);

  return query;
}
