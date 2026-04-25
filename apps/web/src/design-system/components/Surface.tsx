import React from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

type SurfaceVariant = 'panel' | 'raised' | 'inset' | 'interactive';

type SurfaceProps = HTMLAttributes<HTMLDivElement> & {
  variant?: SurfaceVariant;
  children: ReactNode;
};

export function Surface({ variant = 'panel', className = '', children, ...props }: SurfaceProps) {
  const role = props['aria-label'] || props['aria-labelledby'] ? 'region' : props.role;
  return (
    <div {...props} role={role} className={`gt-surface gt-surface--${variant} ${className}`.trim()}>
      {children}
    </div>
  );
}
