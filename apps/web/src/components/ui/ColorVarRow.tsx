// apps/web/src/components/ui/ColorVarRow.tsx
import { useState, useEffect, useRef } from 'react';
import type { ThemeVars } from '@/lib/themes';

export interface ColorVarRowProps {
  label: string;
  description: string;
  varKey: keyof ThemeVars;
  value: string;
  onChange: (key: keyof ThemeVars, value: string) => void;
}

function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex);
}

export function ColorVarRow({ label, description, varKey, value, onChange }: ColorVarRowProps) {
  const [hexInput, setHexInput] = useState(value);
  // Track last value committed to parent to avoid double-firing onChange on blur
  const lastCommitted = useRef(value);

  useEffect(() => {
    setHexInput(value);
    lastCommitted.current = value;
  }, [value]);

  function handlePickerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const hex = e.target.value;
    setHexInput(hex);
    lastCommitted.current = hex;
    onChange(varKey, hex);
  }

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const hex = raw.startsWith('#') ? raw : `#${raw}`;
    // Always store the #-prefixed form so the display is consistent
    setHexInput(hex);
    if (isValidHex(hex)) {
      lastCommitted.current = hex;
      onChange(varKey, hex);
    }
  }

  function handleTextBlur() {
    if (isValidHex(hexInput)) {
      // Only fire if value differs from what was already committed
      if (hexInput !== lastCommitted.current) {
        lastCommitted.current = hexInput;
        onChange(varKey, hexInput);
      }
    } else {
      // Revert to last valid value from parent
      setHexInput(value);
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '8px 0',
      borderBottom: '1px solid var(--stroke)',
    }}>
      <input
        type="color"
        value={isValidHex(value) ? value : '#000000'}
        onChange={handlePickerChange}
        aria-label={`Colour picker for ${label}`}
        style={{
          width: 32,
          height: 32,
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--stroke)',
          cursor: 'pointer',
          padding: 2,
          background: 'var(--bg-input)',
          flexShrink: 0,
        }}
        title={`Pick colour for ${label}`}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1 }}>{description}</div>
      </div>

      <input
        type="text"
        value={hexInput}
        onChange={handleTextChange}
        onBlur={handleTextBlur}
        maxLength={7}
        style={{
          width: 88,
          height: 30,
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--stroke)',
          background: 'var(--bg-input)',
          color: 'var(--text)',
          fontSize: 12,
          fontFamily: 'monospace',
          padding: '0 8px',
          flexShrink: 0,
        }}
        placeholder="#000000"
        aria-label={`Hex value for ${label}`}
      />
    </div>
  );
}
