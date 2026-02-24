import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  icon?: React.ReactNode;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const firstItem = menuRef.current?.querySelector<HTMLButtonElement>('.context-menu-item');
    firstItem?.focus();
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Clamp to viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menuRef.current.style.left = `${window.innerWidth - rect.width - 8}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menuRef.current.style.top = `${window.innerHeight - rect.height - 8}px`;
    }
  }, [x, y]);

  function handleMenuKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (!menuRef.current) return;
    const elements = Array.from(
      menuRef.current.querySelectorAll<HTMLButtonElement>('.context-menu-item'),
    );
    if (elements.length === 0) return;

    const activeIndex = Math.max(0, elements.findIndex((item) => item === document.activeElement));

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      elements[(activeIndex + 1) % elements.length]?.focus();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      elements[(activeIndex - 1 + elements.length) % elements.length]?.focus();
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      elements[0]?.focus();
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      elements[elements.length - 1]?.focus();
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      elements[activeIndex]?.click();
    }
  }

  return (
    <div
      className="context-menu"
      ref={menuRef}
      style={{ top: y, left: x }}
      role="menu"
      onKeyDown={handleMenuKeyDown}
    >
      {items.map((item, i) => (
        <button
          key={i}
          className={`context-menu-item ${item.danger ? 'context-menu-item-danger' : ''}`}
          onClick={() => { item.onClick(); onClose(); }}
          role="menuitem"
        >
          {item.icon && <span className="context-menu-icon">{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>
  );
}
