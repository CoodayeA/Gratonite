import React, { useState } from 'react';
import { api } from '../../lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ButtonComponent {
  type: 'button';
  style: 'primary' | 'secondary' | 'success' | 'danger' | 'link';
  label: string;
  customId?: string;
  url?: string;
  disabled?: boolean;
  emoji?: string;
}

interface SelectOption {
  label: string;
  value: string;
  description?: string;
  emoji?: string;
  default?: boolean;
}

interface SelectMenuComponent {
  type: 'select_menu';
  customId: string;
  placeholder?: string;
  options: SelectOption[];
  minValues?: number;
  maxValues?: number;
  disabled?: boolean;
}

interface ActionRow {
  type: 'action_row';
  components: (ButtonComponent | SelectMenuComponent)[];
}

interface Props {
  components: ActionRow[];
  channelId: string;
  messageId: string;
}

// ---------------------------------------------------------------------------
// Button styles
// ---------------------------------------------------------------------------

const BUTTON_STYLES: Record<string, React.CSSProperties> = {
  primary: {
    background: 'var(--accent-primary)', color: '#000', border: 'none',
  },
  secondary: {
    background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--stroke)',
  },
  success: {
    background: '#23a55a', color: '#fff', border: 'none',
  },
  danger: {
    background: '#da373c', color: '#fff', border: 'none',
  },
  link: {
    background: 'transparent', color: 'var(--accent-primary)', border: '1px solid var(--stroke)',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MessageComponents({ components, channelId, messageId }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  if (!components || components.length === 0) return null;

  const handleButtonClick = async (button: ButtonComponent) => {
    if (button.style === 'link' && button.url) {
      window.open(button.url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!button.customId || button.disabled) return;

    setLoading(button.customId);
    try {
      await api.post(`/channels/${channelId}/messages/${messageId}/components/${encodeURIComponent(button.customId)}/interactions`, {});
    } catch (err) {
      // interaction failed — silently handled
    } finally {
      setLoading(null);
    }
  };

  const handleSelectChange = async (customId: string, values: string[]) => {
    setLoading(customId);
    try {
      await api.post(`/channels/${channelId}/messages/${messageId}/components/${encodeURIComponent(customId)}/interactions`, { values });
    } catch (err) {
      // interaction failed — silently handled
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
      {components.slice(0, 5).map((row, rowIdx) => {
        if (row.type !== 'action_row') return null;
        return (
          <div key={rowIdx} style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {row.components.slice(0, 5).map((comp, compIdx) => {
              if (comp.type === 'button') {
                const btn = comp as ButtonComponent;
                const style = BUTTON_STYLES[btn.style] || BUTTON_STYLES.secondary;
                const isLoading = loading === btn.customId;
                return (
                  <button
                    key={compIdx}
                    onClick={() => handleButtonClick(btn)}
                    disabled={btn.disabled || isLoading}
                    style={{
                      ...style,
                      padding: '6px 16px',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: btn.disabled ? 'not-allowed' : 'pointer',
                      opacity: btn.disabled ? 0.5 : isLoading ? 0.7 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'opacity 0.15s',
                      minHeight: '32px',
                    }}
                  >
                    {btn.emoji && <span>{btn.emoji}</span>}
                    {btn.label}
                    {btn.style === 'link' && <span style={{ fontSize: '12px' }}>↗</span>}
                  </button>
                );
              }

              if (comp.type === 'select_menu') {
                const select = comp as SelectMenuComponent;
                const isLoading = loading === select.customId;
                return (
                  <select
                    key={compIdx}
                    disabled={select.disabled || isLoading}
                    onChange={(e) => {
                      const selected = Array.from(e.currentTarget.selectedOptions).map(o => o.value);
                      handleSelectChange(select.customId, selected);
                    }}
                    multiple={!!select.maxValues && select.maxValues > 1}
                    style={{
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--stroke)',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '14px',
                      minWidth: '160px',
                      cursor: select.disabled ? 'not-allowed' : 'pointer',
                      opacity: select.disabled ? 0.5 : 1,
                    }}
                  >
                    {select.placeholder && (
                      <option value="" disabled selected>{select.placeholder}</option>
                    )}
                    {select.options.slice(0, 25).map((opt, optIdx) => (
                      <option key={optIdx} value={opt.value}>
                        {opt.emoji ? `${opt.emoji} ` : ''}{opt.label}
                      </option>
                    ))}
                  </select>
                );
              }

              return null;
            })}
          </div>
        );
      })}
    </div>
  );
}
