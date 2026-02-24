import { Fragment, type ReactNode } from 'react';
import { MentionLink } from './MentionLink';

interface MarkdownTextProps {
  content: string;
  mentionLabels?: Record<string, string>;
  roleMentionLabels?: Record<string, string>;
}

type Block =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; lines: string[] }
  | { type: 'list'; items: string[] }
  | { type: 'blockquote'; lines: string[] }
  | { type: 'codeblock'; code: string; language?: string };

const HEADING_RE = /^(#{1,3})\s+(.+)$/;
const LIST_RE = /^[-*]\s+(.+)$/;
const QUOTE_RE = /^>\s?(.*)$/;
const CODE_FENCE_RE = /^```([a-zA-Z0-9_-]+)?\s*$/;

function isBlockBoundary(line: string): boolean {
  return (
    CODE_FENCE_RE.test(line)
    || HEADING_RE.test(line)
    || LIST_RE.test(line)
    || QUOTE_RE.test(line)
  );
}

function parseBlocks(content: string): Block[] {
  const lines = content.split('\n');
  const blocks: Block[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const codeStart = line.match(CODE_FENCE_RE);
    if (codeStart) {
      const language = codeStart[1];
      i += 1;
      const codeLines: string[] = [];
      while (i < lines.length) {
        const next = lines[i];
        if (next === undefined) break;
        if (CODE_FENCE_RE.test(next)) break;
        codeLines.push(next);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({ type: 'codeblock', code: codeLines.join('\n'), language });
      continue;
    }

    const heading = line.match(HEADING_RE);
    if (heading) {
      const marks = heading[1] ?? '#';
      const text = heading[2] ?? '';
      blocks.push({
        type: 'heading',
        level: marks.length as 1 | 2 | 3,
        text,
      });
      i += 1;
      continue;
    }

    const list = line.match(LIST_RE);
    if (list) {
      const items: string[] = [];
      while (i < lines.length) {
        const next = lines[i];
        if (next === undefined) break;
        const m = next.match(LIST_RE);
        if (!m) break;
        items.push(m[1] ?? '');
        i += 1;
      }
      blocks.push({ type: 'list', items });
      continue;
    }

    const quote = line.match(QUOTE_RE);
    if (quote) {
      const quoteLines: string[] = [];
      while (i < lines.length) {
        const next = lines[i];
        if (next === undefined) break;
        const m = next.match(QUOTE_RE);
        if (!m) break;
        quoteLines.push(m[1] ?? '');
        i += 1;
      }
      blocks.push({ type: 'blockquote', lines: quoteLines });
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const next = lines[i];
      if (next === undefined) break;
      if (!next.trim()) break;
      if (isBlockBoundary(next)) break;
      paragraphLines.push(next);
      i += 1;
    }
    if (paragraphLines.length > 0) {
      blocks.push({ type: 'paragraph', lines: paragraphLines });
      continue;
    }

    i += 1;
  }

  return blocks;
}

function renderInline(
  text: string,
  mentionLabels: Record<string, string> = {},
  roleMentionLabels: Record<string, string> = {},
): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|<@!?(\d+)>|<@&(\d+)>/g;
  let last = 0;
  let m: RegExpExecArray | null = re.exec(text);

  while (m) {
    if (m.index > last) {
      out.push(text.slice(last, m.index));
    }
    if (m[1] !== undefined) {
      out.push(
        <code key={`code-${m.index}`} className="markdown-inline-code">
          {m[1]}
        </code>,
      );
    } else if (m[2] !== undefined && m[3] !== undefined) {
      const label = m[2];
      const href = m[3];
      out.push(
        <a
          key={`link-${m.index}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="markdown-link"
        >
          {label}
        </a>,
      );
    } else if (m[4] !== undefined) {
      const userId = m[4];
      const label = mentionLabels[userId] ?? `User ${userId}`;
      out.push(
        <MentionLink key={`mention-${m.index}`} userId={userId} label={label} />,
      );
    } else if (m[5] !== undefined) {
      const roleId = m[5];
      const label = roleMentionLabels[roleId] ?? `group-${roleId.slice(-4)}`;
      out.push(
        <span key={`role-mention-${m.index}`} className="markdown-mention markdown-role-mention" data-role-id={roleId}>
          @{label}
        </span>,
      );
    }
    last = re.lastIndex;
    m = re.exec(text);
  }

  if (last < text.length) {
    out.push(text.slice(last));
  }

  return out;
}

function renderLinesWithBreaks(
  lines: string[],
  mentionLabels: Record<string, string>,
  roleMentionLabels: Record<string, string>,
): ReactNode[] {
  return lines.flatMap((line, idx) => {
    const segment: ReactNode[] = [<Fragment key={`line-${idx}`}>{renderInline(line, mentionLabels, roleMentionLabels)}</Fragment>];
    if (idx < lines.length - 1) segment.push(<br key={`br-${idx}`} />);
    return segment;
  });
}

export function MarkdownText({ content, mentionLabels = {}, roleMentionLabels = {} }: MarkdownTextProps) {
  const blocks = parseBlocks(content);

  return (
    <div className="markdown-content">
      {blocks.map((block, idx) => {
        if (block.type === 'heading') {
          if (block.level === 1) {
            return (
              <h1 key={idx} className="markdown-h1">
                {renderInline(block.text, mentionLabels, roleMentionLabels)}
              </h1>
            );
          }
          if (block.level === 2) {
            return (
              <h2 key={idx} className="markdown-h2">
                {renderInline(block.text, mentionLabels, roleMentionLabels)}
              </h2>
            );
          }
          return (
            <h3 key={idx} className="markdown-h3">
              {renderInline(block.text, mentionLabels, roleMentionLabels)}
            </h3>
          );
        }

        if (block.type === 'list') {
          return (
            <ul key={idx} className="markdown-list">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx}>{renderInline(item, mentionLabels, roleMentionLabels)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === 'blockquote') {
          return (
            <blockquote key={idx} className="markdown-quote">
              {renderLinesWithBreaks(block.lines, mentionLabels, roleMentionLabels)}
            </blockquote>
          );
        }

        if (block.type === 'codeblock') {
          return (
            <pre key={idx} className="markdown-codeblock">
              <code data-language={block.language}>{block.code}</code>
            </pre>
          );
        }

        return (
          <p key={idx} className="markdown-paragraph">
            {renderLinesWithBreaks(block.lines, mentionLabels, roleMentionLabels)}
          </p>
        );
      })}
    </div>
  );
}
