import { getInitials } from '@/lib/utils';

interface GuildIconProps {
  name: string;
  iconHash?: string | null;
  guildId?: string;
  size?: number;
  className?: string;
}

export function GuildIcon({ name, iconHash, guildId, size = 48, className = '' }: GuildIconProps) {
  const sizeStyle = { width: size, height: size, fontSize: size * 0.35 };

  if (iconHash && guildId) {
    return (
      <img
        className={`guild-icon ${className}`}
        src={`/api/v1/files/${iconHash}`}
        alt={name}
        style={sizeStyle}
      />
    );
  }

  return (
    <div className={`guild-icon guild-icon-fallback ${className}`} style={sizeStyle}>
      {getInitials(name)}
    </div>
  );
}
