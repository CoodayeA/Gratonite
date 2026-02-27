import React, { forwardRef, useId, useState } from 'react';

/* ── CSS variable design tokens ─────────────────────────────────────── */
const V = {
  bgInput: 'var(--bg-input, #25243a)',
  stroke: 'var(--stroke, #4a4660)',
  accent: 'var(--accent, #d4af37)',
  text: 'var(--text, #e8e4e0)',
  textMuted: 'var(--text-muted, #a8a4b8)',
  textFaint: 'var(--text-faint, #6e6a80)',
  danger: 'var(--danger, #ff6b6b)',
  radiusMd: 'var(--radius-md, 8px)',
} as const;

/* ── Inline style objects ───────────────────────────────────────────── */

const inputGroupStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
} as React.CSSProperties;

const inputLabelStyle = {
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: V.textMuted,
} as React.CSSProperties;

const inputWrapperStyle = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
} as React.CSSProperties;

const inputFieldBase = {
  width: '100%',
  padding: '10px 14px',
  background: V.bgInput,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: V.stroke,
  borderRadius: V.radiusMd,
  color: V.text,
  fontFamily: 'inherit',
  fontSize: 14,
  outline: 'none',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease',
} as React.CSSProperties;

const inputFieldFocused = {
  ...inputFieldBase,
  borderColor: V.accent,
  boxShadow: '0 0 0 2px var(--gold-subtle, rgba(212, 175, 55, 0.19))',
  background: 'var(--bg-float)',
} as React.CSSProperties;

const inputFieldError = {
  ...inputFieldBase,
  borderColor: V.danger,
} as React.CSSProperties;

const inputFieldErrorFocused = {
  ...inputFieldFocused,
  borderColor: V.danger,
} as React.CSSProperties;

const inputToggleBase = {
  position: 'absolute',
  right: 10,
  background: 'none',
  border: 'none',
  color: V.textMuted,
  fontSize: 12,
  padding: '4px 6px',
  cursor: 'pointer',
  transition: 'color 0.15s ease',
} as React.CSSProperties;

const inputToggleHover = {
  ...inputToggleBase,
  color: V.text,
} as React.CSSProperties;

const inputErrorTextStyle = {
  fontSize: 12,
  color: V.danger,
} as React.CSSProperties;

const inputHintStyle = {
  fontSize: 12,
  color: V.textFaint,
} as React.CSSProperties;

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, type, className = '', style, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [toggleHovered, setToggleHovered] = useState(false);
    const generatedId = useId();
    const inputId = props.id ?? `input-${generatedId}`;
    const isPassword = type === 'password';

    const fieldStyle = error
      ? (isFocused ? inputFieldErrorFocused : inputFieldError)
      : (isFocused ? inputFieldFocused : inputFieldBase);

    return (
      <div style={inputGroupStyle}>
        {label && (
          <label style={inputLabelStyle} htmlFor={inputId}>
            {label}
          </label>
        )}
        <div style={inputWrapperStyle}>
          <input
            ref={ref}
            id={inputId}
            type={isPassword && showPassword ? 'text' : type}
            style={fieldStyle}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              style={toggleHovered ? inputToggleHover : inputToggleBase}
              onMouseEnter={() => setToggleHovered(true)}
              onMouseLeave={() => setToggleHovered(false)}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide value' : 'Show value'}
              aria-pressed={showPassword}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          )}
        </div>
        {error && <span style={inputErrorTextStyle}>{error}</span>}
        {hint && !error && <span style={inputHintStyle}>{hint}</span>}
      </div>
    );
  },
);

Input.displayName = 'Input';
