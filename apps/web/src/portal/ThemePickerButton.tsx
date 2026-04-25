/**
 * ThemePickerButton — floating "Customize" pill on the Portal that opens
 * the ThemePicker in a side drawer. Owners edit guild default; non-owners
 * edit their personal override.
 */
import { useState } from 'react';
import { Palette } from 'lucide-react';
import { usePortalTheme } from './themes/PortalThemeProvider';
import { ThemePicker } from './ThemePicker';

export function ThemePickerButton() {
  const { isOwner } = usePortalTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="portal-customize-btn"
        onClick={() => setOpen(true)}
        aria-label="Customize portal appearance"
      >
        <Palette size={16} />
        <span>Customize</span>
      </button>

      {open ? (
        <div className="portal-customize-drawer-backdrop" onClick={() => setOpen(false)}>
          <div
            className="portal-customize-drawer"
            role="dialog"
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
