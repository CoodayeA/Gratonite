/**
 * Items 17 & 18: Theme Preview Banner
 * Shows a floating bar when a theme is being previewed (hover or "Try it" mode).
 * - Hover preview: shows "Previewing..." text
 * - Full preview ("Try it"): shows theme name + Apply/Cancel buttons
 */
import { useTheme } from './ThemeProvider';
import { resolveTheme } from '../../themes/registry';
import { Check, X } from 'lucide-react';

const ThemePreviewBanner = () => {
  const { isPreviewActive, previewTheme, setTheme, theme } = useTheme();

  // Read the full-preview (persistent "Try it") state from a global
  const fullPreviewId = (window as any).__gratoniteFullPreview as string | undefined;

  if (!isPreviewActive && !fullPreviewId) return null;

  // If it's a full "Try it" preview with Apply/Cancel
  if (fullPreviewId) {
    const def = resolveTheme(fullPreviewId);
    const name = def?.name || fullPreviewId;

    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          padding: '8px 16px',
          background: 'var(--accent-primary)',
          color: '#000',
          fontSize: '13px',
          fontWeight: 700,
          fontFamily: 'var(--font-sans)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
        }}
      >
        <span>Previewing: {name}</span>
        <button
          onClick={() => {
            setTheme(fullPreviewId);
            (window as any).__gratoniteFullPreview = undefined;
            previewTheme(null);
            window.dispatchEvent(new CustomEvent('gratonite:full-preview-changed'));
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 14px',
            borderRadius: '6px',
            border: '2px solid rgba(0,0,0,0.3)',
            background: 'rgba(0,0,0,0.15)',
            color: '#000',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Check size={14} /> Apply
        </button>
        <button
          onClick={() => {
            (window as any).__gratoniteFullPreview = undefined;
            previewTheme(null);
            window.dispatchEvent(new CustomEvent('gratonite:full-preview-changed'));
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 14px',
            borderRadius: '6px',
            border: '2px solid rgba(0,0,0,0.3)',
            background: 'rgba(0,0,0,0.08)',
            color: '#000',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <X size={14} /> Cancel
        </button>
      </div>
    );
  }

  // Hover preview: just show a subtle banner
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99999,
        padding: '4px 16px',
        borderRadius: '0 0 8px 8px',
        background: 'var(--accent-primary)',
        color: '#000',
        fontSize: '11px',
        fontWeight: 700,
        fontFamily: 'var(--font-sans)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        pointerEvents: 'none',
      }}
    >
      Previewing...
    </div>
  );
};

export default ThemePreviewBanner;
