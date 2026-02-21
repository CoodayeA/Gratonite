import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useEffect, useRef } from 'react';
import { useMembersStore } from '@/stores/members.store';

export function useGuildMembers(guildId: string | undefined) {
  const setGuildMembers = useMembersStore((s) => s.setGuildMembers);
  const lastUpdatedRef = useRef(0);

  const query = useQuery({
    queryKey: ['members', guildId],
    queryFn: () => api.guilds.getMembers(guildId!),
    enabled: !!guildId,
    staleTime: 60_000, // 1 minute
  });

  useEffect(() => {
    if (!query.data || !guildId) return;
    if (query.dataUpdatedAt === lastUpdatedRef.current) return;
    lastUpdatedRef.current = query.dataUpdatedAt;
    if (query.data && guildId) {
      setGuildMembers(guildId, query.data as any);
    }
  }, [query.data, query.dataUpdatedAt, guildId, setGuildMembers]);

  return query;
}
