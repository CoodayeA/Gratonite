/**
 * Item 16: Realistic Theme Preview Component
 * Renders a miniature but realistic app mockup (sidebar + channels + messages + input)
 * using colors from a ThemeDefinition.
 */
import type { ThemeDefinition } from '../../themes/types';

interface ThemePreviewProps {
  theme: ThemeDefinition;
  colorMode: 'dark' | 'light';
  style?: React.CSSProperties;
}

const ThemePreview = ({ theme, colorMode, style }: ThemePreviewProps) => {
  const vars = colorMode === 'light' ? theme.light : theme.dark;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: '72px',
        background: vars.bgApp,
        borderRadius: '6px',
        overflow: 'hidden',
        display: 'flex',
        fontFamily: 'Inter, sans-serif',
        ...style,
      }}
    >
      {/* Server rail */}
      <div
        style={{
          width: '14px',
          background: vars.bgRail,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '4px 0',
          gap: '3px',
          flexShrink: 0,
        }}
      >
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: vars.accentPrimary }} />
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: vars.strokeSubtle }} />
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: vars.strokeSubtle }} />
      </div>

      {/* Channel sidebar */}
      <div
        style={{
          width: '36px',
          background: vars.bgSidebar,
          display: 'flex',
          flexDirection: 'column',
          padding: '4px 3px',
          gap: '2px',
          flexShrink: 0,
        }}
      >
        {/* Server name */}
        <div
          style={{
            height: '7px',
            width: '80%',
            background: vars.textPrimary,
            borderRadius: '2px',
            opacity: 0.7,
            marginBottom: '3px',
          }}
        />
        {/* Channel items */}
        {['60%', '70%', '50%', '65%'].map((w, i) => (
          <div
            key={i}
            style={{
              height: '5px',
              width: w,
              background: i === 1 ? vars.accentPrimary : vars.textMuted,
              borderRadius: '2px',
              opacity: i === 1 ? 0.9 : 0.5,
            }}
          />
        ))}
      </div>

      {/* Main chat area */}
      <div
        style={{
          flex: 1,
          background: vars.bgChannel,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header bar */}
        <div
          style={{
            height: '10px',
            borderBottom: `1px solid ${vars.stroke}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 4px',
          }}
        >
          <div style={{ height: '4px', width: '30%', background: vars.textPrimary, borderRadius: '2px', opacity: 0.6 }} />
        </div>

        {/* Messages */}
        <div style={{ flex: 1, padding: '3px 4px', display: 'flex', flexDirection: 'column', gap: '3px', justifyContent: 'flex-end' }}>
          {/* Message 1 */}
          <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: vars.accentPurple, flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <div style={{ height: '3px', width: '20px', background: vars.accentPrimary, borderRadius: '1px', opacity: 0.8 }} />
              <div style={{ height: '3px', width: '40px', background: vars.textSecondary, borderRadius: '1px', opacity: 0.5 }} />
            </div>
          </div>
          {/* Message 2 */}
          <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: vars.accentBlue, flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <div style={{ height: '3px', width: '18px', background: vars.accentPink, borderRadius: '1px', opacity: 0.8 }} />
              <div style={{ height: '3px', width: '50px', background: vars.textSecondary, borderRadius: '1px', opacity: 0.5 }} />
              <div style={{ height: '3px', width: '30px', background: vars.textSecondary, borderRadius: '1px', opacity: 0.3 }} />
            </div>
          </div>
        </div>

        {/* Input bar */}
        <div
          style={{
            height: '10px',
            margin: '2px 3px 3px',
            background: vars.bgElevated,
            borderRadius: '3px',
            border: `1px solid ${vars.stroke}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 3px',
          }}
        >
          <div style={{ height: '3px', width: '50%', background: vars.textMuted, borderRadius: '1px', opacity: 0.4 }} />
        </div>
      </div>
    </div>
  );
};

export default ThemePreview;
