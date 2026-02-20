import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useGuildMembers(guildId: string | undefined) {
  return useQuery({
    queryKey: ['members', guildId],
    queryFn: () => api.guilds.getMembers(guildId!),
    enabled: !!guildId,
    staleTime: 60_000, // 1 minute
  });
}
