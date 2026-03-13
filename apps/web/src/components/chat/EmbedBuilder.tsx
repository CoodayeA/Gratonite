import { useState, useCallback } from 'react';
import { Plus, Trash2, Eye, Send, X } from 'lucide-react';

export interface CustomEmbed {
  type: 'rich';
  title?: string;
  description?: string;
  color?: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  image?: string;
  thumbnail?: string;
  footer?: string;
}

interface Props {
  onSend: (embed: CustomEmbed, content?: string) => void;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#5865f2', '#57f287', '#fee75c', '#eb459e', '#ed4245',
  '#f47b67', '#e67e22', '#1abc9c', '#3498db', '#9b59b6',
];

export function EmbedBuilder({ onSend, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#5865f2');
  const [fields, setFields] = useState<Array<{ name: string; value: string; inline: boolean }>>([]);
  const [imageUrl, setImageUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [footer, setFooter] = useState('');
  const [showPreview, setShowPreview] = useState(true);

  const addField = useCallback(() => {
    if (fields.length >= 25) return;
    setFields(prev => [...prev, { name: '', value: '', inline: false }]);
  }, [fields.length]);

  const removeField = useCallback((index: number) => {
    setFields(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateField = useCallback((index: number, key: 'name' | 'value' | 'inline', val: string | boolean) => {
    setFields(prev => prev.map((f, i) => i === index ? { ...f, [key]: val } : f));
  }, []);

  const handleSend = useCallback(() => {
    const embed: CustomEmbed = { type: 'rich' };
    if (title.trim()) embed.title = title.trim();
    if (description.trim()) embed.description = description.trim();
    if (color) embed.color = color;
    if (fields.length > 0) {
      const validFields = fields.filter(f => f.name.trim() && f.value.trim());
      if (validFields.length > 0) embed.fields = validFields;
    }
    if (imageUrl.trim()) embed.image = imageUrl.trim();
    if (thumbnailUrl.trim()) embed.thumbnail = thumbnailUrl.trim();
    if (footer.trim()) embed.footer = footer.trim();

    if (!embed.title && !embed.description && !embed.fields) return;
    onSend(embed);
  }, [title, description, color, fields, imageUrl, thumbnailUrl, footer, onSend]);

  const canSend = title.trim() || description.trim() || fields.some(f => f.name.trim() && f.value.trim());

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', background: 'var(--bg-tertiary)',
    border: '1px solid var(--stroke)', borderRadius: '6px', color: 'var(--text-primary)',
    fontSize: '13px', outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
    letterSpacing: '0.5px', marginBottom: '4px', display: 'block',
  };

  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px',
      margin: '0 16px 8px', overflow: 'hidden', maxHeight: '400px', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid var(--stroke)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--bg-tertiary)',
      }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Embed Builder</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={() => setShowPreview(p => !p)} style={{ background: 'transparent', border: 'none', color: showPreview ? 'var(--accent-primary)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '4px' }} title="Toggle Preview">
            <Eye size={16} />
          </button>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '4px' }} title="Close">
            <X size={16} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {/* Form */}
        <div style={{ flex: 1, padding: '12px 14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Color */}
          <div>
            <span style={labelStyle}>Color</span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} style={{
                  width: '22px', height: '22px', borderRadius: '50%', background: c,
                  border: color === c ? '2px solid white' : '2px solid transparent',
                  cursor: 'pointer', boxShadow: color === c ? `0 0 0 1px ${c}` : 'none',
                }} />
              ))}
              <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: '22px', height: '22px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }} />
            </div>
          </div>

          {/* Title */}
          <div>
            <span style={labelStyle}>Title</span>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Embed title" maxLength={256} style={inputStyle} />
          </div>

          {/* Description */}
          <div>
            <span style={labelStyle}>Description</span>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Embed description (supports markdown)" maxLength={4096} rows={3}
              style={{ ...inputStyle, resize: 'vertical', minHeight: '60px' }} />
          </div>

          {/* Fields */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={labelStyle}>Fields</span>
              <button onClick={addField} disabled={fields.length >= 25} style={{
                background: 'transparent', border: 'none', color: fields.length >= 25 ? 'var(--text-muted)' : 'var(--accent-primary)',
                cursor: fields.length >= 25 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600,
              }}>
                <Plus size={12} /> Add Field
              </button>
            </div>
            {fields.map((field, i) => (
              <div key={i} style={{ display: 'flex', gap: '6px', marginTop: '6px', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <input type="text" value={field.name} onChange={e => updateField(i, 'name', e.target.value)} placeholder="Name" maxLength={256} style={{ ...inputStyle, padding: '6px 8px' }} />
                  <input type="text" value={field.value} onChange={e => updateField(i, 'value', e.target.value)} placeholder="Value" maxLength={1024} style={{ ...inputStyle, padding: '6px 8px' }} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap', marginTop: '6px' }}>
                  <input type="checkbox" checked={field.inline} onChange={e => updateField(i, 'inline', e.target.checked)} style={{ accentColor: 'var(--accent-primary)' }} /> Inline
                </label>
                <button onClick={() => removeField(i)} style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '6px', marginTop: '2px' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Image & Thumbnail */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <span style={labelStyle}>Image URL</span>
              <input type="text" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." style={inputStyle} />
            </div>
            <div>
              <span style={labelStyle}>Thumbnail URL</span>
              <input type="text" value={thumbnailUrl} onChange={e => setThumbnailUrl(e.target.value)} placeholder="https://..." style={inputStyle} />
            </div>
          </div>

          {/* Footer */}
          <div>
            <span style={labelStyle}>Footer</span>
            <input type="text" value={footer} onChange={e => setFooter(e.target.value)} placeholder="Footer text" maxLength={2048} style={inputStyle} />
          </div>

          {/* Send */}
          <button onClick={handleSend} disabled={!canSend} style={{
            width: '100%', padding: '10px', background: canSend ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
            border: 'none', borderRadius: '8px', color: canSend ? 'white' : 'var(--text-muted)',
            fontWeight: 700, fontSize: '13px', cursor: canSend ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}>
            <Send size={14} /> Send Embed
          </button>
        </div>

        {/* Live Preview */}
        {showPreview && (
          <div style={{ width: '240px', borderLeft: '1px solid var(--stroke)', padding: '12px', overflowY: 'auto', background: 'var(--bg-secondary)' }}>
            <span style={{ ...labelStyle, marginBottom: '8px' }}>Preview</span>
            <div style={{
              borderLeft: `3px solid ${color}`, borderRadius: '4px',
              background: 'var(--bg-tertiary)', padding: '10px', fontSize: '13px',
            }}>
              {title && <div style={{ fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '4px', fontSize: '14px' }}>{title}</div>}
              {description && <div style={{ color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '6px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{description}</div>}
              {fields.filter(f => f.name.trim()).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                  {fields.filter(f => f.name.trim()).map((f, i) => (
                    <div key={i} style={{ flex: f.inline ? '1 0 30%' : '1 0 100%', minWidth: 0 }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '2px' }}>{f.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-primary)', wordBreak: 'break-word' }}>{f.value}</div>
                    </div>
                  ))}
                </div>
              )}
              {imageUrl && <img src={imageUrl} alt="" style={{ width: '100%', borderRadius: '4px', marginTop: '4px', maxHeight: '100px', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
              {footer && <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', borderTop: '1px solid var(--stroke)', paddingTop: '4px' }}>{footer}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
