// apps/web/src/components/ui/SearchInput.tsx
import { forwardRef, type InputHTMLAttributes } from 'react';

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  /** 'compact' (36px) for sidebars, 'large' (44px) for page-level search */
  size?: 'compact' | 'large';
  /** Called when the clear button is clicked */
  onClear?: () => void;
}

const base = {
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  background: 'var(--bg-input)',
  border: '1px solid var(--stroke)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text)',
  transition: 'border-color 0.15s ease',
} as const;

const sizes = {
  compact: { height: 36, padding: '0 12px', fontSize: 13, gap: 8, iconSize: 14 },
  large:   { height: 44, padding: '0 16px', fontSize: 14, gap: 10, iconSize: 16 },
} as const;

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ size = 'compact', value, onClear, style, ...props }, ref) => {
    const sz = sizes[size];
    const hasValue = value !== undefined && value !== '';

    return (
      <div style={{ ...base, height: sz.height, padding: sz.padding, gap: sz.gap, ...style }}>
        <svg
          width={sz.iconSize}
          height={sz.iconSize}
          viewBox="0 0 16 16"
          fill="none"
          style={{ flexShrink: 0, color: 'var(--text-faint)' }}
          aria-hidden
        >
          <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.5" />
          <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          ref={ref}
          type="search"
          value={value}
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            color: 'var(--text)',
            fontSize: sz.fontSize,
            outline: 'none',
            fontFamily: 'inherit',
          }}
          {...props}
        />
        {hasValue && onClear && (
          <button
            type="button"
            onClick={onClear}
            style={{
              border: 'none',
              background: 'none',
              color: 'var(--text-faint)',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
              padding: 0,
              flexShrink: 0,
            }}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>
    );
  },
);

SearchInput.displayName = 'SearchInput';
