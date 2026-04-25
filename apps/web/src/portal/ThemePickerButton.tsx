/**
 * ThemePickerButton — floating "Customize" pill on the Portal that opens
 * the ThemePicker in a side drawer. Owners edit guild default; non-owners
 * edit their personal override.
 */
import { useEffect, useRef, useState } from 'react';
import { Palette } from 'lucide-react';
import { usePortalTheme } from './themes/PortalThemeProvider';
import { ThemePicker } from './ThemePicker';

export function ThemePickerButton() {
  const { isOwner } = usePortalTheme();
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    // Focus first focusable in drawer
    const t = window.setTimeout(() => {
      const el = drawerRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      el?.focus();
    }, 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
      triggerRef.current?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="portal-customize-btn"
        onClick={() => setOpen(true)}
        aria-label="Customize portal appearance"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Palette size={16} />
        <span>Customize</span>
      </button>

      {open ? (
        <div className="portal-customize-drawer-backdrop" onClick={() => setOpen(false)}>
          <div
            ref={drawerRef}
            className="portal-customize-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Portal customization"
            onClick={(e) => e.stopPropagation()}
          >
            <ThemePicker
              scope={isOwner ? 'guildDefault' : 'memberOverride'}
              onClose={() => setOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
