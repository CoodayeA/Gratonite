import { useEffect, useState } from 'react';
import { X, Sparkles, Zap, Shield, Bug, ChevronDown, ChevronUp } from 'lucide-react';
import { CHANGELOG } from '../../data/changelog';

const TYPE_META: Record<string, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  feature: { icon: Sparkles, label: 'Feature', color: '#818cf8', bg: 'rgba(99,102,241,0.12)' },
  improvement: { icon: Zap, label: 'Improvement', color: '#34d399', bg: 'rgba(34,197,94,0.12)' },
  fix: { icon: Bug, label: 'Fix', color: '#fbbf24', bg: 'rgba(245,158,11,0.12)' },
  security: { icon: Shield, label: 'Security', color: '#f87171', bg: 'rgba(239,68,68,0.12)' },
};

function TypePill({ type, count }: { type: string; count: number }) {
  const meta = TYPE_META[type];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 99,
      background: meta.bg, color: meta.color,
      fontSize: 11, fontWeight: 600, letterSpacing: '0.01em',
    }}>
      <Icon size={10} />
      {meta.label}
      <span style={{ opacity: 0.7 }}>{count}</span>
    </span>
  );
}

function ReleaseCard({ release, isLatest, defaultOpen }: {
  release: typeof CHANGELOG[0]; isLatest: boolean; defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const typeCounts = release.entries.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const typeOrder: Array<keyof typeof TYPE_META> = ['feature', 'improvement', 'fix', 'security'];

  return (
    <div style={{
      borderRadius: 12,
      border: isLatest ? '1px solid rgba(99,102,241,0.35)' : '1px solid var(--stroke)',
      background: isLatest ? 'rgba(99,102,241,0.05)' : 'var(--bg-tertiary)',
      overflow: 'hidden',
      transition: 'border-color 0.15s',
    }}>
      {/* Card header — always visible */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', textAlign: 'left', background: 'none', border: 'none',
          padding: '14px 16px', cursor: 'pointer',
          display: 'flex', alignItems: 'flex-start', gap: 12,
        }}
        aria-expanded={open}
        aria-label={`${release.title} — ${open ? 'collapse' : 'expand'}`}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
              {release.title}
            </span>
            {isLatest && (
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                background: 'rgba(99,102,241,0.9)', color: '#fff',
                padding: '1px 6px', borderRadius: 99, textTransform: 'uppercase',
              }}>NEW</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{release.date}</span>
            <span style={{ color: 'var(--stroke)', fontSize: 11 }}>·</span>
            {typeOrder.filter(t => typeCounts[t]).map(t => (
              <TypePill key={t} type={t} count={typeCounts[t]} />
            ))}
          </div>
        </div>
        <span style={{ color: 'var(--text-muted)', flexShrink: 0, paddingTop: 2 }}>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {/* Entries — collapsible */}
      {open && (
        <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {typeOrder.map(type => {
            const items = release.entries.filter(e => e.type === type);
            if (!items.length) return null;
            const meta = TYPE_META[type];
            const Icon = meta.icon;
            return (
              <div key={type} style={{ marginTop: 10 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  marginBottom: 6, paddingBottom: 4,
                  borderBottom: `1px solid ${meta.bg}`,
                }}>
                  <Icon size={12} style={{ color: meta.color }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {meta.label}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {items.map((entry, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '3px 0' }}>
                      <span style={{
                        width: 4, height: 4, borderRadius: '50%',
                        background: meta.color, flexShrink: 0, marginTop: 7,
                      }} />
                      <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                        {entry.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function WhatsNewModal({ onClose }: { onClose: () => void }) {
  const latestId = CHANGELOG[0]?.id ?? '';

  useEffect(() => {
    localStorage.setItem('gratonite:last-seen-changelog', latestId);
  }, [latestId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="What's new"
        onClick={e => e.stopPropagation()}
        style={{
          width: 620, maxWidth: '96vw', maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg-elevated)',
          borderRadius: 16,
          border: '1px solid var(--stroke)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Fixed header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '18px 20px 14px',
          borderBottom: '1px solid var(--stroke)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'rgba(99,102,241,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Sparkles size={18} style={{ color: '#818cf8' }} />
            </div>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>
                What's New
              </h2>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {CHANGELOG.length} release{CHANGELOG.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 6, borderRadius: 8 }}
            aria-label="Close What's New"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable release list */}
        <div style={{ overflowY: 'auto', padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {CHANGELOG.map((release, i) => (
            <ReleaseCard
              key={release.id}
              release={release}
              isLatest={i === 0}
              defaultOpen={i === 0}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
