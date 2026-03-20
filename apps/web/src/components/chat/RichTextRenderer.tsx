import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { getCodeTheme, applyCodeTheme } from '../../utils/codeTheme';
import { copyToClipboard } from '../../utils/clipboard';

function isGratoniteDomain(url: string): boolean {
    try {
        const host = new URL(url).hostname;
        return host === 'localhost' || host === '127.0.0.1' || host.endsWith('gratonite.chat');
    } catch {
        return false;
    }
}

function handleExternalLinkClick(e: React.MouseEvent, url: string) {
    if (isGratoniteDomain(url)) return; // let it open normally
    const skip = localStorage.getItem('gratonite:skip-external-link-warning') === 'true';
    if (skip) return; // let it open normally
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('gratonite:external-link', { detail: url }));
}

// Apply the saved code theme on first load
applyCodeTheme(getCodeTheme());

// Code block with copy button — HTML is sanitized via DOMPurify before rendering
const CodeBlock = ({ code, lang, idx }: { code: string; lang: string; idx: number }) => {
    const [copied, setCopied] = useState(false);
    const rawHtml = lang && hljs.getLanguage(lang)
        ? hljs.highlight(code, { language: lang }).value
        : hljs.highlightAuto(code).value;
    // SECURITY: sanitize highlight.js output to prevent XSS
    const safeHtml = DOMPurify.sanitize(rawHtml);

    const handleCopy = useCallback(() => {
        copyToClipboard(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [code]);

    return (
        <pre key={`cb-${idx}`} className="code-block" style={{ position: 'relative' }}>
            {lang && <div className="code-block-lang">{lang}</div>}
            <button
                onClick={handleCopy}
                className={copied ? '' : 'hover-bg-secondary-to-tertiary'}
                style={{
                    position: 'absolute', top: lang ? '28px' : '6px', right: '6px',
                    background: copied ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                    border: '1px solid var(--stroke)', borderRadius: '4px',
                    padding: '2px 8px', fontSize: '11px', fontWeight: 500,
                    color: copied ? 'white' : 'var(--text-muted)',
                    cursor: 'pointer', transition: 'all 0.15s',
                    zIndex: 1,
                }}
            >
                {copied ? 'Copied!' : 'Copy'}
            </button>
            <code
                // SAFETY: safeHtml is DOMPurify.sanitize'd above — safe for rendering
                dangerouslySetInnerHTML={{ __html: safeHtml }}
            />
        </pre>
    );
};

// ─── Mermaid Diagram Block ────────────────────────────────────────────────────
const MermaidBlock = ({ code, idx }: { code: string; idx: number }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [svg, setSvg] = useState<string>('');
    const [error, setError] = useState<string>('');

    useEffect(() => {
        let cancelled = false;
        import('mermaid').then(mod => {
            const mermaid = mod.default;
            mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict' });
            const id = `mermaid-${idx}-${Date.now()}`;
            mermaid.render(id, code).then(({ svg: result }) => {
                // SAFETY: DOMPurify.sanitize ensures no XSS from mermaid SVG output
                if (!cancelled) setSvg(DOMPurify.sanitize(result));
            }).catch((err: Error) => {
                if (!cancelled) setError(err.message || 'Failed to render diagram');
            });
        });
        return () => { cancelled = true; };
    }, [code, idx]);

    if (error) {
        return <pre style={{ color: '#ef4444', background: 'var(--bg-tertiary)', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', whiteSpace: 'pre-wrap' }}>Mermaid error: {error}</pre>;
    }
    if (!svg) {
        return <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '13px' }}>Loading diagram...</div>;
    }
    return (
        <div
            ref={containerRef}
            style={{ margin: '6px 0', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--stroke)', overflow: 'auto', maxWidth: '100%' }}
            // SAFETY: svg is DOMPurify.sanitize'd above — safe for rendering
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
};

// ─── KaTeX Math Rendering ─────────────────────────────────────────────────────
const InlineMath = ({ tex }: { tex: string }) => {
    const html = useMemo(() => {
        try {
            // SAFETY: KaTeX output is safe by design — it only generates math markup
            return katex.renderToString(tex, { throwOnError: false, displayMode: false });
        } catch {
            return `<span style="color:#ef4444">${DOMPurify.sanitize(tex)}</span>`;
        }
    }, [tex]);
    // SAFETY: KaTeX renderToString produces safe HTML; fallback uses DOMPurify
    return <span dangerouslySetInnerHTML={{ __html: html }} style={{ verticalAlign: 'middle' }} />;
};

const BlockMath = ({ tex, keyStr }: { tex: string; keyStr: string }) => {
    const html = useMemo(() => {
        try {
            // SAFETY: KaTeX output is safe by design — it only generates math markup
            return katex.renderToString(tex, { throwOnError: false, displayMode: true });
        } catch {
            return `<div style="color:#ef4444">${DOMPurify.sanitize(tex)}</div>`;
        }
    }, [tex]);
    return (
        // SAFETY: KaTeX renderToString produces safe HTML; fallback uses DOMPurify
        <div key={keyStr} style={{ margin: '8px 0', textAlign: 'center', overflow: 'auto' }} dangerouslySetInnerHTML={{ __html: html }} />
    );
};

// ─── Markdown Table Parser ────────────────────────────────────────────────────
const MarkdownTable = ({ rows, ctx, keyStr }: { rows: string[]; ctx: InlineCtx; keyStr: string }) => {
    const headerCells = rows[0].split('|').map(c => c.trim()).filter(Boolean);
    const alignRow = rows[1].split('|').map(c => c.trim()).filter(Boolean);
    const alignments = alignRow.map(a => {
        if (a.startsWith(':') && a.endsWith(':')) return 'center' as const;
        if (a.endsWith(':')) return 'right' as const;
        return 'left' as const;
    });
    const bodyRows = rows.slice(2).map(r => r.split('|').map(c => c.trim()).filter(Boolean));

    return (
        <div key={keyStr} style={{ margin: '6px 0', overflow: 'auto', maxWidth: '100%' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '13px' }}>
                <thead>
                    <tr>
                        {headerCells.map((cell, ci) => (
                            <th key={ci} style={{
                                padding: '6px 12px', textAlign: alignments[ci] || 'left',
                                borderBottom: '2px solid var(--stroke)', color: 'var(--text-primary)',
                                fontWeight: 700, background: 'var(--bg-tertiary)', whiteSpace: 'nowrap',
                            }}>
                                {renderInline(cell, { ...ctx, keyPrefix: `${keyStr}-th-${ci}` })}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {bodyRows.map((row, ri) => (
                        <tr key={ri}>
                            {row.map((cell, ci) => (
                                <td key={ci} style={{
                                    padding: '5px 12px', textAlign: alignments[ci] || 'left',
                                    borderBottom: '1px solid var(--stroke)', color: 'var(--text-secondary)',
                                }}>
                                    {renderInline(cell, { ...ctx, keyPrefix: `${keyStr}-td-${ri}-${ci}` })}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

type RichTextRendererProps = {
    content: string;
    customEmojis?: Array<{ name: string; url: string }>;
    members?: Array<{ id: string; username: string; displayName: string }>;
    channels?: Array<{ id: string; name: string }>;
};

// ─── Spoiler Tag Component ────────────────────────────────────────────────────
const SpoilerTag = ({ children }: { children: React.ReactNode }) => {
    const [revealed, setRevealed] = useState(false);
    return (
        <span
            className={`spoiler ${revealed ? 'revealed' : ''}`}
            onClick={() => setRevealed(r => !r)}
            title={revealed ? 'Click to hide' : 'Click to reveal spoiler'}
        >
            {children}
        </span>
    );
};

// ─── Custom Emoji Inline Component ────────────────────────────────────────────
const CustomEmojiInline = ({ name, url }: { name: string; url: string }) => (
    <img
        src={url}
        alt={`:${name}:`}
        title={`:${name}:`}
        style={{
            width: '22px', height: '22px', verticalAlign: 'middle',
            objectFit: 'contain', margin: '0 2px', display: 'inline-block',
        }}
    />
);

// ─── Image URL detection ──────────────────────────────────────────────────────
const IMAGE_URL_REGEX = /^https?:\/\/[^\s]+\.(png|jpe?g|gif|webp|svg|bmp)(\?[^\s]*)?$/i;

// ─── Inline Formatting Engine ─────────────────────────────────────────────────
// Processes inline markdown tokens in correct precedence order.
// Each token is processed by splitting text, applying the format, and recursing
// into the remaining plain-text segments for lower-priority tokens.

type InlineCtx = {
    customEmojis?: Array<{ name: string; url: string }>;
    members?: Array<{ id: string; username: string; displayName: string }>;
    channels?: Array<{ id: string; name: string }>;
    keyPrefix: string;
};

function renderInline(text: string, ctx: InlineCtx, depth = 0): React.ReactNode[] {
    if (!text) return [];
    const kp = `${ctx.keyPrefix}-d${depth}`;

    // Pipeline of inline rules, processed in order.
    // Each rule: [regex, wrapper factory]
    // The regex MUST have exactly one capture group for the inner content.
    const rules: Array<{
        re: RegExp;
        wrap: (inner: React.ReactNode[], key: string) => React.ReactNode;
        recurse: boolean; // whether to recurse into inner content
    }> = [
        // Masked links [text](url) — don't recurse link text for simplicity
        {
            re: /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
            wrap: (_inner, _key) => null, // handled specially below
            recurse: false,
        },
        // Inline code (no recursion inside code)
        {
            re: /`([^`]+)`/g,
            wrap: (inner, key) => <code key={key} style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '0.85em', color: 'var(--accent-purple)' }}>{inner}</code>,
            recurse: false,
        },
        // Spoiler ||text||
        {
            re: /\|\|([^|]+)\|\|/g,
            wrap: (inner, key) => <SpoilerTag key={key}>{inner}</SpoilerTag>,
            recurse: true,
        },
        // Bold italics ***text***
        {
            re: /\*\*\*([^*]+)\*\*\*/g,
            wrap: (inner, key) => <strong key={key} style={{ fontWeight: 700, color: 'var(--text-primary)' }}><em>{inner}</em></strong>,
            recurse: true,
        },
        // Bold **text**
        {
            re: /\*\*([^*]+)\*\*/g,
            wrap: (inner, key) => <strong key={key} style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{inner}</strong>,
            recurse: true,
        },
        // Underline __text__
        {
            re: /__([^_]+)__/g,
            wrap: (inner, key) => <span key={key} style={{ textDecoration: 'underline' }}>{inner}</span>,
            recurse: true,
        },
        // Italic *text* (single asterisk)
        {
            re: /\*([^*]+)\*/g,
            wrap: (inner, key) => <em key={key} style={{ fontStyle: 'italic' }}>{inner}</em>,
            recurse: true,
        },
        // Italic _text_ (single underscore)
        {
            re: /(?<![a-zA-Z0-9])_([^_]+)_(?![a-zA-Z0-9])/g,
            wrap: (inner, key) => <em key={key} style={{ fontStyle: 'italic' }}>{inner}</em>,
            recurse: true,
        },
        // Strikethrough ~~text~~
        {
            re: /~~([^~]+)~~/g,
            wrap: (inner, key) => <span key={key} style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>{inner}</span>,
            recurse: true,
        },
        // Inline math $...$  (not $$)
        {
            re: /(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g,
            wrap: (_inner, key) => null, // handled specially below
            recurse: false,
        },
    ];

    // Try each rule in order
    for (let ruleIdx = 0; ruleIdx < rules.length; ruleIdx++) {
        const rule = rules[ruleIdx];

        // Special handling for masked links
        if (ruleIdx === 0) {
            const linkRe = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
            const parts: React.ReactNode[] = [];
            let lastIndex = 0;
            let match: RegExpExecArray | null;
            let found = false;

            while ((match = linkRe.exec(text)) !== null) {
                found = true;
                if (match.index > lastIndex) {
                    parts.push(...renderInline(text.slice(lastIndex, match.index), ctx, depth + 1));
                }
                parts.push(
                    <a key={`${kp}-mlink-${match.index}`} href={match[2]} target="_blank" rel="noopener noreferrer"
                        style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}
                        className="hover-underline"
                        onClick={(e) => handleExternalLinkClick(e, match![2])}
                    >{match[1]}</a>
                );
                lastIndex = match.index + match[0].length;
            }
            if (found) {
                if (lastIndex < text.length) {
                    parts.push(...renderInline(text.slice(lastIndex), ctx, depth + 1));
                }
                return parts;
            }
            continue;
        }

        // Special handling for inline math $...$
        if (rule.re.source.includes('\\$')) {
            const mathRe = /(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g;
            const mathParts: React.ReactNode[] = [];
            let mathLastIndex = 0;
            let mathMatch: RegExpExecArray | null;
            let mathFound = false;

            while ((mathMatch = mathRe.exec(text)) !== null) {
                mathFound = true;
                if (mathMatch.index > mathLastIndex) {
                    mathParts.push(...renderInline(text.slice(mathLastIndex, mathMatch.index), ctx, depth + 1));
                }
                mathParts.push(<InlineMath key={`${kp}-math-${mathMatch.index}`} tex={mathMatch[1]} />);
                mathLastIndex = mathMatch.index + mathMatch[0].length;
            }
            if (mathFound) {
                if (mathLastIndex < text.length) {
                    mathParts.push(...renderInline(text.slice(mathLastIndex), ctx, depth + 1));
                }
                return mathParts;
            }
            continue;
        }

        // Generic split-based processing for other rules
        const re = new RegExp(rule.re.source, rule.re.flags);
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        let found = false;

        while ((match = re.exec(text)) !== null) {
            found = true;
            if (match.index > lastIndex) {
                // Recurse remaining rules on the text before this match
                parts.push(...applyRemainingRules(text.slice(lastIndex, match.index), ctx, ruleIdx + 1, depth + 1));
            }
            const innerText = match[1];
            const inner = rule.recurse
                ? applyRemainingRules(innerText, ctx, ruleIdx + 1, depth + 1)
                : [innerText];
            parts.push(rule.wrap(inner, `${kp}-r${ruleIdx}-${match.index}`));
            lastIndex = match.index + match[0].length;
        }

        if (found) {
            if (lastIndex < text.length) {
                parts.push(...applyRemainingRules(text.slice(lastIndex), ctx, ruleIdx + 1, depth + 1));
            }
            return parts;
        }
    }

    // No formatting rules matched — process URLs and custom emojis as leaf nodes
    return renderLeaf(text, ctx, depth);
}

function applyRemainingRules(text: string, ctx: InlineCtx, _startRule: number, depth: number): React.ReactNode[] {
    // This is a simplified approach: just call renderInline which tries all rules.
    // The depth parameter prevents infinite recursion.
    if (depth > 12) return [text];
    return renderInline(text, ctx, depth);
}

function renderLeaf(text: string, ctx: InlineCtx, depth: number): React.ReactNode[] {
    const kp = `${ctx.keyPrefix}-leaf${depth}`;

    // Item 87: @everyone / @here highlight
    const everyoneRe = /(@everyone|@here)/g;
    if (everyoneRe.test(text)) {
        const parts = text.split(/(@everyone|@here)/g);
        const result: React.ReactNode[] = [];
        parts.forEach((part, i) => {
            if (part === '@everyone' || part === '@here') {
                result.push(
                    <span key={`${kp}-everyone-${i}`} className="mention" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontWeight: 600 }}>
                        {part}
                    </span>
                );
            } else if (part) {
                result.push(...renderLeaf(part, { ...ctx, keyPrefix: `${kp}-ev-${i}` }, depth + 1));
            }
        });
        return result;
    }

    // Parse <@userId> user mentions
    const userMentionRe = /<@([a-zA-Z0-9_-]+)>/g;
    if (userMentionRe.test(text)) {
        const parts = text.split(/(<@[a-zA-Z0-9_-]+>)/g);
        const result: React.ReactNode[] = [];
        parts.forEach((part, i) => {
            const m = part.match(/^<@([a-zA-Z0-9_-]+)>$/);
            if (m) {
                const userId = m[1];
                const member = ctx.members?.find(u => u.id === userId);
                const displayName = member ? (member.displayName || member.username) : 'Unknown User';
                result.push(
                    <span key={`${kp}-umention-${i}`} className="mention">@{displayName}</span>
                );
            } else if (part) {
                result.push(...renderLeaf(part, { ...ctx, keyPrefix: `${kp}-um-${i}` }, depth + 1));
            }
        });
        return result;
    }

    // Parse <#channelId> channel mentions
    const channelMentionRe = /<#([a-zA-Z0-9_-]+)>/g;
    if (channelMentionRe.test(text)) {
        const parts = text.split(/(<#[a-zA-Z0-9_-]+>)/g);
        const result: React.ReactNode[] = [];
        parts.forEach((part, i) => {
            const m = part.match(/^<#([a-zA-Z0-9_-]+)>$/);
            if (m) {
                const channelId = m[1];
                const channel = ctx.channels?.find(c => c.id === channelId);
                const channelName = channel ? channel.name : channelId;
                result.push(
                    <span key={`${kp}-cmention-${i}`} className="mention">#{channelName}</span>
                );
            } else if (part) {
                result.push(...renderLeaf(part, { ...ctx, keyPrefix: `${kp}-cm-${i}` }, depth + 1));
            }
        });
        return result;
    }

    // Handle already-stored custom:name:url tokens (legacy format from old preprocessMessage)
    const customTokenRe = /(custom:[a-zA-Z0-9_]+:https?:\/\/[^\s]+)/g;
    if (customTokenRe.test(text)) {
        const tokenParts = text.split(/(custom:[a-zA-Z0-9_]+:https?:\/\/[^\s]+)/g);
        const tokenResult: React.ReactNode[] = [];
        tokenParts.forEach((part, i) => {
            const m = part.match(/^custom:([a-zA-Z0-9_]+):(https?:\/\/.+)$/);
            if (m) {
                tokenResult.push(<CustomEmojiInline key={`${kp}-ctoken-${i}`} name={m[1]} url={m[2]} />);
            } else if (part) {
                tokenResult.push(...renderLeaf(part, { ...ctx, keyPrefix: `${kp}-ctr-${i}` }, depth + 1));
            }
        });
        return tokenResult;
    }

    // Split by URLs
    const urlRe = /(https?:\/\/[^\s]+)/g;
    const urlParts = text.split(urlRe);
    const result: React.ReactNode[] = [];

    urlParts.forEach((part, i) => {
        if (part.match(urlRe)) {
            if (IMAGE_URL_REGEX.test(part)) {
                result.push(
                    <span key={`${kp}-imgurl-${i}`}>
                        <a href={part} target="_blank" rel="noopener noreferrer" className="hover-underline" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontSize: '13px', wordBreak: 'break-all' }}
                        >{part}</a>
                        <div style={{ maxWidth: 'min(400px, 100%)', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)', cursor: 'pointer', marginTop: '4px', marginBottom: '4px' }}>
                            <img src={part} alt="Embedded image" loading="lazy" style={{ width: '100%', display: 'block', objectFit: 'cover', maxHeight: '350px' }} onClick={() => window.open(part, '_blank')} />
                        </div>
                    </span>
                );
            } else {
                result.push(
                    <a key={`${kp}-url-${i}`} href={part} target="_blank" rel="noopener noreferrer"
                        style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}
                        className="hover-underline"
                        onClick={(e) => handleExternalLinkClick(e, part)}
                    >{part}</a>
                );
            }
        } else {
            // Process custom emojis :name:
            result.push(...renderCustomEmojis(part, ctx, `${kp}-ce-${i}`));
        }
    });

    return result;
}

function renderCustomEmojis(text: string, ctx: InlineCtx, keyPrefix: string): React.ReactNode[] {
    if (!ctx.customEmojis || ctx.customEmojis.length === 0 || !text) return [text];
    const re = /:([a-zA-Z0-9_]{2,}):/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = re.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(text.slice(lastIndex, match.index));
        }
        const emojiName = match[1];
        const found = ctx.customEmojis.find(e => e.name.toLowerCase() === emojiName.toLowerCase());
        if (found) {
            parts.push(<CustomEmojiInline key={`${keyPrefix}-${match.index}`} name={found.name} url={found.url} />);
        } else {
            parts.push(match[0]);
        }
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    if (parts.length === 0) return [text];
    return parts;
}

// ─── Block-Level Parser ───────────────────────────────────────────────────────
// Handles: code blocks, block quotes, headers, subtext, lists, then inline.

export const RichTextRenderer: React.FC<RichTextRendererProps> = ({ content, customEmojis, members, channels }) => {
    if (!content) return null;

    const ctx: InlineCtx = { customEmojis, members, channels, keyPrefix: 'rt' };

    // 1. Split by code blocks first — they are sacred (no formatting inside)
    const codeBlockRe = /```([\s\S]*?)```/g;
    const topParts = content.split(codeBlockRe);

    const rendered: React.ReactNode[] = [];

    topParts.forEach((part, idx) => {
        if (idx % 2 !== 0) {
            // Code block content — render with syntax highlighting, mermaid, or copy button
            const lines = part.trim();
            const firstNewline = lines.indexOf('\n');
            let lang = '';
            let code = lines;
            if (firstNewline > 0 && firstNewline < 20 && /^[a-zA-Z0-9+#]+$/.test(lines.slice(0, firstNewline).trim())) {
                lang = lines.slice(0, firstNewline).trim();
                code = lines.slice(firstNewline + 1);
            }
            // Feature 3: Mermaid diagram rendering
            if (lang.toLowerCase() === 'mermaid') {
                rendered.push(<MermaidBlock key={`mermaid-${idx}`} code={code} idx={idx} />);
                return;
            }
            rendered.push(<CodeBlock key={`cb-${idx}`} code={code} lang={lang} idx={idx} />);
            return;
        }

        // Non-code-block text — parse block-level elements line by line
        const lines = part.split('\n');
        let i = 0;
        let blockQuoteBuffer: string[] = [];
        let listBuffer: Array<{ indent: number; ordered: boolean; num?: string; text: string }> = [];

        const flushBlockQuote = () => {
            if (blockQuoteBuffer.length === 0) return;
            rendered.push(
                <blockquote key={`bq-${idx}-${i}`} style={{
                    borderLeft: '4px solid var(--accent-primary)', paddingLeft: '12px',
                    margin: '4px 0', color: 'var(--text-secondary)',
                }}>
                    {blockQuoteBuffer.map((line, li) => (
                        <div key={li}>{renderInline(line, { ...ctx, keyPrefix: `bq-${idx}-${li}` })}</div>
                    ))}
                </blockquote>
            );
            blockQuoteBuffer = [];
        };

        const flushList = () => {
            if (listBuffer.length === 0) return;
            // Group consecutive items; build nested lists from indentation
            const isOrdered = listBuffer[0].ordered;
            const Tag = isOrdered ? 'ol' : 'ul';
            rendered.push(
                <Tag key={`list-${idx}-${i}`} style={{
                    margin: '4px 0', paddingLeft: '24px',
                    listStyleType: isOrdered ? 'decimal' : 'disc',
                    color: 'var(--text-secondary)',
                }}>
                    {listBuffer.map((item, li) => (
                        <li key={li} style={{ marginLeft: item.indent > 0 ? `${item.indent * 16}px` : undefined, marginBottom: '2px' }}>
                            {renderInline(item.text, { ...ctx, keyPrefix: `li-${idx}-${li}` })}
                        </li>
                    ))}
                </Tag>
            );
            listBuffer = [];
        };

        while (i < lines.length) {
            const line = lines[i];
            const trimmed = line.trimStart();

            // Multi-line block quote >>>
            if (trimmed.startsWith('>>> ')) {
                flushList();
                // Everything from here to end of this part is a block quote
                blockQuoteBuffer.push(trimmed.slice(4));
                i++;
                while (i < lines.length) {
                    blockQuoteBuffer.push(lines[i]);
                    i++;
                }
                flushBlockQuote();
                continue;
            }

            // Single-line block quote >
            if (trimmed.startsWith('> ')) {
                flushList();
                blockQuoteBuffer.push(trimmed.slice(2));
                i++;
                continue;
            } else if (blockQuoteBuffer.length > 0) {
                flushBlockQuote();
            }

            // Headers: # ## ###
            if (trimmed.startsWith('### ')) {
                flushList();
                rendered.push(
                    <h3 key={`h3-${idx}-${i}`} style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: '8px 0 4px' }}>
                        {renderInline(trimmed.slice(4), { ...ctx, keyPrefix: `h3-${idx}-${i}` })}
                    </h3>
                );
                i++;
                continue;
            }
            if (trimmed.startsWith('## ')) {
                flushList();
                rendered.push(
                    <h2 key={`h2-${idx}-${i}`} style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: '8px 0 4px' }}>
                        {renderInline(trimmed.slice(3), { ...ctx, keyPrefix: `h2-${idx}-${i}` })}
                    </h2>
                );
                i++;
                continue;
            }
            if (trimmed.startsWith('# ')) {
                flushList();
                rendered.push(
                    <h1 key={`h1-${idx}-${i}`} style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', margin: '8px 0 4px' }}>
                        {renderInline(trimmed.slice(2), { ...ctx, keyPrefix: `h1-${idx}-${i}` })}
                    </h1>
                );
                i++;
                continue;
            }

            // Subtext: -# text
            if (trimmed.startsWith('-# ')) {
                flushList();
                rendered.push(
                    <div key={`sub-${idx}-${i}`} style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', marginBottom: '2px' }}>
                        {renderInline(trimmed.slice(3), { ...ctx, keyPrefix: `sub-${idx}-${i}` })}
                    </div>
                );
                i++;
                continue;
            }

            // Unordered list: - item or * item
            const ulMatch = line.match(/^( *)[-*] (.+)$/);
            if (ulMatch) {
                flushBlockQuote();
                const indent = Math.floor(ulMatch[1].length / 2);
                listBuffer.push({ indent, ordered: false, text: ulMatch[2] });
                i++;
                continue;
            }

            // Ordered list: 1. item
            const olMatch = line.match(/^( *)(\d+)\. (.+)$/);
            if (olMatch) {
                flushBlockQuote();
                const indent = Math.floor(olMatch[1].length / 2);
                listBuffer.push({ indent, ordered: true, num: olMatch[2], text: olMatch[3] });
                i++;
                continue;
            }

            // If we had a list going, flush it
            if (listBuffer.length > 0) {
                flushList();
            }

            // Feature 1: Block math $$...$$
            if (trimmed.startsWith('$$')) {
                flushList();
                // Single-line block math: $$e=mc^2$$
                if (trimmed.endsWith('$$') && trimmed.length > 4) {
                    const tex = trimmed.slice(2, -2).trim();
                    rendered.push(<BlockMath key={`bmath-${idx}-${i}`} tex={tex} keyStr={`bmath-${idx}-${i}`} />);
                    i++;
                    continue;
                }
                // Multi-line block math
                const mathLines: string[] = [];
                i++; // skip opening $$
                while (i < lines.length && !lines[i].trim().startsWith('$$')) {
                    mathLines.push(lines[i]);
                    i++;
                }
                if (i < lines.length) i++; // skip closing $$
                rendered.push(<BlockMath key={`bmath-${idx}-${i}`} tex={mathLines.join('\n')} keyStr={`bmath-${idx}-${i}`} />);
                continue;
            }

            // Feature 2: Markdown tables (| header | header | with |---|---| separator)
            if (trimmed.includes('|') && i + 1 < lines.length) {
                const nextTrimmed = lines[i + 1]?.trim() || '';
                // Check if next line is a separator row like |---|---|
                if (/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(nextTrimmed)) {
                    flushList();
                    const tableRows: string[] = [trimmed, nextTrimmed];
                    let ti = i + 2;
                    while (ti < lines.length && lines[ti].trim().includes('|')) {
                        tableRows.push(lines[ti].trim());
                        ti++;
                    }
                    rendered.push(<MarkdownTable key={`table-${idx}-${i}`} rows={tableRows} ctx={ctx} keyStr={`table-${idx}-${i}`} />);
                    i = ti;
                    continue;
                }
            }

            // Empty line
            if (trimmed === '') {
                i++;
                continue;
            }

            // Regular line — apply inline formatting
            rendered.push(
                <div key={`line-${idx}-${i}`} style={{ minHeight: '1.4em' }}>
                    {renderInline(line, { ...ctx, keyPrefix: `line-${idx}-${i}` })}
                </div>
            );
            i++;
        }

        // Flush any remaining buffers
        flushBlockQuote();
        flushList();
    });

    return (
        <div style={{ wordBreak: 'break-word' }}>
            {rendered}
        </div>
    );
};
