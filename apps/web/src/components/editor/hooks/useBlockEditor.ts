/**
 * useBlockEditor.ts — Core hook managing block array state, undo/redo stacks,
 * dirty tracking, and auto-save timer.
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { Block, BlockType, CollaborativeDocumentData } from '@gratonite/types';
import { apiFetch } from '../../../lib/api/_core';
import { createBlock, createEmptyBlock, turnBlockInto, generateBlockId } from '../utils/blockHelpers';
import { generatePosition, getNextPosition } from '../utils/fractionalIndex';

const AUTO_SAVE_INTERVAL = 5000;
const MAX_UNDO_STACK = 50;

interface UseBlockEditorOptions {
  channelId: string;
  readOnly?: boolean;
}

export function useBlockEditor({ channelId, readOnly = false }: UseBlockEditorOptions) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [docId, setDocId] = useState<string | null>(null);
  const [title, setTitle] = useState('Untitled');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [icon, setIcon] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);

  // Undo/redo
  const undoStack = useRef<Block[][]>([]);
  const redoStack = useRef<Block[][]>([]);

  const pushUndo = useCallback((currentBlocks: Block[]) => {
    undoStack.current.push(JSON.parse(JSON.stringify(currentBlocks)));
    if (undoStack.current.length > MAX_UNDO_STACK) undoStack.current.shift();
    redoStack.current = [];
  }, []);

  // Sort blocks by position
  const sortedBlocks = useCallback((b: Block[]) => {
    return [...b].sort((a, c) => a.position.localeCompare(c.position));
  }, []);

  // Load document
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await apiFetch(`/channels/${channelId}/document`);
        if (cancelled) return;
        const doc = res as CollaborativeDocumentData;
        setDocId(doc.id);
        setTitle(doc.title);
        setCoverImage(doc.coverImage);
        setIcon(doc.icon);
        setVersion(doc.version);

        if (doc.blocks && doc.blocks.length > 0) {
          setBlocks(sortedBlocks(doc.blocks));
        } else if (doc.content && doc.content.trim()) {
          // Will be handled by htmlToBlocks migration in BlockEditor
          setBlocks([]);
        } else {
          // Empty doc — start with one empty text block
          setBlocks([createEmptyBlock('a0')]);
        }
      } catch (err) {
        console.error('[useBlockEditor] Failed to load document:', err);
        setBlocks([createEmptyBlock('a0')]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [channelId, sortedBlocks]);

  // Auto-save — use refs to avoid stale closures in unmount save
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blocksRef = useRef(blocks);
  const isDirtyRef = useRef(isDirty);
  blocksRef.current = blocks;
  isDirtyRef.current = isDirty;

  const save = useCallback(async () => {
    if (readOnly || !isDirtyRef.current) return;
    setIsSaving(true);
    try {
      await apiFetch(`/channels/${channelId}/document/blocks`, {
        method: 'PUT',
        body: JSON.stringify({ blocks: blocksRef.current }),
      });
      setIsDirty(false);
    } catch (err) {
      console.error('[useBlockEditor] Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  }, [channelId, readOnly]);

  useEffect(() => {
    if (!isDirty || readOnly) return;
    saveTimerRef.current = setTimeout(save, AUTO_SAVE_INTERVAL);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [isDirty, save, readOnly]);

  // Save on unmount — fire-and-forget best-effort save
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (isDirtyRef.current && !readOnly) {
        // Best-effort save using refs (avoids stale closure)
        const currentBlocks = blocksRef.current;
        apiFetch(`/channels/${channelId}/document/blocks`, {
          method: 'PUT',
          body: JSON.stringify({ blocks: currentBlocks }),
        }).catch(() => {}); // fire-and-forget
      }
    };
  }, [channelId, readOnly]);

  // Block operations
  const insertBlock = useCallback((type: BlockType, afterBlockId?: string): Block => {
    const newBlock = createBlock(type);

    setBlocks(prev => {
      pushUndo(prev);
      const sorted = sortedBlocks(prev);

      if (!afterBlockId || sorted.length === 0) {
        const lastPos = sorted.length > 0 ? sorted[sorted.length - 1].position : undefined;
        newBlock.position = generatePosition(lastPos, undefined);
        return sortedBlocks([...prev, newBlock]);
      }

      const idx = sorted.findIndex(b => b.id === afterBlockId);
      if (idx === -1) {
        newBlock.position = getNextPosition(sorted.map(b => b.position));
        return sortedBlocks([...prev, newBlock]);
      }

      const before = sorted[idx].position;
      const after = idx + 1 < sorted.length ? sorted[idx + 1].position : undefined;
      newBlock.position = generatePosition(before, after);
      return sortedBlocks([...prev, newBlock]);
    });

    setIsDirty(true);
    setSelectedBlockId(newBlock.id);
    return newBlock;
  }, [pushUndo, sortedBlocks]);

  const updateBlock = useCallback((blockId: string, changes: Partial<Block>) => {
    setBlocks(prev => {
      pushUndo(prev);
      return prev.map(b => b.id === blockId ? { ...b, ...changes } : b);
    });
    setIsDirty(true);
  }, [pushUndo]);

  const updateBlockContent = useCallback((blockId: string, content: any) => {
    setBlocks(prev => {
      // Don't push undo for every keystroke — debounce externally if needed
      return prev.map(b => b.id === blockId ? { ...b, content: { ...b.content, ...content } } : b);
    });
    setIsDirty(true);
  }, []);

  const deleteBlock = useCallback((blockId: string) => {
    setBlocks(prev => {
      pushUndo(prev);
      const filtered = prev.filter(b => b.id !== blockId);
      // Always keep at least one block
      if (filtered.length === 0) return [createEmptyBlock('a0')];
      return filtered;
    });
    setIsDirty(true);
  }, [pushUndo]);

  const moveBlock = useCallback((blockId: string, afterBlockId?: string) => {
    setBlocks(prev => {
      pushUndo(prev);
      const sorted = sortedBlocks(prev);
      const block = sorted.find(b => b.id === blockId);
      if (!block) return prev;

      if (!afterBlockId) {
        // Move to beginning
        const firstPos = sorted.length > 0 ? sorted[0].position : 'a0';
        block.position = generatePosition(undefined, firstPos);
        return sortedBlocks(prev.map(b => b.id === blockId ? block : b));
      }

      const idx = sorted.findIndex(b => b.id === afterBlockId);
      if (idx === -1) return prev;

      const before = sorted[idx].position;
      const after = idx + 1 < sorted.length ? sorted[idx + 1].position : undefined;
      block.position = generatePosition(before, after);
      return sortedBlocks(prev.map(b => b.id === blockId ? block : b));
    });
    setIsDirty(true);
  }, [pushUndo, sortedBlocks]);

  const duplicateBlock = useCallback((blockId: string) => {
    setBlocks(prev => {
      pushUndo(prev);
      const sorted = sortedBlocks(prev);
      const idx = sorted.findIndex(b => b.id === blockId);
      if (idx === -1) return prev;

      const block = sorted[idx];
      const before = block.position;
      const after = idx + 1 < sorted.length ? sorted[idx + 1].position : undefined;

      const dup: Block = {
        ...JSON.parse(JSON.stringify(block)),
        id: generateBlockId(),
        position: generatePosition(before, after),
      };

      return sortedBlocks([...prev, dup]);
    });
    setIsDirty(true);
  }, [pushUndo, sortedBlocks]);

  const turnInto = useCallback((blockId: string, newType: BlockType) => {
    setBlocks(prev => {
      pushUndo(prev);
      return prev.map(b => {
        if (b.id !== blockId) return b;
        return turnBlockInto(b, newType);
      });
    });
    setIsDirty(true);
  }, [pushUndo]);

  // Selection
  const toggleMultiSelect = useCallback((id: string) => {
    setMultiSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearMultiSelect = useCallback(() => {
    setMultiSelected(new Set());
  }, []);

  // Undo/Redo
  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current.pop()!;
    setBlocks(current => {
      redoStack.current.push(JSON.parse(JSON.stringify(current)));
      return sortedBlocks(prev);
    });
    setIsDirty(true);
  }, [sortedBlocks]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const next = redoStack.current.pop()!;
    setBlocks(current => {
      undoStack.current.push(JSON.parse(JSON.stringify(current)));
      return sortedBlocks(next);
    });
    setIsDirty(true);
  }, [sortedBlocks]);

  // Memoize sorted blocks to prevent new array reference every render
  const memoizedBlocks = useMemo(() => sortedBlocks(blocks), [blocks, sortedBlocks]);

  return {
    blocks: memoizedBlocks,
    selectedBlockId,
    setSelectedBlockId,
    multiSelected,
    toggleMultiSelect,
    clearMultiSelect,
    isDirty,
    isSaving,
    loading,
    readOnly,
    title,
    setTitle,
    coverImage,
    setCoverImage,
    icon,
    setIcon,

    insertBlock,
    updateBlock,
    updateBlockContent,
    deleteBlock,
    moveBlock,
    duplicateBlock,
    turnInto,

    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,

    save,

    // For context
    channelId,
    setBlocks,
    markDirty: () => setIsDirty(true),
  };
}

export type BlockEditorState = ReturnType<typeof useBlockEditor>;
