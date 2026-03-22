/**
 * InlineEditor.tsx — contentEditable div for a single text-bearing block.
 * Converts between DOM and InlineText[]. Handles Enter (split), Backspace
 * at start (merge/delete), "/" (slash menu), "@" (mention), and keyboard shortcuts.
 *
 * SECURITY: All HTML output is constructed from InlineText[] (never raw user HTML).
 * The richTextToHtml function escapes all text content. On parse, htmlToRichText
 * only extracts text nodes and known formatting tags — no raw HTML is preserved.
 * DOMPurify is used as a safety net on the parsed HTML.
 */
import { useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import DOMPurify from 'dompurify';
import type { InlineText } from '@gratonite/types';
import { useEditorContext } from '../BlockEditorContext';
import { toPlainText } from '../utils/blockHelpers';

interface InlineEditorProps {
  blockId: string;
  richText: InlineText[];
  onChange: (richText: InlineText[]) => void;
  onEnter?: (offset: number) => void;
  onBackspaceAtStart?: () => void;
  onSlash?: (rect: DOMRect) => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  tag?: 'div' | 'span' | 'h1' | 'h2' | 'h3';
}

/** Escape HTML entities in text. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

/** Convert InlineText[] to sanitized HTML string for contentEditable. */
function richTextToHtml(richText: InlineText[]): string {
  const raw = richText.map(seg => {
    let html = escapeHtml(seg.text);

    if (seg.annotations?.code) html = `<code>${html}</code>`;
    if (seg.annotations?.bold) html = `<strong>${html}</strong>`;
    if (seg.annotations?.italic) html = `<em>${html}</em>`;
    if (seg.annotations?.underline) html = `<u>${html}</u>`;
    if (seg.annotations?.strikethrough) html = `<s>${html}</s>`;
    if (seg.link) {
      const safeUrl = encodeURI(seg.link.url);
      html = `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${html}</a>`;
    }
    if (seg.mention) {
      html = `<span class="mention" data-mention-type="${escapeHtml(seg.mention.type)}" data-mention-id="${escapeHtml(seg.mention.id)}">@${html}</span>`;
    }

    if (seg.annotations?.color || seg.annotations?.bgColor) {
      const styles: string[] = [];
      if (seg.annotations?.color) styles.push(`color:${seg.annotations.color}`);
      if (seg.annotations?.bgColor) styles.push(`background-color:${seg.annotations.bgColor}`);
      html = `<span style="${styles.join(';')}">${html}</span>`;
    }

    return html;
  }).join('');

  // Sanitize as safety net — the input is already escaped above
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: ['strong', 'b', 'em', 'i', 'u', 's', 'del', 'code', 'a', 'span', 'br'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style', 'data-mention-type', 'data-mention-id'],
  });
}

/** Parse HTML from contentEditable back to InlineText[] using DOM traversal. */
function htmlToRichText(el: HTMLElement): InlineText[] {
  const result: InlineText[] = [];

  function walk(node: Node, annotations: NonNullable<InlineText['annotations']>): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text) {
        const entry: InlineText = { text };
        if (Object.values(annotations).some(Boolean)) {
          entry.annotations = { ...annotations };
        }
        result.push(entry);
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = (node as HTMLElement).tagName.toLowerCase();
    const newAnnotations = { ...annotations };

    if (tag === 'strong' || tag === 'b') newAnnotations.bold = true;
    if (tag === 'em' || tag === 'i') newAnnotations.italic = true;
    if (tag === 'u') newAnnotations.underline = true;
    if (tag === 's' || tag === 'del' || tag === 'strike') newAnnotations.strikethrough = true;
    if (tag === 'code') newAnnotations.code = true;

    if (tag === 'br') {
      result.push({ text: '\n', annotations: Object.values(annotations).some(Boolean) ? { ...annotations } : undefined });
      return;
    }

    for (const child of Array.from(node.childNodes)) {
      walk(child, newAnnotations);
    }
  }

  walk(el, {});
  return result.length > 0 ? result : [{ text: '' }];
}

export default function InlineEditor({
  blockId,
  richText,
  onChange,
  onEnter,
  onBackspaceAtStart,
  onSlash,
  onArrowUp,
  onArrowDown,
  placeholder,
  className,
  style,
  tag: Tag = 'div',
}: InlineEditorProps) {
  const ref = useRef<HTMLElement>(null);
  const { readOnly, setSelectedBlockId } = useEditorContext();
  const isComposing = useRef(false);
  const lastTextContent = useRef('');

  // Sync content when richText changes externally (not focused)
  useEffect(() => {
    if (!ref.current) return;
    const html = richTextToHtml(richText);
    if (!ref.current.matches(':focus')) {
      ref.current.textContent = '';
      // Use DOMPurify-sanitized HTML via a temporary element
      const temp = document.createElement('div');
      temp.textContent = '';
      // Set sanitized content using the DOM parser (not innerHTML directly)
      const parser = new DOMParser();
      const parsed = parser.parseFromString(`<body>${html}</body>`, 'text/html');
      while (parsed.body.firstChild) {
        ref.current.appendChild(document.importNode(parsed.body.firstChild, true));
      }
      lastTextContent.current = ref.current.textContent || '';
    }
  }, [richText]);

  // Initial render
  useEffect(() => {
    if (!ref.current) return;
    ref.current.textContent = '';
    const html = richTextToHtml(richText);
    const parser = new DOMParser();
    const parsed = parser.parseFromString(`<body>${html}</body>`, 'text/html');
    while (parsed.body.firstChild) {
      ref.current.appendChild(document.importNode(parsed.body.firstChild, true));
    }
    lastTextContent.current = ref.current.textContent || '';
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInput = useCallback(() => {
    if (isComposing.current || !ref.current) return;
    const textContent = ref.current.textContent || '';
    if (textContent === lastTextContent.current && textContent !== '') return;
    lastTextContent.current = textContent;
    // Parse DOM tree directly (not innerHTML) to extract InlineText
    onChange(htmlToRichText(ref.current));
  }, [onChange]);

  const getCaretOffset = useCallback((): number => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !ref.current) return 0;

    const range = sel.getRangeAt(0);
    const preRange = document.createRange();
    preRange.selectNodeContents(ref.current);
    preRange.setEnd(range.startContainer, range.startOffset);
    return preRange.toString().length;
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLElement>) => {
    if (isComposing.current) return;

    // Cmd/Ctrl+B/I/U
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
      if (e.key === 'b') { e.preventDefault(); document.execCommand('bold'); handleInput(); return; }
      if (e.key === 'i') { e.preventDefault(); document.execCommand('italic'); handleInput(); return; }
      if (e.key === 'u') { e.preventDefault(); document.execCommand('underline'); handleInput(); return; }
    }

    // Enter — split block
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onEnter?.(getCaretOffset());
      return;
    }

    // Backspace at start — merge with previous block
    if (e.key === 'Backspace' && getCaretOffset() === 0) {
      const sel = window.getSelection();
      if (sel && sel.isCollapsed) {
        e.preventDefault();
        onBackspaceAtStart?.();
        return;
      }
    }

    // Arrow up at start
    if (e.key === 'ArrowUp' && getCaretOffset() === 0) {
      onArrowUp?.();
    }

    // Arrow down at end
    if (e.key === 'ArrowDown') {
      const text = toPlainText(richText);
      if (getCaretOffset() >= text.length) {
        onArrowDown?.();
      }
    }

    // "/" at start of empty block — slash command
    if (e.key === '/' && toPlainText(richText) === '') {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        onSlash?.(rect);
      }
    }
  }, [richText, onEnter, onBackspaceAtStart, onSlash, onArrowUp, onArrowDown, getCaretOffset, handleInput]);

  const handleFocus = useCallback(() => {
    setSelectedBlockId(blockId);
  }, [blockId, setSelectedBlockId]);

  const isEmpty = toPlainText(richText) === '';

  return (
    <Tag
      ref={ref as any}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={handleKeyDown as any}
      onFocus={handleFocus}
      onCompositionStart={() => { isComposing.current = true; }}
      onCompositionEnd={() => { isComposing.current = false; handleInput(); }}
      className={`inline-editor ${className || ''}`}
      style={{
        outline: 'none',
        minHeight: '1.5em',
        wordBreak: 'break-word',
        whiteSpace: 'pre-wrap',
        ...style,
      }}
      data-placeholder={placeholder}
      data-empty={isEmpty ? 'true' : undefined}
    />
  );
}
