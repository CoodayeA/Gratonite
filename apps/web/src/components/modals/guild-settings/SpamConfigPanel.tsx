import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';

function SpamConfigPanel({ guildId, addToast }: { guildId: string; addToast: (t: any) => void }) {
    const [config, setConfig] = useState<any>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.spamConfig.get(guildId).then(setConfig).catch(() => {});
    }, [guildId]);

    if (!config) return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;

    const save = async () => {
        setSaving(true);
        try {
            const updated = await api.spamConfig.update(guildId, config);
            setConfig(updated);
            addToast({ title: 'Spam config saved', variant: 'success' });
        } catch { addToast({ title: 'Failed to save', variant: 'error' }); }
        finally { setSaving(false); }
    };

    const inputStyle = { width: '80px', padding: '6px 8px', borderRadius: '6px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '13px', textAlign: 'center' as const };
    const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' };

    return (
        <>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Spam Detection</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>Rule-based spam detection. No AI -- pure heuristics.</p>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', cursor: 'pointer' }}>
                <input type="checkbox" checked={config.enabled} onChange={e => setConfig({ ...config, enabled: e.target.checked })} style={{ accentColor: 'var(--accent-primary)' }} />
                <span style={{ fontWeight: 600 }}>Enable Spam Detection</span>
            </label>

            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '20px', marginBottom: '16px', opacity: config.enabled ? 1 : 0.5 }}>
                <div style={rowStyle}><span style={{ fontSize: '13px' }}>Max duplicate messages</span><input type="number" value={config.maxDuplicateMessages} onChange={e => setConfig({ ...config, maxDuplicateMessages: +e.target.value })} style={inputStyle} /></div>
                <div style={rowStyle}><span style={{ fontSize: '13px' }}>Duplicate window (sec)</span><input type="number" value={config.duplicateWindowSeconds} onChange={e => setConfig({ ...config, duplicateWindowSeconds: +e.target.value })} style={inputStyle} /></div>
                <div style={rowStyle}><span style={{ fontSize: '13px' }}>Max mentions per message</span><input type="number" value={config.maxMentionsPerMessage} onChange={e => setConfig({ ...config, maxMentionsPerMessage: +e.target.value })} style={inputStyle} /></div>
                <div style={rowStyle}><span style={{ fontSize: '13px' }}>Max links per message</span><input type="number" value={config.maxLinksPerMessage} onChange={e => setConfig({ ...config, maxLinksPerMessage: +e.target.value })} style={inputStyle} /></div>
                <div style={rowStyle}>
                    <span style={{ fontSize: '13px' }}>Action on detection</span>
                    <select value={config.action} onChange={e => setConfig({ ...config, action: e.target.value })} style={{ ...inputStyle, width: '120px' }}>
                        <option value="flag">Flag only</option>
                        <option value="mute">Auto-mute</option>
                        <option value="kick">Auto-kick</option>
                    </select>
                </div>
            </div>

            <button onClick={save} disabled={saving} style={{ padding: '10px 24px', borderRadius: '8px', background: 'var(--accent-primary)', border: 'none', color: '#000', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>
                {saving ? 'Saving...' : 'Save Config'}
            </button>
        </>
    );
}

export default SpamConfigPanel;
