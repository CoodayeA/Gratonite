import { useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { useTheme, type AppTheme, type ColorMode, type FontFamily, type FontSize, type GlassMode, type ButtonShape, type FocusIndicatorSize, type ColorBlindMode } from '../../ui/ThemeProvider';
import { playSound } from '../../../utils/SoundManager';
import type { SettingsTabProps } from './types';

type Props = SettingsTabProps;

const SettingsAccessibilityTab = ({ addToast }: Props) => {
  const {
    theme, setTheme, colorMode, setColorMode, fontFamily, setFontFamily,
    fontSize, setFontSize, glassMode, setGlassMode,
    showChannelBackgrounds, setShowChannelBackgrounds,
    playMovingBackgrounds, setPlayMovingBackgrounds,
    highContrast, setHighContrast, compactMode, setCompactMode,
    buttonShape, setButtonShape, reducedEffects, setReducedEffects,
    lowPower, setLowPower, accentColor, setAccentColor,
    screenReaderMode, setScreenReaderMode, linkUnderlines, setLinkUnderlines,
    focusIndicatorSize, setFocusIndicatorSize, colorBlindMode, setColorBlindMode,
    lowDataMode, setLowDataMode,
  } = useTheme();

  const [seasonalEnabled, setSeasonalEnabled] = useState(() => localStorage.getItem('gratonite-seasonal-effects') === 'true');

  const switchStyle = (checked: boolean): React.CSSProperties => ({
    width: '40px', height: '24px',
    background: checked ? 'var(--accent-primary)' : 'var(--stroke)',
    borderRadius: '12px', position: 'relative', cursor: 'pointer',
    transition: '0.2s', flexShrink: 0,
  });
  const knobStyle = (checked: boolean): React.CSSProperties => ({
    position: 'absolute', height: '16px', width: '16px',
    left: checked ? '20px' : '4px', bottom: '4px',
    backgroundColor: checked ? '#000' : 'white',
    transition: '.4s', borderRadius: '50%',
  });

  const ToggleRow = ({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: () => void }) => (
    <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{desc}</div>
      </div>
      <div role="switch" aria-checked={checked} aria-label={label} tabIndex={0} onClick={() => { onChange(); playSound('click'); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(); playSound('click'); } }} style={switchStyle(checked)}>
        <div style={knobStyle(checked)}></div>
      </div>
    </div>
  );

  return (
    <>
      <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Accessibility</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '13px' }}>Customize Gratonite to work best for you.</p>

      <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Visuals & Contrast</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
        <ToggleRow label="High Contrast Mode" desc="Increases text contrast for better readability." checked={highContrast} onChange={() => setHighContrast(!highContrast)} />
        <ToggleRow label="Reduce Motion" desc="Minimizes animations and movement across the UI." checked={reducedEffects} onChange={() => setReducedEffects(!reducedEffects)} />
        <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
            <div style={{ fontWeight: 600 }}>Color-Blind Mode</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Applies color filters and shape-based status indicators for color vision deficiencies.</div>
          </div>
          <select value={colorBlindMode} onChange={(e) => { setColorBlindMode(e.target.value as any); playSound('click'); }} aria-label="Color-Blind Mode" style={{ padding: '8px 12px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--stroke)', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', flexShrink: 0 }}>
            <option value="none">Off</option>
            <option value="deuteranopia">Deuteranopia (green-weak)</option>
            <option value="protanopia">Protanopia (red-weak)</option>
            <option value="tritanopia">Tritanopia (blue-weak)</option>
          </select>
        </div>
      </div>

      <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Data & Performance</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
        <ToggleRow label="Low Data Mode" desc="Reduces bandwidth usage: lower-res images, disables GIF/video auto-play, defers embed loading." checked={lowDataMode} onChange={() => setLowDataMode(!lowDataMode)} />
      </div>

      <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Navigation & Focus</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
        <ToggleRow label="Link Underlines" desc="Underlines all interactive text links for easier identification." checked={linkUnderlines} onChange={() => setLinkUnderlines(!linkUnderlines)} />
        <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontWeight: 600 }}>Focus Indicator Size</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Controls the thickness of the keyboard focus outline.</div>
          </div>
          <select value={focusIndicatorSize} onChange={(e) => { setFocusIndicatorSize(e.target.value as any); playSound('click'); }} aria-label="Focus indicator size" className="auth-input" style={{ width: 'auto', padding: '8px 12px', margin: 0, height: '36px' }}>
            <option value="normal">Normal (2px)</option>
            <option value="large">Large (4px)</option>
          </select>
        </div>
      </div>

      <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Screen Reader</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
        <ToggleRow label="Screen Reader Mode" desc="Adds verbose labels, live regions, and route change announcements for assistive technology." checked={screenReaderMode} onChange={() => setScreenReaderMode(!screenReaderMode)} />
      </div>

      <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Text & Chat</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontWeight: 600 }}>Chat Font Size</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Changes the font size inside messages.</div>
          </div>
          <select value={fontSize} onChange={(e) => setFontSize(e.target.value as any)} aria-label="Chat font size" className="auth-input" style={{ width: 'auto', padding: '8px 12px', margin: 0, height: '36px' }}>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
            <option value="extra-large">Extra Large</option>
          </select>
        </div>
        <ToggleRow label="Compact Message Mode" desc="Show messages in a denser, more compact layout." checked={compactMode} onChange={() => setCompactMode(!compactMode)} />
        <ToggleRow
          label="Seasonal Effects"
          desc="Show seasonal particle effects (snowflakes, cherry blossoms, etc.)."
          checked={seasonalEnabled}
          onChange={() => {
            const next = !seasonalEnabled;
            setSeasonalEnabled(next);
            localStorage.setItem('gratonite-seasonal-effects', next ? 'true' : 'false');
            window.dispatchEvent(new Event('seasonal-effects-toggle'));
          }}
        />
      </div>

      {/* Import / Export */}
      <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px', marginTop: '32px' }}>Import / Export</h3>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button
          onClick={() => {
            const themeData = {
              _format: 'gratonite-theme', _version: 1,
              theme, colorMode, fontFamily, fontSize, glassMode, buttonShape,
              accentColor, highContrast, compactMode, reducedEffects, lowPower,
              showChannelBackgrounds, playMovingBackgrounds, screenReaderMode,
              linkUnderlines, focusIndicatorSize, colorBlindMode,
            };
            const blob = new Blob([JSON.stringify(themeData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `gratonite-theme-${theme}.json`; a.click();
            URL.revokeObjectURL(url);
            addToast({ title: 'Theme exported', variant: 'success' });
            playSound('click');
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', padding: '10px 16px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
          className="hover-bg-elevated"
        >
          <Download size={16} /> Export Theme
        </button>
        <button
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file'; input.accept = '.json,.gratonite-theme';
            input.onchange = (ev) => {
              const file = (ev.target as HTMLInputElement).files?.[0]; if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  const data = JSON.parse(reader.result as string);
                  if (!data || typeof data !== 'object') throw new Error('Invalid file');
                  if (data.theme) setTheme(data.theme as AppTheme);
                  if (data.colorMode) setColorMode(data.colorMode as ColorMode);
                  if (data.fontFamily) setFontFamily(data.fontFamily as FontFamily);
                  if (data.fontSize) setFontSize(data.fontSize as FontSize);
                  if (data.glassMode) setGlassMode(data.glassMode as GlassMode);
                  if (data.buttonShape) setButtonShape(data.buttonShape as ButtonShape);
                  if (data.accentColor) setAccentColor(data.accentColor);
                  if (typeof data.highContrast === 'boolean') setHighContrast(data.highContrast);
                  if (typeof data.compactMode === 'boolean') setCompactMode(data.compactMode);
                  if (typeof data.reducedEffects === 'boolean') setReducedEffects(data.reducedEffects);
                  if (typeof data.lowPower === 'boolean') setLowPower(data.lowPower);
                  if (typeof data.showChannelBackgrounds === 'boolean') setShowChannelBackgrounds(data.showChannelBackgrounds);
                  if (typeof data.playMovingBackgrounds === 'boolean') setPlayMovingBackgrounds(data.playMovingBackgrounds);
                  if (typeof data.screenReaderMode === 'boolean') setScreenReaderMode(data.screenReaderMode);
                  if (typeof data.linkUnderlines === 'boolean') setLinkUnderlines(data.linkUnderlines);
                  if (data.focusIndicatorSize) setFocusIndicatorSize(data.focusIndicatorSize as FocusIndicatorSize);
                  if (data.colorBlindMode) setColorBlindMode(data.colorBlindMode as ColorBlindMode);
                  addToast({ title: 'Theme imported successfully', variant: 'success' });
                  playSound('click');
                } catch { addToast({ title: 'Invalid theme file', variant: 'error' }); }
              };
              reader.readAsText(file);
            };
            input.click();
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', padding: '10px 16px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
          className="hover-bg-elevated"
        >
          <Upload size={16} /> Import Theme
        </button>
      </div>
    </>
  );
};

export default SettingsAccessibilityTab;
