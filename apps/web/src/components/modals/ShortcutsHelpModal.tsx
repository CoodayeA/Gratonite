import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { groupShortcutsByCategory, formatShortcut } from '@/lib/keyboardShortcuts';

const styles = {
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
    padding: '8px 0 12px',
    maxHeight: '60vh',
    overflowY: 'auto',
  } as React.CSSProperties,
  category: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  } as React.CSSProperties,
  categoryTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: '0.7rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--text-tertiary)',
    paddingBottom: 4,
    borderBottom: '1px solid var(--stroke)',
  } as React.CSSProperties,
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  } as React.CSSProperties,
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 8px',
    borderRadius: 'var(--radius-sm)',
    transition: 'background 0.15s',
  } as React.CSSProperties,
  rowHover: {
    background: 'var(--bg-soft)',
  } as React.CSSProperties,
  label: {
    fontSize: '0.875rem',
    color: 'var(--text-muted)',
  } as React.CSSProperties,
  keys: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontFamily: 'var(--font-display)',
    fontSize: '0.75rem',
    fontWeight: 500,
    color: 'var(--text-primary)',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--stroke-strong)',
    borderRadius: 'var(--radius-sm)',
    padding: '3px 8px',
    minWidth: 24,
    textAlign: 'center',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
};

export function ShortcutsHelpModal() {
  const groups = groupShortcutsByCategory();
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);

  return (
    <Modal id="shortcuts-help" title="Keyboard Shortcuts" size="md">
      <div style={styles.content}>
        {Array.from(groups.entries()).map(([category, shortcuts]) => (
          <div key={category} style={styles.category}>
            <h3 style={styles.categoryTitle}>{category}</h3>
            <div style={styles.list}>
              {shortcuts.map((def) => (
                <div
                  key={def.action}
                  style={{
                    ...styles.row,
                    ...(hoveredAction === def.action ? styles.rowHover : {}),
                  }}
                  onMouseEnter={() => setHoveredAction(def.action)}
                  onMouseLeave={() => setHoveredAction(null)}
                >
                  <span style={styles.label}>{def.label}</span>
                  <kbd style={styles.keys}>{formatShortcut(def)}</kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
