import { useEffect, useState } from 'react';
import { X, Sparkles, Zap, Shield, Bug, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { CHANGELOG, type SpotlightFeature } from '../../data/changelog';

// ─── type meta (used only for the full entry list) ──────────────────────────

const TYPE_META = {
  feature:     { icon: Sparkles, label: 'New Features',   color: 'var(--accent-primary)' },
  improvement: { icon: Zap,      label: 'Improvements',   color: 'var(--text-secondary)' },
  fix:         { icon: Bug,      label: 'Bug Fixes',      color: 'var(--text-muted)'     },
  security:    { icon: Shield,   label: 'Security',       color: 'var(--text-muted)'     },
} as const;

const TYPE_ORDER = ['feature', 'improvement', 'fix', 'security'] as const;

// ─── Spotlight tile ──────────────────────────────────────────────────────────

function SpotlightTile({
  feature,
  onOpenSettings,
}: {
  feature: SpotlightFeature;
  onOpenSettings: (tab: string) => void;
}) {
  return (
    <div style={{
      background: 'var(--bg-tertiary)',
      border: '1px solid var(--stroke)',
      borderRadius: 10,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <span style={{ fontSize: 22, lineHeight: 1 }}>{feature.emoji}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
        {feature.title}
      </span>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, flexGrow: 1 }}>
        {feature.description}
      </span>
      {feature.settingsTab && feature.actionLabel ? (
        <button
          onClick={() => onOpenSettings(feature.settingsTab!)}
          style={{
            marginTop: 4, background: 'none', border: 'none', padding: 0,
            color: 'var(--accent-primary)', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
            textAlign: 'left',
          }}
        >
          {feature.actionLabel}
          <ArrowRight size={11} />
        </button>
      ) : feature.hint ? (
        <span style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
          {feature.hint}
        </span>
      ) : null}
    </div>
  );
}

// ─── Expandable full entry list ──────────────────────────────────────────────

function FullEntryList({ entries }: { entries: typeof CHANGELOG[0]['entries'] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {TYPE_ORDER.map(type => {
        const items = entries.filter(e => e.type === type);
        if (!items.length) return null;
        const { icon: Icon, label, color } = TYPE_META[type];
        return (
          <div key={type}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              marginBottom: 8, paddingBottom: 6,
              borderBottom: '1px solid var(--stroke)',
            }}>
              <Icon size={13} style={{ color }} />
              <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {label}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 2 }}>({items.length})</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map((entry, i) => (
                <p key={i} style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, paddingLeft: 4 }}>
                  {entry.text}
                </p>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Older release row ───────────────────────────────────────────────────────

function OlderRelease({ release }: { release: typeof CHANGELOG[0] }) {
  const [open, setOpen] = useState(false);
  const total = release.entries.length;
  const featureCount = release.entries.filter(e => e.type === 'feature').length;

  return (
    <div style={{ borderBottom: '1px solid var(--stroke)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        style={{
          width: '100%', background: 'none', border: 'none', padding: '12px 0',
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {release.title}
          </span>
          <div style={{ marginTop: 2, display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{release.date}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {featureCount > 0 ? `${featureCount} new feature${featureCount !== 1 ? 's' : ''}` : ''}{featureCount > 0 && total - featureCount > 0 ? ', ' : ''}{total - featureCount > 0 ? `${total - featureCount} improvement${total - featureCount !== 1 ? 's' : ''}` : ''}
            </span>
          </div>
        </div>
        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>
      </button>
      {open && (
        <div style={{ paddingBottom: 16 }}>
          <FullEntryList entries={release.entries} />
        </div>
      )}
    </div>
  );
}

// ─── Main modal ──────────────────────────────────────────────────────────────

export default function WhatsNewModal({
  onClose,
  onOpenSettings,
}: {
  onClose: () => void;
  onOpenSettings: (tab: string) => void;
}) {
  const latestId = CHANGELOG[0]?.id ?? '';
  const [showAllEntries, setShowAllEntries] = useState(false);

  useEffect(() => {
    localStorage.setItem('gratonite:last-seen-changelog', latestId);
  }, [latestId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const latest = CHANGELOG[0];
  const older = CHANGELOG.slice(1);

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
          width: 680, maxWidth: '96vw', maxHeight: '88vh',
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg-elevated)',
          borderRadius: 16,
          border: '1px solid var(--stroke)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.55)',
          overflow: 'hidden',
        }}
      >
        {/* ── Fixed header ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 22px',
          borderBottom: '1px solid var(--stroke)',
          flexShrink: 0,
        }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            What's New
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', padding: 6, borderRadius: 8, lineHeight: 0,
            }}
            aria-label="Close What's New"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ overflowY: 'auto', padding: '28px 28px 32px' }}>

          {/* Latest release hero */}
          {latest && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: 'var(--accent-primary)',
                }}>
                  Latest
                </span>
                <span style={{ color: 'var(--stroke)', fontSize: 10 }}>·</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{latest.date}</span>
              </div>
              <h3 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                {latest.title}
              </h3>
              {latest.tagline && (
                <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 540 }}>
                  {latest.tagline}
                </p>
              )}
            </div>
          )}

          {/* Spotlight grid */}
          {latest?.spotlight && latest.spotlight.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <p style={{
                margin: '0 0 12px', fontSize: 11, fontWeight: 700,
                color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                Highlights
              </p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 10,
              }}>
                {latest.spotlight.map((feature, i) => (
                  <SpotlightTile key={i} feature={feature} onOpenSettings={onOpenSettings} />
                ))}
              </div>
            </div>
          )}

          {/* See all changes toggle */}
          {latest && (
            <div style={{ marginBottom: 28 }}>
              <button
                onClick={() => setShowAllEntries(v => !v)}
                style={{
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500,
                }}
              >
                {showAllEntries ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showAllEntries ? 'Hide' : `See all ${latest.entries.length} changes`}
              </button>
              {showAllEntries && (
                <div style={{ marginTop: 16 }}>
                  <FullEntryList entries={latest.entries} />
                </div>
              )}
            </div>
          )}

          {/* Older releases */}
          {older.length > 0 && (
            <div>
              <p style={{
                margin: '0 0 4px', fontSize: 11, fontWeight: 700,
                color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                Previous Releases
              </p>
              {older.map(release => (
                <OlderRelease key={release.id} release={release} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

