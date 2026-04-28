import { useState, useId } from 'react';
import { api } from '../../../lib/api';

function GuildDiscoveryTagsPanel({ guildId, addToast, guildTags, setGuildTags, guildCategory, setGuildCategory }: { guildId: string; addToast: (t: any) => void; guildTags: string[]; setGuildTags: (t: string[]) => void; guildCategory: string; setGuildCategory: (c: string) => void }) {
    const categorySelectId = useId();
    const [tagInput, setTagInput] = useState('');
    const SUGGESTED_TAGS = ['gaming', 'music', 'art', 'technology', 'education', 'community', 'anime', 'memes', 'programming', 'social', 'roleplay', 'science'];
    const CATEGORIES = ['gaming', 'music', 'art', 'tech', 'community', 'anime', 'education', 'other'];

    const addTag = (tag: string) => {
        const normalized = tag.toLowerCase().trim();
        if (normalized && !guildTags.includes(normalized) && guildTags.length < 10) {
            setGuildTags([...guildTags, normalized]);
        }
        setTagInput('');
    };

    const removeTag = (tag: string) => {
        setGuildTags(guildTags.filter(t => t !== tag));
    };

    const save = async () => {
        try {
            await api.patch(`/guilds/${guildId}`, { tags: guildTags, category: guildCategory || null });
            addToast({ title: 'Discovery settings saved', variant: 'success' });
        } catch {
            addToast({ title: 'Failed to save', variant: 'error' });
        }
    };

    return (
        <>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Discovery Tags</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>
                Help people find your server by adding tags and a category. Servers with tags appear in the Discover page.
            </p>

            <div style={{ marginBottom: '24px' }}>
                <label htmlFor={categorySelectId} style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>CATEGORY</label>
                <select id={categorySelectId} value={guildCategory} onChange={e => setGuildCategory(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}>
                    <option value="">Select a category...</option>
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>)}
                </select>
            </div>

            <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>TAGS ({guildTags.length}/10)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                    {guildTags.map(tag => (
                        <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: 'var(--accent-primary)', borderRadius: '999px', fontSize: '12px', color: 'white' }}>
                            {tag}
                            <button onClick={() => removeTag(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'white', display: 'flex', alignItems: 'center', opacity: 0.7 }}>x</button>
                        </span>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && tagInput.trim()) { e.preventDefault(); addTag(tagInput); } }}
                        placeholder="Type a tag and press Enter"
                        style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}
                    />
                </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>SUGGESTED TAGS</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {SUGGESTED_TAGS.filter(t => !guildTags.includes(t)).map(tag => (
                        <button
                            key={tag}
                            onClick={() => addTag(tag)}
                            disabled={guildTags.length >= 10}
                            style={{ padding: '4px 10px', borderRadius: '999px', border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', cursor: guildTags.length >= 10 ? 'not-allowed' : 'pointer', fontSize: '12px', opacity: guildTags.length >= 10 ? 0.5 : 1 }}
                        >
                            + {tag}
                        </button>
                    ))}
                </div>
            </div>

            <button onClick={save} style={{ padding: '10px 24px', borderRadius: '8px', background: 'var(--accent-primary)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                Save Discovery Settings
            </button>
        </>
    );
}

export default GuildDiscoveryTagsPanel;
