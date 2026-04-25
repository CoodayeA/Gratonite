import React from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  loading?: boolean;
};

export function Button({
  variant = 'secondary',
  size = 'md',
  leadingIcon,
  trailingIcon,
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`gt-button gt-button--${variant} gt-button--${size} ${className}`.trim()}
      data-loading={loading ? 'true' : 'false'}
    >
      {leadingIcon && <span className="gt-button__icon" aria-hidden="true">{leadingIcon}</span>}
      <span className="gt-button__label">{loading ? 'Loading…' : children}</span>
      {trailingIcon && <span className="gt-button__icon" aria-hidden="true">{trailingIcon}</span>}
    </button>
  );
}
