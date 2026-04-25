import React from 'react';
import type { HTMLAttributes } from 'react';

type StatusPillTone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent';

type StatusPillProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: StatusPillTone;
};

export function StatusPill({ tone = 'neutral', className = '', children, ...props }: StatusPillProps) {
  return (
    <span {...props} className={`gt-status-pill gt-status-pill--${tone} ${className}`.trim()}>
      {children}
    </span>
  );
}
