import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useGuildsStore } from '@/stores/guilds.store';
import { useEffect, useRef } from 'react';

export function useGuilds() {
  const setGuilds = useGuildsStore((s) => s.setGuilds);
  const lastUpdatedRef = useRef(0);

  const query = useQuery({
    queryKey: ['guilds', '@me'],
    queryFn: () => api.guilds.getMine(),
  });

  // Sync server data into Zustand store
  useEffect(() => {
    if (!query.data) return;
    if (query.dataUpdatedAt === lastUpdatedRef.current) return;
    lastUpdatedRef.current = query.dataUpdatedAt;
    if (query.data) {
      setGuilds(query.data);
    }
  }, [query.data, query.dataUpdatedAt, setGuilds]);

  return query;
}
