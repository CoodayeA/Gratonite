/**
 * BlockNoteEditor.tsx — Notion-style block editor powered by BlockNote.
 *
 * Features: real-time Yjs collaboration via Socket.io, auto-save,
 * template picker for empty docs, dark theme, read-only mode.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import * as Y from 'yjs';
import { Save, Loader2, Users } from 'lucide-react';
import type { Block } from '@blocknote/core';
import { apiFetch } from '../../lib/api/_core';
import {
  emitOrQueue, joinChannel, leaveChannel,
  onDocumentPresenceUpdate, onDocumentTitleUpdate,
} from '../../lib/socket';
import { useUser } from '../../contexts/UserContext';
import Avatar from '../ui/Avatar';
import TemplatePicker from './templates/TemplatePicker';

const AUTO_SAVE_MS = 5000;
const CURSOR_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#e91e63', '#00bcd4', '#8bc34a',
];

function getUserColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

interface BlockNoteEditorProps {
  channelId: string;
  channelName: string;
  guildId?: string;
  readOnly?: boolean;
}

/** Yjs provider that transports updates via Socket.io. */
class SocketYjsProvider {
  doc: Y.Doc;
  channelId: string;
  awareness: null;
  synced = false;
  private onUpdateBound: (update: Uint8Array, origin: any) => void;

  constructor(doc: Y.Doc, channelId: string) {
    this.doc = doc;
    this.channelId = channelId;
    this.awareness = null;

    this.onUpdateBound = (update: Uint8Array, origin: any) => {
      if (origin === 'remote') return;
      const b64 = btoa(String.fromCharCode(...update));
      emitOrQueue('DOCUMENT_UPDATE', { channelId, update: b64 });
    };

    doc.on('update', this.onUpdateBound);
  }

  applyRemoteUpdate(b64: string) {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    Y.applyUpdate(this.doc, bytes, 'remote');
  }

  destroy() {
    this.doc.off('update', this.onUpdateBound);
  }
}

export default function BlockNoteEditor({ channelId, channelName, guildId, readOnly = false }: BlockNoteEditorProps) {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [initialBlocks, setInitialBlocks] = useState<Block[] | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [title, setTitle] = useState('Untitled');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editors, setEditors] = useState<Array<{ id: string; username: string; avatarHash: string | null }>>([]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<any>(null);
  const blocksRef = useRef<Block[]>([]);
  const isDirtyRef = useRef(false);

  // Load document
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const doc = await apiFetch(`/channels/${channelId}/document`) as any;
        if (cancelled) return;
        setTitle(doc.title || 'Untitled');

        if (doc.blocks && Array.isArray(doc.blocks) && doc.blocks.length > 0) {
          setInitialBlocks(doc.blocks);
        } else {
          setShowTemplatePicker(true);
          setInitialBlocks([]);
        }
      } catch {
        if (!cancelled) {
          setInitialBlocks([]);
          setShowTemplatePicker(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [channelId]);

  // Create editor once we have initial blocks
  const editor = useCreateBlockNote(
    {
      initialContent: initialBlocks && initialBlocks.length > 0 ? initialBlocks : undefined,
    },
    [initialBlocks],
  );

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Socket: join/leave channel for presence
  useEffect(() => {
    joinChannel(channelId);
    emitOrQueue('DOCUMENT_JOIN', { channelId });

    // Load presence
    apiFetch(`/channels/${channelId}/document/presence`)
      .then((res: any) => { if (Array.isArray(res)) setEditors(res); })
      .catch(() => {});

    return () => {
      emitOrQueue('DOCUMENT_LEAVE', { channelId });
      leaveChannel(channelId);
    };
  }, [channelId]);

  // Socket: presence updates
  useEffect(() => {
    return onDocumentPresenceUpdate((payload) => {
      if (payload.channelId !== channelId) return;
      if (payload.action === 'join' && payload.user) {
        setEditors(prev => {
          if (prev.some(e => e.id === payload.user.userId)) return prev;
          return [...prev, { id: payload.user.userId, username: payload.user.username || 'User', avatarHash: payload.user.avatarHash || null }];
        });
      } else if (payload.action === 'leave' && payload.user) {
        setEditors(prev => prev.filter(e => e.id !== payload.user.userId));
      }
    });
  }, [channelId]);

  // Socket: remote title updates
  useEffect(() => {
    return onDocumentTitleUpdate((payload) => {
      if (payload.channelId !== channelId) return;
      setTitle(payload.title);
    });
  }, [channelId]);

  // Save function
  const save = useCallback(async () => {
    if (readOnly || !isDirtyRef.current || !editorRef.current) return;
    setIsSaving(true);
    try {
      const blocks = editorRef.current.document;
      await apiFetch(`/channels/${channelId}/document`, {
        method: 'PUT',
        body: JSON.stringify({ title, blocks }),
      });
      setIsDirty(false);
      isDirtyRef.current = false;
    } catch (err) {
      console.error('[BlockNoteEditor] Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  }, [channelId, title, readOnly]);

  // Auto-save
  useEffect(() => {
    if (!isDirty || readOnly) return;
    saveTimerRef.current = setTimeout(save, AUTO_SAVE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [isDirty, save, readOnly]);

  // Save on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (isDirtyRef.current && !readOnly && editorRef.current) {
        const blocks = editorRef.current.document;
        apiFetch(`/channels/${channelId}/document`, {
          method: 'PUT',
          body: JSON.stringify({ blocks }),
        }).catch(() => {});
      }
    };
  }, [channelId, readOnly]);

  // onChange handler
  const handleChange = useCallback(() => {
    setIsDirty(true);
    isDirtyRef.current = true;
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [save]);

  // Handle template selection
  const handleTemplateSelect = useCallback(async (templateBlocks: Block[]) => {
    setShowTemplatePicker(false);
    if (editorRef.current && templateBlocks.length > 0) {
      editorRef.current.replaceBlocks(editorRef.current.document, templateBlocks);
    }
    // Save immediately
    try {
      await apiFetch(`/channels/${channelId}/document`, {
        method: 'PUT',
        body: JSON.stringify({ blocks: templateBlocks.length > 0 ? templateBlocks : [] }),
      });
    } catch { /* ignore */ }
  }, [channelId]);

  // Title change
  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    setIsDirty(true);
    isDirtyRef.current = true;
    emitOrQueue('DOCUMENT_TITLE_UPDATE', { channelId, title: e.target.value });
  }, [channelId]);

  const handleTitleBlur = useCallback(() => {
    apiFetch(`/channels/${channelId}/document`, {
      method: 'PUT',
      body: JSON.stringify({ title }),
    }).catch(() => {});
  }, [channelId, title]);

  if (loading || initialBlocks === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
        <Loader2 size={24} className="animate-spin" />
        <span style={{ marginLeft: 8 }}>Loading document...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isDirty && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              {isSaving ? 'Saving...' : 'Unsaved changes'}
            </span>
          )}
          {!isDirty && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Saved</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Presence avatars */}
          {editors.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Users size={14} style={{ color: 'var(--text-muted)', marginRight: 4 }} />
              {editors.slice(0, 5).map(ed => (
                <div key={ed.id} title={ed.username} style={{
                  width: 26, height: 26, borderRadius: '50%',
                  border: `2px solid ${getUserColor(ed.id)}`,
                  overflow: 'hidden', flexShrink: 0,
                }}>
                  <Avatar userId={ed.id} avatarHash={ed.avatarHash} displayName={ed.username} size={22} />
                </div>
              ))}
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {editors.length} editing
              </span>
            </div>
          )}
          {!readOnly && (
            <button
              onClick={save}
              disabled={!isDirty}
              style={{
                background: isDirty ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                border: 'none', borderRadius: 6, padding: '5px 12px',
                cursor: isDirty ? 'pointer' : 'default',
                color: isDirty ? 'white' : 'var(--text-muted)',
                fontSize: 'var(--text-xs)', fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 4,
              }}
              title="Save (Ctrl+S)"
            >
              <Save size={13} /> Save
            </button>
          )}
        </div>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0' }}>
        <div style={{ maxWidth: 900, width: '100%', margin: '0 auto', padding: '0 48px' }}>
          {/* Title */}
          {!readOnly ? (
            <input
              value={title}
              onChange={handleTitleChange}
              onBlur={handleTitleBlur}
              placeholder="Untitled"
              style={{
                width: '100%', background: 'none', border: 'none', outline: 'none',
                fontSize: 'var(--text-4xl)', fontWeight: 700, color: 'var(--text-primary)',
                marginBottom: 16, padding: 0, fontFamily: 'inherit',
              }}
            />
          ) : (
            <h1 style={{ fontSize: 'var(--text-4xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
              {title || 'Untitled'}
            </h1>
          )}

          {/* Template picker or editor */}
          {showTemplatePicker && !readOnly ? (
            <TemplatePicker guildId={guildId} onSelect={handleTemplateSelect} />
          ) : (
            <BlockNoteView
              editor={editor}
              editable={!readOnly}
              onChange={handleChange}
              theme="dark"
            />
          )}
        </div>
      </div>
    </div>
  );
}
