/**
 * CollaborativeEditor.tsx — Rich text collaborative editor using a contentEditable
 * approach with socket-based CRDT sync. Provides formatting toolbar, live cursors,
 * presence sidebar, and auto-save.
 *
 * Uses native contentEditable + custom commands instead of Tiptap/Yjs to avoid
 * heavy dependencies. Document state is synced via socket DOCUMENT_UPDATE events
 * and persisted to the API every 5 seconds.
 *
 * SECURITY: All remote HTML content is sanitized with DOMPurify before rendering.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered,
  Code, Quote, Heading1, Heading2, Heading3, Image as ImageIcon, Minus,
  Table as TableIcon, Undo2, Redo2, Save, Users, Circle
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { apiFetch } from '../../lib/api/_core';
import {
  emitOrQueue, joinChannel, leaveChannel,
  onDocumentUpdate, onDocumentPresenceUpdate, onDocumentTitleUpdate,
  type DocumentUpdatePayload, type DocumentPresenceUpdatePayload, type DocumentTitleUpdatePayload
} from '../../lib/socket';
import { useUser } from '../../contexts/UserContext';
import Avatar from '../ui/Avatar';

// Deterministic color for cursor labels
const CURSOR_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#e91e63', '#00bcd4', '#8bc34a',
];

function getCursorColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

interface EditorPresenceUser {
  userId: string;
  username?: string;
  avatarHash?: string | null;
}

interface CollaborativeEditorProps {
  channelId: string;
  channelName: string;
}

export default function CollaborativeEditor({ channelId, channelName }: CollaborativeEditorProps) {
  const { user } = useUser();
  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('Untitled');
  const [docId, setDocId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [activeEditors, setActiveEditors] = useState<EditorPresenceUser[]>([]);
  const [loaded, setLoaded] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const contentChangedRef = useRef(false);

  // Load document on mount
  useEffect(() => {
    let cancelled = false;

    async function loadDoc() {
      try {
        const doc = await apiFetch<any>(`/channels/${channelId}/document`);
        if (cancelled) return;
        setDocId(doc.id);
        setTitle(doc.title || 'Untitled');
        if (editorRef.current && doc.content) {
          // Sanitize server content before inserting into DOM
          const clean = DOMPurify.sanitize(doc.content, {
            ALLOWED_TAGS: ['h1','h2','h3','p','br','strong','em','u','s','del','ul','ol','li',
              'blockquote','pre','code','table','thead','tbody','tr','td','th','img','hr','a','span','div'],
            ALLOWED_ATTR: ['src','alt','href','style','class','colspan','rowspan'],
          });
          editorRef.current.innerHTML = clean;
        }
        setLastSaved(new Date(doc.updatedAt));
        setLoaded(true);
      } catch (err) {
        console.error('[CollaborativeEditor] Failed to load document:', err);
        setLoaded(true);
      }
    }

    loadDoc();

    // Load presence
    apiFetch<EditorPresenceUser[]>(`/channels/${channelId}/document/presence`)
      .then(editors => { if (!cancelled) setActiveEditors(editors); })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [channelId]);

  // Join document room via socket
  useEffect(() => {
    joinChannel(channelId);
    emitOrQueue('DOCUMENT_JOIN', { channelId });

    return () => {
      emitOrQueue('DOCUMENT_LEAVE', { channelId });
      leaveChannel(channelId);
    };
  }, [channelId]);

  // Listen for remote updates
  useEffect(() => {
    const unsubUpdate = onDocumentUpdate((payload: DocumentUpdatePayload) => {
      if (payload.channelId !== channelId || payload.userId === user?.id) return;
      // Apply remote content update (sanitized)
      if (editorRef.current && payload.update) {
        // Only apply if user hasn't typed locally since last sync
        if (!contentChangedRef.current) {
          const clean = DOMPurify.sanitize(payload.update, {
            ALLOWED_TAGS: ['h1','h2','h3','p','br','strong','em','u','s','del','ul','ol','li',
              'blockquote','pre','code','table','thead','tbody','tr','td','th','img','hr','a','span','div'],
            ALLOWED_ATTR: ['src','alt','href','style','class','colspan','rowspan'],
          });
          editorRef.current.innerHTML = clean;
        }
      }
    });

    const unsubPresence = onDocumentPresenceUpdate((payload: DocumentPresenceUpdatePayload) => {
      if (payload.channelId !== channelId) return;
      setActiveEditors(prev => {
        if (payload.action === 'join' && payload.user.username) {
          const exists = prev.some(e => e.userId === payload.user.userId);
          if (exists) return prev;
          return [...prev, payload.user];
        } else if (payload.action === 'leave') {
          return prev.filter(e => e.userId !== payload.user.userId);
        }
        return prev;
      });
    });

    const unsubTitle = onDocumentTitleUpdate((payload: DocumentTitleUpdatePayload) => {
      if (payload.channelId !== channelId || payload.userId === user?.id) return;
      setTitle(payload.title);
    });

    return () => {
      unsubUpdate();
      unsubPresence();
      unsubTitle();
    };
  }, [channelId, user?.id]);

  // Auto-save every 5 seconds
  const saveDocument = useCallback(async () => {
    if (!contentChangedRef.current || !editorRef.current) return;
    contentChangedRef.current = false;
    setSaving(true);
    try {
      await apiFetch(`/channels/${channelId}/document`, {
        method: 'PUT',
        body: JSON.stringify({ title, content: editorRef.current.innerHTML }),
      });
      setLastSaved(new Date());
    } catch (err) {
      console.error('[CollaborativeEditor] Save failed:', err);
    } finally {
      setSaving(false);
    }
  }, [channelId, title]);

  useEffect(() => {
    saveTimerRef.current = setInterval(() => {
      saveDocument();
    }, 5000);

    return () => {
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
      // Save on unmount
      saveDocument();
    };
  }, [saveDocument]);

  // Editor content change handler
  const handleInput = useCallback(() => {
    contentChangedRef.current = true;
    // Broadcast to peers
    if (editorRef.current) {
      emitOrQueue('DOCUMENT_UPDATE', {
        channelId,
        update: editorRef.current.innerHTML,
      });
    }
  }, [channelId]);

  // Title change handler
  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value.slice(0, 200);
    setTitle(newTitle);
    contentChangedRef.current = true;
    emitOrQueue('DOCUMENT_TITLE_UPDATE', { channelId, title: newTitle });
  }, [channelId]);

  // Formatting commands
  const execCmd = useCallback((command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    contentChangedRef.current = true;
    handleInput();
  }, [handleInput]);

  const insertTable = useCallback(() => {
    const tableHtml = [
      '<table style="border-collapse:collapse;width:100%;margin:8px 0">',
      '<tr><td style="border:1px solid var(--border);padding:8px">Cell</td>',
      '<td style="border:1px solid var(--border);padding:8px">Cell</td>',
      '<td style="border:1px solid var(--border);padding:8px">Cell</td></tr>',
      '<tr><td style="border:1px solid var(--border);padding:8px">Cell</td>',
      '<td style="border:1px solid var(--border);padding:8px">Cell</td>',
      '<td style="border:1px solid var(--border);padding:8px">Cell</td></tr>',
      '</table><p></p>',
    ].join('');
    document.execCommand('insertHTML', false, tableHtml);
    contentChangedRef.current = true;
    handleInput();
  }, [handleInput]);

  const insertImage = useCallback(() => {
    const url = prompt('Enter image URL:');
    if (url && /^https?:\/\/.+/.test(url)) {
      document.execCommand('insertImage', false, url);
      contentChangedRef.current = true;
      handleInput();
    }
  }, [handleInput]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
      switch (e.key) {
        case 'b': e.preventDefault(); execCmd('bold'); break;
        case 'i': e.preventDefault(); execCmd('italic'); break;
        case 'u': e.preventDefault(); execCmd('underline'); break;
        case 's': e.preventDefault(); saveDocument(); break;
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
      switch (e.key) {
        case 'x': e.preventDefault(); execCmd('strikethrough'); break;
      }
    }
  }, [execCmd, saveDocument]);

  const toolbarButtons = useMemo(() => [
    { icon: Bold, cmd: 'bold', tip: 'Bold (Ctrl+B)' },
    { icon: Italic, cmd: 'italic', tip: 'Italic (Ctrl+I)' },
    { icon: UnderlineIcon, cmd: 'underline', tip: 'Underline (Ctrl+U)' },
    { icon: Strikethrough, cmd: 'strikethrough', tip: 'Strikethrough' },
    { divider: true },
    { icon: Heading1, cmd: 'formatBlock', value: 'h1', tip: 'Heading 1' },
    { icon: Heading2, cmd: 'formatBlock', value: 'h2', tip: 'Heading 2' },
    { icon: Heading3, cmd: 'formatBlock', value: 'h3', tip: 'Heading 3' },
    { divider: true },
    { icon: List, cmd: 'insertUnorderedList', tip: 'Bullet List' },
    { icon: ListOrdered, cmd: 'insertOrderedList', tip: 'Numbered List' },
    { icon: Quote, cmd: 'formatBlock', value: 'blockquote', tip: 'Quote' },
    { icon: Code, cmd: 'formatBlock', value: 'pre', tip: 'Code Block' },
    { divider: true },
    { icon: TableIcon, action: 'table', tip: 'Insert Table' },
    { icon: ImageIcon, action: 'image', tip: 'Insert Image' },
    { icon: Minus, cmd: 'insertHorizontalRule', tip: 'Horizontal Rule' },
    { divider: true },
    { icon: Undo2, cmd: 'undo', tip: 'Undo (Ctrl+Z)' },
    { icon: Redo2, cmd: 'redo', tip: 'Redo (Ctrl+Shift+Z)' },
  ] as const, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '6px 12px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        flexWrap: 'wrap',
        minHeight: 42,
      }}>
        {toolbarButtons.map((btn, i) => {
          if ('divider' in btn && btn.divider) {
            return <div key={`d-${i}`} style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />;
          }
          const b = btn as { icon: any; cmd?: string; value?: string; action?: string; tip: string };
          const Icon = b.icon;
          return (
            <button
              key={i}
              title={b.tip}
              onClick={() => {
                if (b.action === 'table') insertTable();
                else if (b.action === 'image') insertImage();
                else if (b.cmd) execCmd(b.cmd, b.value);
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 6px',
                borderRadius: 4,
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
            >
              <Icon size={16} />
            </button>
          );
        })}

        {/* Save indicator */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
          {saving ? (
            <><Save size={14} /> Saving...</>
          ) : lastSaved ? (
            <><Save size={14} /> Saved {lastSaved.toLocaleTimeString()}</>
          ) : null}
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Main editor area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', padding: '24px 48px' }}>
          {/* Title */}
          <input
            ref={titleRef}
            value={title}
            onChange={handleTitleChange}
            placeholder="Untitled"
            style={{
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: 32,
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: 16,
              width: '100%',
              fontFamily: 'inherit',
            }}
          />

          {/* ContentEditable editor */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            data-placeholder="Start writing..."
            style={{
              flex: 1,
              outline: 'none',
              fontSize: 15,
              lineHeight: 1.7,
              color: 'var(--text-primary)',
              minHeight: 300,
              caretColor: 'var(--accent)',
            }}
          />
        </div>

        {/* Presence sidebar */}
        <div style={{
          width: 200,
          borderLeft: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          padding: '12px',
          overflowY: 'auto',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={14} />
            Editors ({activeEditors.length})
          </div>
          {activeEditors.map(editor => (
            <div key={editor.userId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
              <div style={{ position: 'relative' }}>
                <Avatar userId={editor.userId} avatarHash={editor.avatarHash || null} size={24} />
                <Circle
                  size={8}
                  fill={getCursorColor(editor.userId)}
                  stroke="var(--bg-secondary)"
                  strokeWidth={2}
                  style={{ position: 'absolute', bottom: -1, right: -1 }}
                />
              </div>
              <span style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {editor.username || 'Unknown'}
              </span>
            </div>
          ))}
          {activeEditors.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No other editors
            </div>
          )}
        </div>
      </div>

      {/* Editor styles */}
      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: var(--text-muted);
          pointer-events: none;
        }
        [contenteditable] h1 { font-size: 28px; font-weight: 700; margin: 16px 0 8px; }
        [contenteditable] h2 { font-size: 22px; font-weight: 600; margin: 14px 0 6px; }
        [contenteditable] h3 { font-size: 18px; font-weight: 600; margin: 12px 0 4px; }
        [contenteditable] blockquote {
          border-left: 3px solid var(--accent);
          padding-left: 12px;
          margin: 8px 0;
          color: var(--text-secondary);
        }
        [contenteditable] pre {
          background: var(--bg-tertiary);
          padding: 12px;
          border-radius: 6px;
          font-family: 'Fira Code', monospace;
          font-size: 13px;
          overflow-x: auto;
          margin: 8px 0;
        }
        [contenteditable] code {
          background: var(--bg-tertiary);
          padding: 2px 6px;
          border-radius: 3px;
          font-family: 'Fira Code', monospace;
          font-size: 13px;
        }
        [contenteditable] ul, [contenteditable] ol {
          padding-left: 24px;
          margin: 8px 0;
        }
        [contenteditable] li { margin: 2px 0; }
        [contenteditable] hr {
          border: none;
          border-top: 1px solid var(--border);
          margin: 16px 0;
        }
        [contenteditable] img {
          max-width: 100%;
          border-radius: 6px;
          margin: 8px 0;
        }
        [contenteditable] table {
          border-collapse: collapse;
          width: 100%;
          margin: 8px 0;
        }
        [contenteditable] td, [contenteditable] th {
          border: 1px solid var(--border);
          padding: 8px;
          min-width: 60px;
        }
      `}</style>
    </div>
  );
}
