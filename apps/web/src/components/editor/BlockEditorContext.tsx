/**
 * BlockEditorContext.tsx — React context providing block editor state to all
 * child components: blocks array, selection, undo/redo, permissions.
 */
import { createContext, useContext } from 'react';
import type { Block, BlockType } from '@gratonite/types';

export interface EditorContextValue {
  /** The channel this document belongs to. */
  channelId: string;
  /** Full block array (sorted by position). */
  blocks: Block[];
  /** Currently focused block ID. */
  selectedBlockId: string | null;
  /** Set of multi-selected block IDs (Shift+Click). */
  multiSelected: Set<string>;
  /** Whether the editor is read-only. */
  readOnly: boolean;
  /** Whether there are unsaved changes. */
  isDirty: boolean;
  /** Whether auto-save is in progress. */
  isSaving: boolean;

  // Block operations
  insertBlock: (type: BlockType, afterBlockId?: string) => Block;
  updateBlock: (blockId: string, changes: Partial<Block>) => void;
  updateBlockContent: (blockId: string, content: any) => void;
  deleteBlock: (blockId: string) => void;
  moveBlock: (blockId: string, afterBlockId?: string) => void;
  duplicateBlock: (blockId: string) => void;
  turnInto: (blockId: string, newType: BlockType) => void;

  // Selection
  setSelectedBlockId: (id: string | null) => void;
  toggleMultiSelect: (id: string) => void;
  clearMultiSelect: () => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Save
  save: () => Promise<void>;
}

export const BlockEditorCtx = createContext<EditorContextValue | null>(null);

export function useEditorContext(): EditorContextValue {
  const ctx = useContext(BlockEditorCtx);
  if (!ctx) throw new Error('useEditorContext must be used within BlockEditorCtx.Provider');
  return ctx;
}
