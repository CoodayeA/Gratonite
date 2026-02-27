import { useState, useRef, useEffect, type CSSProperties } from 'react';
import { shouldEnableUiV2Tokens } from '@/theme/initTheme';

export type UserStatus = 'online' | 'idle' | 'dnd' | 'invisible';

interface StatusPickerProps {
  currentStatus: UserStatus;
  onStatusChange: (status: UserStatus) => void;
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_OPTIONS: Array<{ value: UserStatus; label: string; emoji: string; color: string }> = [
  { value: 'online', label: 'Online', emoji: '\u{1F7E2}', color: '#23a55a' },
  { value: 'idle', label: 'Idle', emoji: '\u{1F319}', color: '#f0b232' },
  { value: 'dnd', label: 'Do Not Disturb', emoji: '\u{26D4}', color: '#f23f43' },
  { value: 'invisible', label: 'Invisible', emoji: '\u{26AB}', color: '#6e6a80' },
];

/* ── Inline style objects ─────────────────────────────────── */

const styles = {
  container: {
    background: '#353348',
    borderRadius: 'var(--radius-md)',
    border: '1px solid #4a4660',
    padding: 8,
    minWidth: 200,
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    zIndex: 1000,
  } as CSSProperties,
  header: {
    fontSize: 11,
    fontWeight: 600,
    color: '#a8a4b8',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '4px 8px 8px',
  } as CSSProperties,
  options: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  } as CSSProperties,
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 8px',
    borderRadius: 'var(--radius-sm)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    color: '#e8e4e0',
    fontSize: 13,
  } as CSSProperties,
  optionActive: {
    background: '#413d58',
  } as CSSProperties,
  optionHover: {
    background: '#413d58',
  } as CSSProperties,
  indicator: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    flexShrink: 0,
  } as CSSProperties,
  label: {
    flex: 1,
    color: '#e8e4e0',
    fontSize: 13,
  } as CSSProperties,
  check: {
    color: '#d4af37',
    fontSize: 14,
    fontWeight: 700,
  } as CSSProperties,
  footer: {
    borderTop: '1px solid #4a4660',
    marginTop: 4,
    paddingTop: 4,
  } as CSSProperties,
  customBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 8px',
    borderRadius: 'var(--radius-sm)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    color: '#a8a4b8',
    fontSize: 13,
  } as CSSProperties,
  customBtnHover: {
    background: '#413d58',
  } as CSSProperties,
  /* StatusButton styles */
  button: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as CSSProperties,
  buttonIndicator: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    border: '2px solid #2c2c3e',
  } as CSSProperties,
} as const;

export function StatusPicker({ currentStatus, onStatusChange, isOpen, onClose }: StatusPickerProps) {
  const uiV2TokensEnabled = shouldEnableUiV2Tokens();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [customHovered, setCustomHovered] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentOption = STATUS_OPTIONS.find(s => s.value === currentStatus);

  return (
    <div
      ref={dropdownRef}
      style={styles.container}
    >
      <div style={styles.header}>
        <span>Set Status</span>
      </div>
      <div style={styles.options}>
        {STATUS_OPTIONS.map((option, i) => {
          const isActive = currentStatus === option.value;
          return (
            <button
              key={option.value}
              style={{
                ...styles.option,
                ...(isActive ? styles.optionActive : undefined),
                ...(hoveredIndex === i && !isActive ? styles.optionHover : undefined),
              }}
              onClick={() => {
                onStatusChange(option.value);
                onClose();
              }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <span
                style={{ ...styles.indicator, backgroundColor: option.color }}
              />
              <span style={styles.label}>{option.label}</span>
              {isActive && (
                <span style={styles.check}>{'\u2713'}</span>
              )}
            </button>
          );
        })}
      </div>
      <div style={styles.footer}>
        <button
          style={{
            ...styles.customBtn,
            ...(customHovered ? styles.customBtnHover : undefined),
          }}
          onMouseEnter={() => setCustomHovered(true)}
          onMouseLeave={() => setCustomHovered(false)}
        >
          <span>{'\u{1F3A8}'}</span>
          <span>Custom Status</span>
        </button>
      </div>
    </div>
  );
}

interface StatusButtonProps {
  currentStatus: UserStatus;
  onClick: () => void;
}

export function StatusButton({ currentStatus, onClick }: StatusButtonProps) {
  const uiV2TokensEnabled = shouldEnableUiV2Tokens();
  const currentOption = STATUS_OPTIONS.find(s => s.value === currentStatus);

  return (
    <button
      style={styles.button}
      onClick={onClick}
      title={`Status: ${currentOption?.label}`}
    >
      <span
        style={{ ...styles.buttonIndicator, backgroundColor: currentOption?.color }}
      />
    </button>
  );
}
