import { useState, useEffect, useRef, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';

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

/* ── Inline style objects ─────────────────────────────────── */

const styles = {
  container: {
    position: 'fixed',
    background: 'var(--bg-elevated)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--stroke)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    minWidth: 180,
    padding: '4px 0',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
  } as CSSProperties,
  item: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    fontSize: 13,
    color: 'var(--text)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    outline: 'none',
  } as CSSProperties,
  itemHover: {
    background: 'var(--bg-soft)',
  } as CSSProperties,
  itemDanger: {
    color: 'var(--danger)',
  } as CSSProperties,
  icon: {
    width: 16,
    height: 16,
    marginRight: 8,
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } as CSSProperties,
} as const;

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    const btns = menuRef.current?.querySelectorAll<HTMLButtonElement>('button');
    btns?.[0]?.focus();
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
      menuRef.current.querySelectorAll<HTMLButtonElement>('button'),
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
      ref={menuRef}
      style={{ ...styles.container, top: y, left: x }}
      role="menu"
      onKeyDown={handleMenuKeyDown}
    >
      {items.map((item, i) => (
        <button
          key={i}
          style={{
            ...styles.item,
            ...(item.danger ? styles.itemDanger : undefined),
            ...(hoveredIndex === i ? styles.itemHover : undefined),
          }}
          onClick={() => { item.onClick(); onClose(); }}
          onMouseEnter={() => setHoveredIndex(i)}
          onMouseLeave={() => setHoveredIndex(null)}
          role="menuitem"
        >
          {item.icon && <span style={styles.icon}>{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>
  );
}
