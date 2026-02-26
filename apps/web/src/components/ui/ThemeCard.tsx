// apps/web/src/components/ui/ThemeCard.tsx
import { type Theme } from '@/lib/themes';

// ─── ThemePreview ────────────────────────────────────────────────────────────

export function ThemePreview({ theme }: { theme: Theme }) {
  const v = theme.vars;
  return (
    <div style={{
      width: '100%',
      height: 120,
      borderRadius: '8px 8px 0 0',
      overflow: 'hidden',
      display: 'flex',
      flexShrink: 0,
      border: `1px solid ${v['--stroke']}`,
      borderBottom: 'none',
    }}>
      {/* Mini server icon column */}
      <div style={{
        width: 40,
        background: v['--bg-float'],
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 6,
        gap: 4,
        borderRight: `1px solid ${v['--stroke']}`,
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 24,
            height: 24,
            borderRadius: i === 0 ? 8 : 12,
            background: i === 0 ? v['--accent'] : v['--bg-soft'],
          }} />
        ))}
      </div>
      {/* Channel list */}
      <div style={{
        width: 56,
        background: v['--bg-elevated'],
        padding: '6px 4px',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        borderRight: `1px solid ${v['--stroke']}`,
      }}>
        <div style={{ height: 8, width: 36, borderRadius: 4, background: v['--text-faint'], opacity: 0.6 }} />
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{
            height: 6,
            width: i === 0 ? 44 : i === 1 ? 36 : i === 2 ? 48 : 32,
            borderRadius: 3,
            background: i === 0 ? v['--accent'] + '40' : v['--bg-soft'],
          }} />
        ))}
      </div>
      {/* Chat area */}
      <div style={{
        flex: 1,
        background: v['--bg'],
        padding: 6,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}>
        {[32, 24, 40, 20].map((w, i) => (
          <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {i % 2 === 0 && (
              <div style={{ width: 12, height: 12, borderRadius: 6, background: v['--bg-soft'], flexShrink: 0 }} />
            )}
            <div style={{
              height: 6,
              width: `${w}%`,
              borderRadius: 3,
              background: i === 0 ? v['--text'] + '60' : v['--text-faint'] + '50',
            }} />
          </div>
        ))}
        <div style={{ marginTop: 'auto', display: 'flex', gap: 4 }}>
          <div style={{ flex: 1, height: 12, borderRadius: 6, background: v['--bg-elevated'], border: `1px solid ${v['--stroke']}` }} />
          <div style={{ width: 20, height: 12, borderRadius: 4, background: v['--accent'] }} />
        </div>
      </div>
    </div>
  );
}

// ─── ThemeCard ────────────────────────────────────────────────────────────────

export interface ThemeCardProps {
  theme: Theme;
  appliedId: string | null;
  onApply: (theme: Theme) => void;
}

export function ThemeCard({ theme, appliedId, onApply }: ThemeCardProps) {
  const isApplied = appliedId === theme.id;
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      borderRadius: 12,
      overflow: 'hidden',
      background: 'var(--bg-elevated)',
      border: `1px solid ${isApplied ? 'var(--accent)' : 'var(--stroke)'}`,
      boxShadow: isApplied ? '0 0 0 2px rgba(212,175,55,0.25)' : 'none',
      transition: 'border-color 140ms',
    }}>
      <ThemePreview theme={theme} />
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{theme.name}</span>
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>v{theme.version}</span>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{theme.description}</span>
        {/* Color swatches */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[theme.vars['--bg'], theme.vars['--bg-elevated'], theme.vars['--accent'], theme.vars['--text']].map((c, i) => (
            <div key={i} style={{
              width: 14, height: 14, borderRadius: '50%',
              background: c, border: '1px solid rgba(255,255,255,0.15)',
            }} />
          ))}
        </div>
        {/* Tags */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {theme.tags.map(t => (
            <span key={t} style={{
              fontSize: 11, padding: '2px 7px', borderRadius: 100,
              background: 'var(--bg-soft)', color: 'var(--text-faint)',
            }}>#{t}</span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onApply(theme)}
          style={{
            height: 32, borderRadius: 8, fontSize: 13, fontWeight: 600,
            border: 'none', cursor: 'pointer',
            background: isApplied ? 'rgba(212,175,55,0.2)' : 'var(--accent)',
            color: isApplied ? 'var(--accent)' : '#1a1a2e',
            transition: 'all 140ms',
          }}
        >
          {isApplied ? '✓ Applied' : 'Apply Theme'}
        </button>
      </div>
    </div>
  );
}
