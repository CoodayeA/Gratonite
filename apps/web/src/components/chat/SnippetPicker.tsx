import { useState, useEffect, useCallback } from 'react';
import { Search, FileText, X } from 'lucide-react';
import { api } from '../../lib/api';

interface Snippet {
    id: string;
    title: string;
    content: string;
    tags: string[];
    usageCount: number;
}

interface SnippetPickerProps {
    onSelect: (content: string) => void;
    onClose: () => void;
}

export default function SnippetPicker({ onSelect, onClose }: SnippetPickerProps) {
    const [snippets, setSnippets] = useState<Snippet[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(0);

    useEffect(() => {
        api.get<Snippet[]>(`/users/@me/snippets${search ? `?search=${encodeURIComponent(search)}` : ''}`)
            .then(data => setSnippets(Array.isArray(data) ? data : []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [search]);

    const handleSelect = useCallback((snippet: Snippet) => {
        // Increment usage count in background
        api.post(`/users/@me/snippets/${snippet.id}/use`, {}).catch(() => {});
        onSelect(snippet.content);
    }, [onSelect]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelected(s => Math.min(s + 1, snippets.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelected(s => Math.max(s - 1, 0));
        } else if (e.key === 'Enter' && snippets[selected]) {
            e.preventDefault();
            handleSelect(snippets[selected]);
        } else if (e.key === 'Escape') {
            onClose();
        }
    }, [snippets, selected, handleSelect, onClose]);

    return (
        <div style={{
            position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: '8px',
            background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)', maxHeight: '320px', overflow: 'hidden',
            display: 'flex', flexDirection: 'column', zIndex: 100,
        }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Snippets</span>
                <div style={{ flex: 1 }} />
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}>
                    <X size={14} />
                </button>
            </div>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--stroke)' }}>
                <div style={{ position: 'relative' }}>
                    <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        autoFocus
                        placeholder="Search snippets..."
                        value={search}
                        onChange={e => { setSearch(e.target.value); setSelected(0); }}
                        onKeyDown={handleKeyDown}
                        style={{
                            width: '100%', padding: '8px 10px 8px 30px', background: 'var(--bg-tertiary)',
                            border: '1px solid var(--stroke)', borderRadius: '6px', color: 'var(--text-primary)',
                            fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                        }}
                    />
                </div>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '4px' }}>
                {loading ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Loading...</div>
                ) : snippets.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                        {search ? 'No matching snippets.' : 'No snippets yet. Create some in Settings.'}
                    </div>
                ) : (
                    snippets.map((s, i) => (
                        <div
                            key={s.id}
                            onClick={() => handleSelect(s)}
                            style={{
                                padding: '8px 10px', borderRadius: '6px', cursor: 'pointer',
                                background: i === selected ? 'var(--bg-tertiary)' : 'transparent',
                                transition: 'background 0.1s',
                            }}
                            onMouseEnter={() => setSelected(i)}
                        >
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>{s.title}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {s.content.slice(0, 100)}
                            </div>
                            {s.tags.length > 0 && (
                                <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                                    {s.tags.slice(0, 3).map(tag => (
                                        <span key={tag} style={{ padding: '1px 6px', borderRadius: '8px', background: 'rgba(99,102,241,0.12)', color: 'var(--accent-primary)', fontSize: '10px', fontWeight: 600 }}>{tag}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
