import { Fragment, type ReactNode } from 'react';
import { MentionLink } from './MentionLink';

interface GuildEmoji {
  id: string;
  name: string;
  url: string;
  animated: boolean;
}

interface MarkdownTextProps {
  content: string;
  mentionLabels?: Record<string, string>;
  roleMentionLabels?: Record<string, string>;
  emojis?: GuildEmoji[];
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

const styles = {
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  } as React.CSSProperties,
  paragraph: {
    margin: 0,
  } as React.CSSProperties,
  h1: {
    margin: 0,
    lineHeight: 1.3,
    color: 'var(--text)',
    fontSize: 20,
    fontWeight: 700,
  } as React.CSSProperties,
  h2: {
    margin: 0,
    lineHeight: 1.3,
    color: 'var(--text)',
    fontSize: 17,
    fontWeight: 700,
  } as React.CSSProperties,
  h3: {
    margin: 0,
    lineHeight: 1.3,
    color: 'var(--text)',
    fontSize: 15,
    fontWeight: 700,
  } as React.CSSProperties,
  list: {
    margin: 0,
    paddingLeft: 18,
    display: 'grid',
    gap: 4,
  } as React.CSSProperties,
  listItem: {
    margin: 0,
  } as React.CSSProperties,
  quote: {
    margin: 0,
    padding: '6px 10px',
    borderLeft: '3px solid rgba(212, 175, 55, 0.45)',
    background: 'rgba(212, 175, 55, 0.08)',
    borderRadius: '0 8px 8px 0',
    color: 'var(--text-muted)',
  } as React.CSSProperties,
  codeblock: {
    margin: 0,
    padding: '10px 12px',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-md)',
    background: 'rgba(6, 10, 18, 0.78)',
    color: '#d7e6ff',
    overflowX: 'auto',
    fontSize: 12,
    lineHeight: 1.5,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
  } as React.CSSProperties,
  inlineCode: {
    padding: '1px 5px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--stroke)',
    background: 'rgba(6, 10, 18, 0.7)',
    fontSize: '0.92em',
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
  } as React.CSSProperties,
  customEmoji: {
    display: 'inline-block',
    verticalAlign: 'middle',
    width: '1.5em',
    height: '1.5em',
    objectFit: 'contain',
    margin: '0 2px',
  } as React.CSSProperties,
  link: {
    color: 'var(--accent)',
    textDecoration: 'underline',
    textDecorationThickness: '1px',
    textUnderlineOffset: '2px',
  } as React.CSSProperties,
  roleMention: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '1px 5px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid rgba(104, 223, 255, 0.28)',
    background: 'rgba(104, 223, 255, 0.12)',
    color: '#b8f3ff',
    fontWeight: 600,
  } as React.CSSProperties,
};

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
  emojis: GuildEmoji[] = [],
): ReactNode[] {
  const emojiMap = new Map(emojis.map((e) => [e.name.toLowerCase(), e]));
  const out: ReactNode[] = [];
  const re = /`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|<@!?(\d+)>|<@&(\d+)>|:([a-zA-Z0-9_]+):/g;
  let last = 0;
  let m: RegExpExecArray | null = re.exec(text);

  while (m) {
    if (m.index > last) {
      out.push(text.slice(last, m.index));
    }
    if (m[1] !== undefined) {
      out.push(
        <code key={`code-${m.index}`} style={styles.inlineCode}>
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
          style={styles.link}
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
        <span key={`role-mention-${m.index}`} style={styles.roleMention} data-role-id={roleId}>
          @{label}
        </span>,
      );
    } else if (m[6] !== undefined) {
      const shortcode = m[6];
      const emoji = emojiMap.get(shortcode.toLowerCase());
      if (emoji) {
        out.push(
          <img
            key={`emoji-${m.index}`}
            src={emoji.url}
            alt={`:${emoji.name}:`}
            style={styles.customEmoji}
            title={`:${emoji.name}:`}
          />,
        );
      } else {
        out.push(`:${shortcode}:`);
      }
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
  emojis: GuildEmoji[] = [],
): ReactNode[] {
  return lines.flatMap((line, idx) => {
    const segment: ReactNode[] = [<Fragment key={`line-${idx}`}>{renderInline(line, mentionLabels, roleMentionLabels, emojis)}</Fragment>];
    if (idx < lines.length - 1) segment.push(<br key={`br-${idx}`} />);
    return segment;
  });
}

export function MarkdownText({ content, mentionLabels = {}, roleMentionLabels = {}, emojis = [] }: MarkdownTextProps) {
  const blocks = parseBlocks(content);

  return (
    <div style={styles.content}>
      {blocks.map((block, idx) => {
        if (block.type === 'heading') {
          if (block.level === 1) {
            return (
              <h1 key={idx} style={styles.h1}>
                {renderInline(block.text, mentionLabels, roleMentionLabels, emojis)}
              </h1>
            );
          }
          if (block.level === 2) {
            return (
              <h2 key={idx} style={styles.h2}>
                {renderInline(block.text, mentionLabels, roleMentionLabels, emojis)}
              </h2>
            );
          }
          return (
            <h3 key={idx} style={styles.h3}>
              {renderInline(block.text, mentionLabels, roleMentionLabels, emojis)}
            </h3>
          );
        }

        if (block.type === 'list') {
          return (
            <ul key={idx} style={styles.list}>
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx} style={styles.listItem}>{renderInline(item, mentionLabels, roleMentionLabels, emojis)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === 'blockquote') {
          return (
            <blockquote key={idx} style={styles.quote}>
              {renderLinesWithBreaks(block.lines, mentionLabels, roleMentionLabels, emojis)}
            </blockquote>
          );
        }

        if (block.type === 'codeblock') {
          return (
            <pre key={idx} style={styles.codeblock}>
              <code data-language={block.language}>{block.code}</code>
            </pre>
          );
        }

        return (
          <p key={idx} style={styles.paragraph}>
            {renderLinesWithBreaks(block.lines, mentionLabels, roleMentionLabels, emojis)}
          </p>
        );
      })}
    </div>
  );
}
