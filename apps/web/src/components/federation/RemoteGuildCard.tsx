/**
 * RemoteGuildCard — Card for Discover page showing a federated guild.
 */

import { Users, Star, Globe, Shield } from 'lucide-react';
import FederationBadge from './FederationBadge';

interface Props {
  guild: {
    id: string;
    name: string;
    description: string | null;
    iconUrl: string | null;
    bannerUrl: string | null;
    memberCount: number;
    category: string | null;
    tags: string[];
    averageRating: number | null;
    totalRatings: number | null;
    instance: {
      baseUrl: string;
      trustLevel: string;
      trustScore: number | null;
    };
  };
  onClick?: () => void;
}

export default function RemoteGuildCard({ guild, onClick }: Props) {
  const domain = new URL(guild.instance.baseUrl).hostname;
  const trustLevel = guild.instance.trustLevel as 'verified' | 'manually_trusted' | 'auto_discovered';

  return (
    <button
      onClick={onClick}
      className="group w-full text-left rounded-xl overflow-hidden transition-all hover:scale-[1.02] hover:shadow-lg"
      style={{ background: 'var(--color-card, #1e1e2e)', border: '1px solid var(--color-border, #2e2e3e)' }}
    >
      {/* Banner */}
      <div className="h-24 relative" style={{ background: guild.bannerUrl ? `url(${guild.bannerUrl}) center/cover` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        {guild.averageRating != null && guild.averageRating > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: 'rgba(0,0,0,0.6)', color: '#fbbf24' }}>
            <Star size={12} fill="#fbbf24" />
            {guild.averageRating.toFixed(1)}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 pt-3">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-lg font-bold" style={{ background: 'var(--color-primary-alpha, rgba(99,102,241,0.15))', color: 'var(--color-primary, #6366f1)' }}>
            {guild.iconUrl ? (
              <img src={guild.iconUrl} alt="" className="w-full h-full rounded-lg object-cover" />
            ) : (
              guild.name.charAt(0).toUpperCase()
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-bold truncate" style={{ color: 'var(--color-text, #e2e8f0)' }}>
              {guild.name}
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <FederationBadge domain={domain} trustLevel={trustLevel} size="sm" />
              <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>
                <Users size={12} />
                {guild.memberCount.toLocaleString()}
              </span>
              {guild.category && (
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--color-primary-alpha, rgba(99,102,241,0.1))', color: 'var(--color-primary, #6366f1)' }}>
                  {guild.category}
                </span>
              )}
            </div>
          </div>
        </div>

        {guild.description && (
          <p className="text-xs mt-2 line-clamp-2" style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>
            {guild.description}
          </p>
        )}

        {guild.tags.length > 0 && (
          <div className="flex gap-1 mt-2 flex-wrap">
            {guild.tags.slice(0, 4).map(tag => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-border, #2e2e3e)', color: 'var(--color-text-secondary, #94a3b8)' }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
