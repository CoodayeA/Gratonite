import React, { useState } from 'react';
import { getInitials } from '@/lib/utils';

interface GuildIconProps {
  name: string;
  iconHash?: string | null;
  guildId?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function GuildIcon({ name, iconHash, guildId, size = 48, className = '', style }: GuildIconProps) {
  const [imgError, setImgError] = useState(false);
  const sizeStyle: React.CSSProperties = { width: size, height: size, fontSize: size * 0.35, ...style };

  if (iconHash && guildId && !imgError) {
    return (
      <img
        className={`guild-icon ${className}`}
        src={`/api/v1/files/${iconHash}`}
        alt={name}
        style={sizeStyle}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div className={`guild-icon guild-icon-fallback ${className}`} style={sizeStyle}>
      {getInitials(name)}
    </div>
  );
}
