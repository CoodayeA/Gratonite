import { useState, useEffect, useId } from 'react';
import { Plus, Trash2, GripVertical, Hash, BookOpen, Link2, MessageSquare, ChevronUp, ChevronDown, Save, Eye, EyeOff } from 'lucide-react';
import { api } from '../../lib/api';

interface WelcomeBlock {
  type: 'welcome_message' | 'channels' | 'rules' | 'links';
  title?: string;
  content?: string;
  channelIds?: string[];
  links?: { label: string; url: string }[];
}

interface Props {
  guildId: string;
  channels?: Array<{ id: string; name: string; type: string }>;
}

const BLOCK_TYPES = [
  { type: 'welcome_message' as const, label: 'Welcome Message', icon: MessageSquare, color: '#3b82f6' },
  { type: 'channels' as const, label: 'Recommended Channels', icon: Hash, color: '#22c55e' },
  { type: 'rules' as const, label: 'Rules Summary', icon: BookOpen, color: '#f59e0b' },
  { type: 'links' as const, label: 'Resource Links', icon: Link2, color: '#8b5cf6' },
];

export default function WelcomeScreenBuilder({ guildId, channels = [] }: Props) {
  const descriptionId = useId();
  const [enabled, setEnabled] = useState(false);
  const [description, setDescription] = useState('');
  const [blocks, setBlocks] = useState<WelcomeBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    api.welcomeScreen.get(guildId)
      .then((data: any) => {
        setEnabled(data.enabled ?? false);
        setDescription(data.description ?? '');
        setBlocks(Array.isArray(data.blocks) ? data.blocks : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [guildId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.welcomeScreen.update(guildId, { enabled, description, blocks } as any);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const addBlock = (type: WelcomeBlock['type']) => {
    const newBlock: WelcomeBlock = { type };
    if (type === 'welcome_message') {
      newBlock.title = 'Welcome!';
      newBlock.content = 'Welcome to our server! We\'re glad you\'re here.';
    } else if (type === 'channels') {
      newBlock.title = 'Start Here';
      newBlock.channelIds = [];
    } else if (type === 'rules') {
      newBlock.title = 'Server Rules';
      newBlock.content = '';
    } else if (type === 'links') {
      newBlock.title = 'Resources';
      newBlock.links = [];
    }
    setBlocks([...blocks, newBlock]);
  };

  const removeBlock = (index: number) => {
    setBlocks(blocks.filter((_, i) => i !== index));
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= blocks.length) return;
    const newBlocks = [...blocks];
    [newBlocks[index], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[index]];
    setBlocks(newBlocks);
  };

  const updateBlock = (index: number, updates: Partial<WelcomeBlock>) => {
    setBlocks(blocks.map((b, i) => i === index ? { ...b, ...updates } : b));
  };

  if (loading) {
    return <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading welcome screen...</p>;
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>Welcome Screen</h3>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
            Customize what new members see when they join your server.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setShowPreview(!showPreview)}
            style={{
              padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--stroke)',
              background: showPreview ? 'var(--accent-primary)' : 'transparent',
              color: showPreview ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer', fontSize: '12px', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
            Preview
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '6px 16px', borderRadius: '6px', border: 'none',
              background: 'var(--accent-primary)', color: '#fff',
              cursor: saving ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '4px', opacity: saving ? 0.6 : 1,
            }}
          >
            <Save size={14} /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Enabled toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderRadius: '8px', background: 'var(--bg-elevated)',
        marginBottom: '12px',
      }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Enable Welcome Screen</span>
        <button
          onClick={() => setEnabled(!enabled)}
          style={{
            width: '40px', height: '22px', borderRadius: '11px', border: 'none',
            background: enabled ? 'var(--accent-primary)' : 'rgba(255,255,255,0.15)',
            cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
          }}
        >
          <div style={{
            width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
            position: 'absolute', top: '2px', transition: 'left 0.2s',
            left: enabled ? '20px' : '2px',
          }} />
        </button>
      </div>

      {/* Description */}
      <div style={{ marginBottom: '16px' }}>
        <label htmlFor={descriptionId} style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
          Server Description
        </label>
        <textarea
          id={descriptionId}
          value={description}
          onChange={e => setDescription(e.target.value)}
          maxLength={500}
          placeholder="Tell new members what your server is about..."
          rows={2}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: '8px',
            background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
            color: 'var(--text-primary)', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Preview mode */}
      {showPreview && (
        <div style={{
          padding: '24px', borderRadius: '12px', background: 'var(--bg-elevated)',
          border: '1px solid var(--stroke)', marginBottom: '16px',
        }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center' }}>
            Welcome!
          </h2>
          {description && (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
              {description}
            </p>
          )}
          {blocks.map((block, i) => (
            <div key={i} style={{ marginBottom: '16px', padding: '16px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px' }}>
              {block.title && (
                <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {block.title}
                </h4>
              )}
              {block.type === 'welcome_message' && block.content && (
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{block.content}</p>
              )}
              {block.type === 'channels' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {(block.channelIds || []).map(cId => {
                    const ch = channels.find(c => c.id === cId);
                    return ch ? (
                      <span key={cId} style={{
                        padding: '4px 10px', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.15)',
                        color: 'var(--accent-primary)', fontSize: '12px', fontWeight: 600,
                      }}>
                        # {ch.name}
                      </span>
                    ) : null;
                  })}
                </div>
              )}
              {block.type === 'rules' && block.content && (
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{block.content}</p>
              )}
              {block.type === 'links' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {(block.links || []).map((link, li) => (
                    <a key={li} href={link.url} target="_blank" rel="noopener noreferrer"
                       style={{ color: 'var(--accent-primary)', fontSize: '13px', textDecoration: 'none' }}>
                      {link.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Block editor */}
      {!showPreview && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {blocks.map((block, index) => {
              const blockMeta = BLOCK_TYPES.find(bt => bt.type === block.type)!;
              const Icon = blockMeta.icon;
              return (
                <div key={index} style={{
                  padding: '12px 14px', borderRadius: '10px',
                  background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                }}>
                  {/* Block header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <GripVertical size={14} color="var(--text-muted)" style={{ cursor: 'grab' }} />
                    <Icon size={14} color={blockMeta.color} />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
                      {blockMeta.label}
                    </span>
                    <button onClick={() => moveBlock(index, -1)} disabled={index === 0}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', opacity: index === 0 ? 0.3 : 1 }}>
                      <ChevronUp size={14} />
                    </button>
                    <button onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', opacity: index === blocks.length - 1 ? 0.3 : 1 }}>
                      <ChevronDown size={14} />
                    </button>
                    <button onClick={() => removeBlock(index)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Block title */}
                  <input
                    value={block.title ?? ''}
                    onChange={e => updateBlock(index, { title: e.target.value })}
                    placeholder="Block title"
                    style={{
                      width: '100%', padding: '6px 10px', borderRadius: '6px', marginBottom: '6px',
                      background: 'var(--bg-primary)', border: '1px solid var(--stroke)',
                      color: 'var(--text-primary)', fontSize: '12px', boxSizing: 'border-box',
                    }}
                  />

                  {/* Type-specific content */}
                  {(block.type === 'welcome_message' || block.type === 'rules') && (
                    <textarea
                      value={block.content ?? ''}
                      onChange={e => updateBlock(index, { content: e.target.value })}
                      placeholder={block.type === 'rules' ? 'Enter your server rules...' : 'Enter welcome message...'}
                      rows={3}
                      style={{
                        width: '100%', padding: '6px 10px', borderRadius: '6px',
                        background: 'var(--bg-primary)', border: '1px solid var(--stroke)',
                        color: 'var(--text-primary)', fontSize: '12px', resize: 'vertical', boxSizing: 'border-box',
                      }}
                    />
                  )}

                  {block.type === 'channels' && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {channels.filter(c => c.type === 'TEXT' || c.type === 'text').slice(0, 20).map(ch => {
                        const selected = (block.channelIds || []).includes(ch.id);
                        return (
                          <button
                            key={ch.id}
                            onClick={() => {
                              const ids = block.channelIds || [];
                              updateBlock(index, {
                                channelIds: selected ? ids.filter(id => id !== ch.id) : [...ids, ch.id],
                              });
                            }}
                            style={{
                              padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--stroke)',
                              background: selected ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                              color: selected ? 'var(--accent-primary)' : 'var(--text-muted)',
                              cursor: 'pointer', fontSize: '11px', fontWeight: selected ? 600 : 400,
                            }}
                          >
                            # {ch.name}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {block.type === 'links' && (
                    <div>
                      {(block.links || []).map((link, li) => (
                        <div key={li} style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
                          <input
                            value={link.label}
                            onChange={e => {
                              const newLinks = [...(block.links || [])];
                              newLinks[li] = { ...newLinks[li], label: e.target.value };
                              updateBlock(index, { links: newLinks });
                            }}
                            placeholder="Label"
                            style={{
                              flex: 1, padding: '4px 8px', borderRadius: '4px',
                              background: 'var(--bg-primary)', border: '1px solid var(--stroke)',
                              color: 'var(--text-primary)', fontSize: '11px',
                            }}
                          />
                          <input
                            value={link.url}
                            onChange={e => {
                              const newLinks = [...(block.links || [])];
                              newLinks[li] = { ...newLinks[li], url: e.target.value };
                              updateBlock(index, { links: newLinks });
                            }}
                            placeholder="https://..."
                            style={{
                              flex: 2, padding: '4px 8px', borderRadius: '4px',
                              background: 'var(--bg-primary)', border: '1px solid var(--stroke)',
                              color: 'var(--text-primary)', fontSize: '11px',
                            }}
                          />
                          <button
                            onClick={() => {
                              const newLinks = (block.links || []).filter((_, i) => i !== li);
                              updateBlock(index, { links: newLinks });
                            }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => updateBlock(index, { links: [...(block.links || []), { label: '', url: '' }] })}
                        style={{
                          marginTop: '4px', padding: '4px 10px', borderRadius: '4px',
                          border: '1px dashed var(--stroke)', background: 'transparent',
                          color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px',
                          display: 'flex', alignItems: 'center', gap: '4px',
                        }}
                      >
                        <Plus size={12} /> Add Link
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add block buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
            {BLOCK_TYPES.map(bt => {
              const Icon = bt.icon;
              return (
                <button
                  key={bt.type}
                  onClick={() => addBlock(bt.type)}
                  style={{
                    padding: '10px', borderRadius: '8px',
                    border: '1px dashed var(--stroke)', background: 'transparent',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                    color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 500,
                  }}
                >
                  <Plus size={14} color={bt.color} />
                  <Icon size={14} color={bt.color} />
                  {bt.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
