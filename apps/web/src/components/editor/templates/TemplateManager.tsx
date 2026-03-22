/**
 * TemplateManager.tsx — Admin CRUD for custom document templates in guild settings.
 */
import { useState, useEffect } from 'react';
import { Trash2, FileText, File } from 'lucide-react';
import type { DocumentTemplate } from '@gratonite/types/api';
import { apiFetch } from '../../../lib/api/_core';

interface TemplateManagerProps {
  guildId: string;
}

export default function TemplateManager({ guildId }: TemplateManagerProps) {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(`/guilds/${guildId}/document-templates`);
        if (Array.isArray(res)) setTemplates(res as DocumentTemplate[]);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [guildId]);

  const deleteTemplate = async (id: string) => {
    try {
      await apiFetch(`/guilds/${guildId}/document-templates/${id}`, { method: 'DELETE' });
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch { /* ignore */ }
  };

  if (loading) {
    return <div style={{ color: 'var(--text-muted)', padding: 16 }}>Loading templates...</div>;
  }

  const custom = templates.filter(t => !t.isBuiltin);

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', color: 'var(--text-primary)' }}>
          Document Templates
        </h3>
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: 16 }}>
        Custom templates created from documents. Members can use these when creating new document channels.
      </p>

      {custom.length === 0 ? (
        <div style={{
          padding: '24px 16px', textAlign: 'center',
          border: '1px dashed var(--border)', borderRadius: 8,
          color: 'var(--text-muted)', fontSize: 'var(--text-sm)',
        }}>
          <FileText size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
          <div>No custom templates yet</div>
          <div style={{ fontSize: 'var(--text-xs)', marginTop: 4 }}>
            Use "Save as Template" from any document to create one
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {custom.map(t => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', background: 'var(--bg-tertiary)',
              borderRadius: 8, border: '1px solid var(--border)',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(124, 92, 252, 0.1)', color: 'var(--accent-primary)',
                flexShrink: 0,
              }}>
                <File size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{t.name}</div>
                {t.description && (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{t.description}</div>
                )}
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                  Used {t.usageCount} times
                </div>
              </div>
              <button
                onClick={() => deleteTemplate(t.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--error, #ed4245)', padding: 4,
                }}
                title="Delete template"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
