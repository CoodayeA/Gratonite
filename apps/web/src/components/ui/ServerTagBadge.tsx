import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { readProfileEnhancementsPrefs } from '@/lib/profileEnhancements';

interface ServerTagBadgeProps {
  userId: string;
}

export function ServerTagBadge({ userId }: ServerTagBadgeProps) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const guilds = useGuildsStore((s) => s.guilds);
  const navigate = useNavigate();

  const guild = useMemo(() => {
    if (!currentUserId || currentUserId !== userId) return null;
    const prefs = readProfileEnhancementsPrefs(currentUserId);
    if (!prefs.serverTagGuildId) return null;
    return guilds.get(prefs.serverTagGuildId) ?? null;
  }, [currentUserId, guilds, userId]);

  if (!guild) return null;

  return (
    <button
      type="button"
      className="server-tag-badge"
      onClick={(e) => {
        e.stopPropagation();
        navigate(`/guild/${guild.id}`);
      }}
      title={`Open ${guild.name}`}
    >
      {guild.name}
    </button>
  );
}
