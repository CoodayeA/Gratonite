import type { HTMLAttributes } from 'react';
import { getInitials } from '@/lib/utils';
import type { PresenceStatus } from '@/stores/presence.store';

interface AvatarProps extends HTMLAttributes<HTMLElement> {
  name: string;
  hash?: string | null;
  decorationHash?: string | null;
  userId?: string;
  size?: number;
  className?: string;
  presenceStatus?: PresenceStatus;
}

export function Avatar({
  name,
  hash,
  decorationHash,
  userId,
  size = 36,
  className = '',
  presenceStatus,
  ...props
}: AvatarProps) {
  const sizeStyle = { width: size, height: size, fontSize: size * 0.4 };

  const avatarContent = hash && userId ? (
    <img
      className={`avatar ${decorationHash ? 'avatar-in-decorated' : className}`}
      src={`/api/v1/files/${hash}`}
      alt={name}
      style={decorationHash ? undefined : sizeStyle}
      {...(decorationHash ? {} : props)}
    />
  ) : (
    <div
      className={`avatar avatar-fallback ${decorationHash ? 'avatar-in-decorated' : className}`}
      style={decorationHash ? undefined : sizeStyle}
      {...(decorationHash ? {} : props)}
    >
      {getInitials(name, 1)}
    </div>
  );

  if (decorationHash) {
    return (
      <span
        className={`avatar-decorated ${className}`}
        style={sizeStyle}
        {...props}
      >
        {avatarContent}
        <img
          src={`/api/v1/files/${decorationHash}`}
          alt=""
          className="avatar-decoration-overlay"
          aria-hidden="true"
        />
        {presenceStatus && presenceStatus !== 'offline' && (
          <span className={`avatar-presence-badge presence-${presenceStatus}`} aria-hidden="true" />
        )}
      </span>
    );
  }
  if (presenceStatus && presenceStatus !== 'offline') {
    return (
      <span className="avatar-status-wrap" style={sizeStyle}>
        {avatarContent}
        <span className={`avatar-presence-badge presence-${presenceStatus}`} aria-hidden="true" />
      </span>
    );
  }
  return avatarContent;
}
