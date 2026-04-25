import React from 'react';
import type { ReactNode } from 'react';

type NavItemProps = {
  label: string;
  active?: boolean;
  icon?: ReactNode;
  meta?: ReactNode;
  onClick?: () => void;
};

export function NavItem({ label, active = false, icon, meta, onClick }: NavItemProps) {
  return (
    <button
      type="button"
      className="gt-nav-item"
      data-active={active ? 'true' : 'false'}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      {icon && <span className="gt-nav-item__icon" aria-hidden="true">{icon}</span>}
      <span className="gt-nav-item__label">{label}</span>
      {meta && <span className="gt-nav-item__meta">{meta}</span>}
    </button>
  );
}
