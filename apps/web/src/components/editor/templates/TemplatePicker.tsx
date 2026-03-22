/**
 * TemplatePicker.tsx — Shown for empty documents. Displays templates in a grid.
 * Uses Lucide icons instead of emoji for a polished look.
 */
import { useState, useEffect } from 'react';
import {
  ChevronDown, ChevronUp, FileText, Library, BookOpen, ShieldCheck,
  Users, CalendarDays, ScrollText, HelpCircle, Map, Swords, File,
} from 'lucide-react';
import type { Block, DocumentTemplate } from '@gratonite/types/api';
import { BUILTIN_TEMPLATES } from './builtinTemplates';
import { apiFetch } from '../../../lib/api/_core';

/** Map template icon key → Lucide component. */
const TEMPLATE_ICONS: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  'library': Library,
  'book-open': BookOpen,
  'shield-check': ShieldCheck,
  'users': Users,
  'calendar-days': CalendarDays,
  'scroll-text': ScrollText,
  'help-circle': HelpCircle,
  'map': Map,
  'swords': Swords,
  'file-text': FileText,
};

function TemplateIcon({ name, size = 22 }: { name: string; size?: number }) {
  const Icon = TEMPLATE_ICONS[name] || File;
  return <Icon size={size} />;
}

interface TemplatePickerProps {
  guildId?: string;
  onSelect: (blocks: Block[]) => void;
}

export default function TemplatePicker({ guildId, onSelect }: TemplatePickerProps) {
  const [expanded, setExpanded] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<DocumentTemplate[]>([]);

  useEffect(() => {
    if (!guildId) return;
    (async () => {
      try {
        const res = await apiFetch(`/guilds/${guildId}/document-templates`);
        if (Array.isArray(res)) setCustomTemplates(res);
      } catch { /* ignore */ }
    })();
  }, [guildId]);

  const visibleBuiltin = expanded ? BUILTIN_TEMPLATES : BUILTIN_TEMPLATES.slice(0, 4);

  return (
    <div style={{
      maxWidth: 640, margin: '40px auto', padding: '0 16px',
    }}>
      <div style={{
        textAlign: 'center', marginBottom: 32,
      }}>
        <FileText size={48} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
          Start with a template
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: 6 }}>
          Choose a template to get started, or start from scratch
        </p>
      </div>

      {/* Built-in templates grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 12,
      }}>
        {visibleBuiltin.map(t => (
          <button
            key={t.key}
            onClick={() => onSelect(JSON.parse(JSON.stringify(t.blocks)))}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)', borderRadius: 10,
              cursor: 'pointer', textAlign: 'left',
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-primary)';
              (e.currentTarget as HTMLElement).style.background = 'rgba(124, 92, 252, 0.06)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
              (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)';
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(124, 92, 252, 0.1)', color: 'var(--accent-primary)',
              flexShrink: 0,
            }}>
              <TemplateIcon name={t.icon} size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                {t.name}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                {t.description}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Show all / Show less */}
      {BUILTIN_TEMPLATES.length > 4 && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            margin: '12px auto 0', background: 'none', border: 'none',
            cursor: 'pointer', color: 'var(--text-muted)', fontSize: 'var(--text-sm)',
          }}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'Show less' : `Show all ${BUILTIN_TEMPLATES.length} templates`}
        </button>
      )}

      {/* Custom templates */}
      {customTemplates.length > 0 && (
        <>
          <div style={{
            fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase',
            color: 'var(--text-muted)', marginTop: 24, marginBottom: 8,
            letterSpacing: '0.05em',
          }}>
            Custom Templates
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {customTemplates.map(t => (
              <button
                key={t.id}
                onClick={() => onSelect(JSON.parse(JSON.stringify(t.blocks)))}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px', background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)', borderRadius: 10,
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(124, 92, 252, 0.1)', color: 'var(--accent-primary)',
                  flexShrink: 0,
                }}>
                  <TemplateIcon name={t.icon || 'file-text'} size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{t.name}</div>
                  {t.description && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>{t.description}</div>}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
