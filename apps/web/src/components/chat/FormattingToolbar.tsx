import React from 'react';
import { Bold, Italic, Strikethrough, Code, Heading1, Eye } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';

interface Props {
    textareaSelector: string;
    onInputChange: (value: string) => void;
    getValue: () => string;
}

function wrapSelection(textareaSelector: string, before: string, after: string, getValue: () => string, onInputChange: (v: string) => void) {
    const ta = document.querySelector(textareaSelector) as HTMLTextAreaElement | null;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const value = getValue();
    const selected = value.slice(start, end);
    const newValue = value.slice(0, start) + before + selected + after + value.slice(end);
    onInputChange(newValue);
    // Restore cursor position after wrapping
    requestAnimationFrame(() => {
        ta.focus();
        if (selected.length > 0) {
            ta.setSelectionRange(start + before.length, end + before.length);
        } else {
            ta.setSelectionRange(start + before.length, start + before.length);
        }
    });
}

const buttons = [
    { icon: Bold, label: 'Bold', before: '**', after: '**' },
    { icon: Italic, label: 'Italic', before: '*', after: '*' },
    { icon: Strikethrough, label: 'Strikethrough', before: '~~', after: '~~' },
    { icon: Code, label: 'Code', before: '`', after: '`' },
    { icon: Eye, label: 'Spoiler', before: '||', after: '||' },
    { icon: Heading1, label: 'Heading', before: '# ', after: '' },
];

export function FormattingToolbar({ textareaSelector, onInputChange, getValue }: Props) {
    return (
        <div style={{
            display: 'flex', gap: '2px', padding: '4px 8px',
            background: 'var(--bg-tertiary)', borderRadius: '8px 8px 0 0',
            borderBottom: '1px solid var(--stroke)',
        }}>
            {buttons.map(btn => (
                <Tooltip key={btn.label} content={btn.label} position="top">
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            wrapSelection(textareaSelector, btn.before, btn.after, getValue, onInputChange);
                        }}
                        onMouseDown={e => e.preventDefault()}
                        style={{
                            background: 'transparent', border: 'none', color: 'var(--text-muted)',
                            cursor: 'pointer', padding: '4px 6px', borderRadius: '4px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.15s',
                        }}
                        className="hover-bg-secondary-text-primary"
                    >
                        <btn.icon size={14} />
                    </button>
                </Tooltip>
            ))}
        </div>
    );
}
