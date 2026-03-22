/**
 * BlockEditor.tsx — Main Notion-style block editor component.
 * Replaces CollaborativeEditor for GUILD_DOCUMENT channels.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { Save, Undo2, Redo2, Loader2 } from 'lucide-react';
import type { Block, BlockType } from '@gratonite/types/api';
import { BlockEditorCtx, type EditorContextValue } from './BlockEditorContext';
import { useBlockEditor } from './hooks/useBlockEditor';
import BlockRenderer from './blocks/BlockRenderer';
import SlashCommandMenu from './menus/SlashCommandMenu';
import BlockActionMenu from './menus/BlockActionMenu';
import TurnIntoMenu from './menus/TurnIntoMenu';
import InlineToolbar from './inline/InlineToolbar';
import TemplatePicker from './templates/TemplatePicker';
import PresenceSidebar from './presence/PresenceSidebar';
import { htmlToBlocks } from './utils/htmlToBlocks';
import { splitBlock, mergeBlocks, getBlockRichText, toPlainText, isBlockEmpty } from './utils/blockHelpers';
import { generatePosition } from './utils/fractionalIndex';
import {
  emitOrQueue, joinChannel, leaveChannel,
  onDocumentBlockInsert, onDocumentBlockUpdate, onDocumentBlockDelete, onDocumentBlockMove,
} from '../../lib/socket';
import { apiFetch } from '../../lib/api/_core';

interface BlockEditorProps {
  channelId: string;
  channelName: string;
  guildId?: string;
  readOnly?: boolean;
}

export default function BlockEditor({ channelId, channelName, guildId, readOnly = false }: BlockEditorProps) {
  const editor = useBlockEditor({ channelId, readOnly });
  const {
    blocks, selectedBlockId, setSelectedBlockId, multiSelected,
    isDirty, isSaving, loading,
    insertBlock, updateBlock, updateBlockContent, deleteBlock, moveBlock,
    duplicateBlock, turnInto, undo, redo, canUndo, canRedo,
    save, toggleMultiSelect, clearMultiSelect, setBlocks, markDirty,
    title, setTitle, icon, setIcon,
  } = editor;

  // Slash command menu
  const [slashMenu, setSlashMenu] = useState<{ top: number; left: number } | null>(null);
  const [slashBlockId, setSlashBlockId] = useState<string | null>(null);

  // Block action menu
  const [actionMenu, setActionMenu] = useState<{ blockId: string; top: number; left: number } | null>(null);
  const [turnIntoMenu, setTurnIntoMenu] = useState<{ blockId: string; top: number; left: number } | null>(null);

  // Drag state
  const [dragBlockId, setDragBlockId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  // Template picker for empty docs
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  // Check if doc needs migration or is empty — runs once after loading
  const hasMigratedRef = useRef(false);
  useEffect(() => {
    if (loading || hasMigratedRef.current) return;
    hasMigratedRef.current = true;

    if (blocks.length === 0 || (blocks.length === 1 && isBlockEmpty(blocks[0]))) {
      // Check if there's old HTML content to migrate
      (async () => {
        try {
          const doc = await apiFetch(`/channels/${channelId}/document`);
          if (doc && (doc as any).content && (doc as any).content.trim() && !(doc as any).contentMigrated) {
            const migrated = htmlToBlocks((doc as any).content);
            if (migrated.length > 0) {
              setBlocks(migrated);
              // Save migrated blocks
              await apiFetch(`/channels/${channelId}/document`, {
                method: 'PUT',
                body: JSON.stringify({ blocks: migrated, contentMigrated: true }),
              });
              return;
            }
          }
        } catch { /* ignore */ }
        // If no migration needed and doc is empty, show template picker
        setShowTemplatePicker(true);
      })();
    }
  }, [loading, channelId, setBlocks]); // eslint-disable-line react-hooks/exhaustive-deps

  // Socket: join/leave channel for presence
  useEffect(() => {
    joinChannel(channelId);
    emitOrQueue('DOCUMENT_JOIN', { channelId });
    return () => {
      emitOrQueue('DOCUMENT_LEAVE', { channelId });
      leaveChannel(channelId);
    };
  }, [channelId]);

  // Socket: listen for remote block operations
  useEffect(() => {
    const unsubs = [
      onDocumentBlockInsert((p) => {
        if (p.channelId !== channelId) return;
        setBlocks(prev => [...prev, p.block].sort((a, b) => a.position.localeCompare(b.position)));
      }),
      onDocumentBlockUpdate((p) => {
        if (p.channelId !== channelId) return;
        setBlocks(prev => prev.map(b => b.id === p.blockId ? { ...b, content: { ...b.content, ...p.changes } } : b));
      }),
      onDocumentBlockDelete((p) => {
        if (p.channelId !== channelId) return;
        setBlocks(prev => prev.filter(b => b.id !== p.blockId));
      }),
      onDocumentBlockMove((p) => {
        if (p.channelId !== channelId) return;
        // Re-fetch on move for simplicity
        (async () => {
          try {
            const doc = await apiFetch(`/channels/${channelId}/document`);
            if (doc && (doc as any).blocks) setBlocks((doc as any).blocks);
          } catch { /* ignore */ }
        })();
      }),
    ];
    return () => unsubs.forEach(fn => fn());
  }, [channelId, setBlocks]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [undo, redo, save]);

  // Handle template selection
  const handleTemplateSelect = useCallback((templateBlocks: Block[]) => {
    setBlocks(templateBlocks);
    setShowTemplatePicker(false);
    // Save immediately
    (async () => {
      try {
        await apiFetch(`/channels/${channelId}/document/blocks`, {
          method: 'PUT',
          body: JSON.stringify({ blocks: templateBlocks }),
        });
      } catch { /* ignore */ }
    })();
  }, [channelId, setBlocks]);

  // Handle slash command
  const handleSlash = useCallback((blockId: string, rect: DOMRect) => {
    setSlashBlockId(blockId);
    setSlashMenu({ top: rect.bottom + 4, left: rect.left });
  }, []);

  const handleSlashSelect = useCallback((type: BlockType, extra?: any) => {
    if (slashBlockId) {
      // Replace the empty block with the selected type
      if (type === 'heading' && extra?.level) {
        turnInto(slashBlockId, 'heading');
        updateBlockContent(slashBlockId, { level: extra.level });
      } else {
        turnInto(slashBlockId, type);
      }
    }
    setSlashMenu(null);
    setSlashBlockId(null);
  }, [slashBlockId, turnInto, updateBlockContent]);

  // Handle Enter (split block) — single setBlocks call to avoid race condition
  const handleEnter = useCallback((blockId: string, offset: number) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    const idx = blocks.indexOf(block);
    const afterPos = idx + 1 < blocks.length ? blocks[idx + 1].position : undefined;
    const newPos = generatePosition(block.position, afterPos);

    const [updated, newBlock] = splitBlock(block, offset, newPos);
    // Do both the update and insert in a single setBlocks to avoid stale state
    setBlocks(prev => {
      const result = prev.map(b => b.id === blockId ? updated : b);
      result.push(newBlock);
      return result.sort((a, b) => a.position.localeCompare(b.position));
    });
    editor.markDirty();
    setSelectedBlockId(newBlock.id);
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-block-id="${newBlock.id}"] .inline-editor`) as HTMLElement;
      el?.focus();
    });
  }, [blocks, setBlocks, setSelectedBlockId]);

  // Handle Backspace at start (merge with previous)
  const handleBackspaceAtStart = useCallback((blockId: string) => {
    const idx = blocks.findIndex(b => b.id === blockId);
    if (idx <= 0) return;
    const current = blocks[idx];
    const prev = blocks[idx - 1];

    // If current is empty, just delete it
    if (isBlockEmpty(current)) {
      deleteBlock(blockId);
      setSelectedBlockId(prev.id);
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-block-id="${prev.id}"] .inline-editor`) as HTMLElement;
        el?.focus();
      });
      return;
    }

    // Merge text into previous block
    const richText = getBlockRichText(current);
    const prevRichText = getBlockRichText(prev);
    if (richText && prevRichText) {
      const merged = mergeBlocks(prev, current);
      updateBlock(prev.id, merged);
      deleteBlock(blockId);
      setSelectedBlockId(prev.id);
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-block-id="${prev.id}"] .inline-editor`) as HTMLElement;
        el?.focus();
      });
    }
  }, [blocks, deleteBlock, updateBlock, setSelectedBlockId]);

  // Arrow navigation
  const focusBlock = useCallback((blockId: string) => {
    setSelectedBlockId(blockId);
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-block-id="${blockId}"] .inline-editor`) as HTMLElement;
      el?.focus();
    });
  }, [setSelectedBlockId]);

  const handleArrowUp = useCallback((blockId: string) => {
    const idx = blocks.findIndex(b => b.id === blockId);
    if (idx > 0) focusBlock(blocks[idx - 1].id);
  }, [blocks, focusBlock]);

  const handleArrowDown = useCallback((blockId: string) => {
    const idx = blocks.findIndex(b => b.id === blockId);
    if (idx < blocks.length - 1) focusBlock(blocks[idx + 1].id);
  }, [blocks, focusBlock]);

  // Drag and drop
  const handleDragStart = useCallback((blockId: string, e: React.DragEvent) => {
    setDragBlockId(blockId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', blockId);
  }, []);

  const handleDragOver = useCallback((blockId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetId(blockId);
  }, []);

  const handleDrop = useCallback((targetBlockId: string, e: React.DragEvent) => {
    e.preventDefault();
    if (dragBlockId && dragBlockId !== targetBlockId) {
      moveBlock(dragBlockId, targetBlockId);
    }
    setDragBlockId(null);
    setDropTargetId(null);
  }, [dragBlockId, moveBlock]);

  // Compute list indices for numbered lists
  const listCounters = useRef(new Map<string, number>());
  const getListIndex = (blockId: string, type: string, idx: number): number => {
    if (type !== 'numbered_list') return 0;
    let count = 0;
    for (let i = 0; i <= idx; i++) {
      if (blocks[i].type === 'numbered_list') count++;
      else count = 0;
    }
    return count - 1;
  };

  // Build context value
  const contextValue: EditorContextValue = {
    channelId,
    blocks,
    selectedBlockId,
    multiSelected,
    readOnly,
    isDirty,
    isSaving,
    insertBlock,
    updateBlock,
    updateBlockContent,
    deleteBlock,
    moveBlock,
    duplicateBlock,
    turnInto,
    setSelectedBlockId,
    toggleMultiSelect,
    clearMultiSelect,
    undo,
    redo,
    canUndo,
    canRedo,
    save,
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-muted)',
      }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ marginLeft: 8 }}>Loading document...</span>
      </div>
    );
  }

  return (
    <BlockEditorCtx.Provider value={contextValue}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 16px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-secondary)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!readOnly && (
              <>
                <button
                  onClick={undo}
                  disabled={!canUndo}
                  style={{
                    background: 'none', border: 'none', cursor: canUndo ? 'pointer' : 'default',
                    color: canUndo ? 'var(--text-primary)' : 'var(--text-muted)',
                    padding: 4, borderRadius: 4, display: 'flex', opacity: canUndo ? 1 : 0.4,
                  }}
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 size={16} />
                </button>
                <button
                  onClick={redo}
                  disabled={!canRedo}
                  style={{
                    background: 'none', border: 'none', cursor: canRedo ? 'pointer' : 'default',
                    color: canRedo ? 'var(--text-primary)' : 'var(--text-muted)',
                    padding: 4, borderRadius: 4, display: 'flex', opacity: canRedo ? 1 : 0.4,
                  }}
                  title="Redo (Ctrl+Shift+Z)"
                >
                  <Redo2 size={16} />
                </button>
              </>
            )}
            {isDirty && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {isSaving ? 'Saving...' : 'Unsaved changes'}
              </span>
            )}
            {!isDirty && !isSaving && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Saved
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PresenceSidebar channelId={channelId} />
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

        {/* Editor content area */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '24px 48px 100px',
          maxWidth: 900, width: '100%', margin: '0 auto',
        }}>
          {/* Title */}
          {!readOnly ? (
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                emitOrQueue('DOCUMENT_TITLE_UPDATE', { channelId, title: e.target.value });
              }}
              onBlur={() => {
                apiFetch(`/channels/${channelId}/document`, {
                  method: 'PUT',
                  body: JSON.stringify({ title }),
                }).catch(() => {});
              }}
              placeholder="Untitled"
              style={{
                width: '100%', background: 'none', border: 'none', outline: 'none',
                fontSize: 'var(--text-4xl)', fontWeight: 700, color: 'var(--text-primary)',
                marginBottom: 4, padding: 0, fontFamily: 'inherit',
              }}
            />
          ) : (
            <h1 style={{
              fontSize: 'var(--text-4xl)', fontWeight: 700,
              color: 'var(--text-primary)', marginBottom: 4,
            }}>
              {title || 'Untitled'}
            </h1>
          )}

          {/* Template picker for empty docs */}
          {showTemplatePicker && !readOnly ? (
            <TemplatePicker guildId={guildId} onSelect={handleTemplateSelect} />
          ) : (
            /* Blocks */
            blocks.map((block, idx) => (
              <BlockRenderer
                key={block.id}
                block={block}
                index={idx}
                listIndex={getListIndex(block.id, block.type, idx)}
                onEnter={(offset) => handleEnter(block.id, offset)}
                onBackspaceAtStart={() => handleBackspaceAtStart(block.id)}
                onSlash={(rect) => handleSlash(block.id, rect)}
                onArrowUp={() => handleArrowUp(block.id)}
                onArrowDown={() => handleArrowDown(block.id)}
                onDragStart={(e) => handleDragStart(block.id, e)}
                onDragOver={(e) => handleDragOver(block.id, e)}
                onDrop={(e) => handleDrop(block.id, e)}
                onOpenActionMenu={(rect) => setActionMenu({ blockId: block.id, top: rect.top, left: rect.left - 210 })}
              />
            ))
          )}

          {/* Add block button at bottom */}
          {!showTemplatePicker && !readOnly && (
            <div
              onClick={() => insertBlock('text')}
              style={{
                padding: '8px 0', cursor: 'pointer', color: 'var(--text-muted)',
                fontSize: 'var(--text-sm)', opacity: 0.5,
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = '1'; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = '0.5'; }}
            >
              + Click to add a block, or press '/' for commands
            </div>
          )}
        </div>
      </div>

      {/* Floating menus */}
      {slashMenu && (
        <SlashCommandMenu
          position={slashMenu}
          onSelect={handleSlashSelect}
          onClose={() => { setSlashMenu(null); setSlashBlockId(null); }}
        />
      )}

      {actionMenu && (
        <BlockActionMenu
          blockId={actionMenu.blockId}
          position={{ top: actionMenu.top, left: actionMenu.left }}
          onClose={() => setActionMenu(null)}
          onTurnInto={() => {
            setTurnIntoMenu({ blockId: actionMenu.blockId, top: actionMenu.top, left: actionMenu.left + 210 });
            setActionMenu(null);
          }}
        />
      )}

      {turnIntoMenu && (
        <TurnIntoMenu
          blockId={turnIntoMenu.blockId}
          position={{ top: turnIntoMenu.top, left: turnIntoMenu.left }}
          onClose={() => setTurnIntoMenu(null)}
        />
      )}

      <InlineToolbar />
    </BlockEditorCtx.Provider>
  );
}
