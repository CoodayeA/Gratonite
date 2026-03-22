/**
 * htmlToBlocks.ts — Converts legacy HTML content from the old editor to Block[].
 * Used for on-demand client-side migration when BlockEditor loads an old document.
 */
import DOMPurify from 'dompurify';
import type { Block, InlineText } from '@gratonite/types';
import { generateBlockId, plainText } from './blockHelpers';
import { generatePositions } from './fractionalIndex';

/** Extract InlineText from an element's children. */
function extractInlineText(el: Element): InlineText[] {
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
    if (tag === 's' || tag === 'del') newAnnotations.strikethrough = true;
    if (tag === 'code') newAnnotations.code = true;

    if (tag === 'br') {
      result.push({ text: '\n' });
      return;
    }

    for (const child of Array.from(node.childNodes)) {
      walk(child, newAnnotations);
    }
  }

  walk(el, {});
  return result.length > 0 ? result : [{ text: '' }];
}

/** Convert an HTML string to Block[]. */
export function htmlToBlocks(html: string): Block[] {
  if (!html || !html.trim()) return [];

  // Sanitize with DOMPurify first
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'span',
      'strong', 'b', 'em', 'i', 'u', 's', 'del', 'code', 'pre',
      'ul', 'ol', 'li', 'blockquote', 'table', 'thead', 'tbody',
      'tr', 'th', 'td', 'img', 'a', 'hr', 'br'],
  });

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${clean}</body>`, 'text/html');
  const blocks: Array<{ type: any; content: any }> = [];

  function processNode(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        blocks.push({ type: 'text', content: { richText: plainText(text) } });
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    switch (tag) {
      case 'h1':
        blocks.push({ type: 'heading', content: { richText: extractInlineText(el), level: 1 } });
        break;
      case 'h2':
        blocks.push({ type: 'heading', content: { richText: extractInlineText(el), level: 2 } });
        break;
      case 'h3': case 'h4': case 'h5': case 'h6':
        blocks.push({ type: 'heading', content: { richText: extractInlineText(el), level: 3 } });
        break;
      case 'p': case 'div': {
        const richText = extractInlineText(el);
        if (richText.some(t => t.text.trim())) {
          blocks.push({ type: 'text', content: { richText } });
        }
        break;
      }
      case 'ul':
        for (const li of Array.from(el.querySelectorAll(':scope > li'))) {
          blocks.push({ type: 'bulleted_list', content: { richText: extractInlineText(li) } });
        }
        break;
      case 'ol':
        for (const li of Array.from(el.querySelectorAll(':scope > li'))) {
          blocks.push({ type: 'numbered_list', content: { richText: extractInlineText(li) } });
        }
        break;
      case 'blockquote':
        blocks.push({ type: 'quote', content: { richText: extractInlineText(el) } });
        break;
      case 'pre':
        blocks.push({ type: 'code', content: { code: el.textContent || '', language: 'plaintext' } });
        break;
      case 'table': {
        const headers: string[] = [];
        const rows: string[][] = [];
        const headerCells = el.querySelectorAll('thead th, thead td, tr:first-child th');
        headerCells.forEach(cell => headers.push(cell.textContent?.trim() || ''));
        const bodyRows = el.querySelectorAll('tbody tr, tr');
        bodyRows.forEach((row, i) => {
          if (i === 0 && headers.length > 0) return; // skip header row
          const cells: string[] = [];
          row.querySelectorAll('td, th').forEach(cell => cells.push(cell.textContent?.trim() || ''));
          if (cells.length > 0) rows.push(cells);
        });
        if (headers.length === 0 && rows.length > 0) {
          headers.push(...rows.shift()!);
        }
        blocks.push({ type: 'table', content: { headers, rows } });
        break;
      }
      case 'img': {
        const src = el.getAttribute('src');
        if (src) blocks.push({ type: 'image', content: { url: src, caption: el.getAttribute('alt') || '' } });
        break;
      }
      case 'hr':
        blocks.push({ type: 'divider', content: {} });
        break;
      default:
        // Recurse into unknown elements
        for (const child of Array.from(el.childNodes)) {
          processNode(child);
        }
    }
  }

  for (const child of Array.from(doc.body.childNodes)) {
    processNode(child);
  }

  if (blocks.length === 0) {
    // Fallback: treat entire content as a single text block
    const text = doc.body.textContent?.trim();
    if (text) {
      blocks.push({ type: 'text', content: { richText: plainText(text) } });
    }
  }

  // Assign positions
  const positions = generatePositions(blocks.length);
  return blocks.map((b, i) => ({
    id: generateBlockId(),
    type: b.type,
    content: b.content,
    position: positions[i],
  }));
}

/** Convert Block[] back to HTML for export. */
export function blocksToHtml(blocks: Block[]): string {
  return blocks.map(block => {
    const richTextToHtml = (rt: InlineText[]): string => {
      return rt.map(seg => {
        let html = seg.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        if (seg.annotations?.bold) html = `<strong>${html}</strong>`;
        if (seg.annotations?.italic) html = `<em>${html}</em>`;
        if (seg.annotations?.underline) html = `<u>${html}</u>`;
        if (seg.annotations?.strikethrough) html = `<s>${html}</s>`;
        if (seg.annotations?.code) html = `<code>${html}</code>`;
        return html;
      }).join('');
    };

    switch (block.type) {
      case 'heading': {
        const c = block.content as any;
        return `<h${c.level}>${richTextToHtml(c.richText)}</h${c.level}>`;
      }
      case 'text': return `<p>${richTextToHtml((block.content as any).richText)}</p>`;
      case 'bulleted_list': return `<ul><li>${richTextToHtml((block.content as any).richText)}</li></ul>`;
      case 'numbered_list': return `<ol><li>${richTextToHtml((block.content as any).richText)}</li></ol>`;
      case 'checklist': return `<p>${(block.content as any).checked ? '\u2611' : '\u2610'} ${richTextToHtml((block.content as any).richText)}</p>`;
      case 'quote': return `<blockquote>${richTextToHtml((block.content as any).richText)}</blockquote>`;
      case 'code': {
        const codeEscaped = ((block.content as any).code || '')
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<pre><code>${codeEscaped}</code></pre>`;
      }
      case 'divider': return '<hr>';
      case 'image': return `<img src="${(block.content as any).url}" alt="${(block.content as any).caption || ''}">`;
      default: return '';
    }
  }).join('\n');
}
