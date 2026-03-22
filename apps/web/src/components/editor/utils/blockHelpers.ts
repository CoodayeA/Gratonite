/**
 * blockHelpers.ts — Utility functions for creating, manipulating, and
 * converting blocks in the editor.
 */
import type { Block, BlockType, InlineText } from '@gratonite/types/api';
import { generatePosition, getNextPosition } from './fractionalIndex';

let idCounter = 0;

/** Generate a unique block ID. */
export function generateBlockId(): string {
  return `blk_${Date.now().toString(36)}_${(idCounter++).toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Create InlineText from a plain string. */
export function plainText(text: string): InlineText[] {
  if (!text) return [{ text: '' }];
  return [{ text }];
}

/** Extract plain text from InlineText array. */
export function toPlainText(richText: InlineText[]): string {
  return richText.map(t => t.text).join('');
}

/** Create an empty text block. */
export function createEmptyBlock(position?: string): Block<'text'> {
  return {
    id: generateBlockId(),
    type: 'text',
    content: { richText: [{ text: '' }] },
    position: position || 'a0',
  };
}

/** Create a block of any type with default content. */
export function createBlock<T extends BlockType>(type: T, position?: string): Block<T> {
  const pos = position || 'a0';
  const defaults: Record<BlockType, any> = {
    text: { richText: [{ text: '' }] },
    heading: { richText: [{ text: '' }], level: 1 },
    bulleted_list: { richText: [{ text: '' }] },
    numbered_list: { richText: [{ text: '' }] },
    checklist: { richText: [{ text: '' }], checked: false },
    image: { url: '', caption: '' },
    video: { url: '', caption: '' },
    audio: { url: '', caption: '' },
    file: { url: '', filename: '' },
    table: { headers: ['Column 1', 'Column 2', 'Column 3'], rows: [['', '', ''], ['', '', '']] },
    divider: {},
    callout: { richText: [{ text: '' }], emoji: '💡' },
    code: { code: '', language: 'javascript' },
    quote: { richText: [{ text: '' }] },
    embed: { url: '', caption: '' },
    toggle: { richText: [{ text: '' }], children: [] },
    column_layout: { columns: [{ width: 50, children: [] }, { width: 50, children: [] }] },
    child_page: { pageChannelId: '', title: 'Untitled' },
    table_of_contents: { maxDepth: 3 },
  };

  return {
    id: generateBlockId(),
    type,
    content: defaults[type],
    position: pos,
  } as Block<T>;
}

/** Check if a block type supports rich text editing. */
export function hasRichText(type: BlockType): boolean {
  return ['text', 'heading', 'bulleted_list', 'numbered_list', 'checklist', 'callout', 'quote', 'toggle'].includes(type);
}

/** Get the rich text array from a block, if it has one. */
export function getBlockRichText(block: Block): InlineText[] | null {
  const content = block.content as any;
  if (content?.richText) return content.richText;
  return null;
}

/** Check if a block is empty (no text content). */
export function isBlockEmpty(block: Block): boolean {
  const richText = getBlockRichText(block);
  if (richText) {
    return richText.every(t => t.text === '');
  }
  if (block.type === 'divider' || block.type === 'table_of_contents') return false;
  return false;
}

/** Merge two blocks' text content (for Backspace at start). */
export function mergeBlocks(target: Block, source: Block): Block {
  const targetText = getBlockRichText(target);
  const sourceText = getBlockRichText(source);
  if (!targetText || !sourceText) return target;

  return {
    ...target,
    content: {
      ...target.content,
      richText: [...targetText, ...sourceText],
    } as any,
  };
}

/** Split a block at a text offset, returning [before, after]. */
export function splitBlock(block: Block, offset: number, afterPosition: string): [Block, Block] {
  const richText = getBlockRichText(block);
  if (!richText) {
    const newBlock = createEmptyBlock(afterPosition);
    return [block, newBlock];
  }

  const plainStr = toPlainText(richText);
  const beforeText = plainStr.slice(0, offset);
  const afterText = plainStr.slice(offset);

  const updatedBlock: Block = {
    ...block,
    content: { ...block.content, richText: plainText(beforeText) } as any,
  };

  const newBlock: Block = {
    id: generateBlockId(),
    type: block.type === 'heading' ? 'text' : block.type,
    content: {
      ...(block.type === 'heading' ? { richText: plainText(afterText) } : { ...block.content, richText: plainText(afterText) }),
    } as any,
    position: afterPosition,
  };

  return [updatedBlock, newBlock];
}

/** Convert a block to a different type, preserving text content. */
export function turnBlockInto(block: Block, newType: BlockType): Block {
  const richText = getBlockRichText(block) || [{ text: '' }];
  const base = createBlock(newType, block.position);

  if (hasRichText(newType)) {
    return {
      ...base,
      id: block.id,
      content: { ...base.content, richText } as any,
    };
  }

  return { ...base, id: block.id };
}
