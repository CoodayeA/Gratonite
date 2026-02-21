import type { HTMLAttributes } from 'react';
import { getInitials } from '@/lib/utils';

interface AvatarProps extends HTMLAttributes<HTMLElement> {
  name: string;
  hash?: string | null;
  userId?: string;
  size?: number;
  className?: string;
}

export function Avatar({ name, hash, userId, size = 36, className = '', ...props }: AvatarProps) {
  const sizeStyle = { width: size, height: size, fontSize: size * 0.4 };

  if (hash && userId) {
    return (
      <img
        className={`avatar ${className}`}
        src={`/api/v1/files/${hash}`}
        alt={name}
        style={sizeStyle}
        {...props}
      />
    );
  }

  return (
    <div className={`avatar avatar-fallback ${className}`} style={sizeStyle} {...props}>
      {getInitials(name, 1)}
    </div>
  );
}
