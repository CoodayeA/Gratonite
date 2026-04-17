import { useState, useRef } from 'react';
import { api } from '../../../lib/api';

function ImportWizard({ guildId, addToast }: { guildId: string; addToast: (t: any) => void }) {
    const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
    const [source, setSource] = useState<'discord' | 'slack'>('discord');
    const [parsedData, setParsedData] = useState<{ channels: any[]; roles: any[] } | null>(null);
    const [result, setResult] = useState<{ categories: number; channels: number; roles: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFile = (file: File) => {
        setError(null);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);
                // Server exports have guild.channels and guild.roles, or top-level channels/roles
                const channels = json.channels || json.guild?.channels || [];
                const roles = json.roles || json.guild?.roles || [];
                if (channels.length === 0 && roles.length === 0) {
                    setError('No channels or roles found in the export file. Make sure the file is a valid server or workspace export.');
                    return;
                }
                setParsedData({ channels, roles });
                setStep('preview');
            } catch {
                setError('Invalid JSON file. Please upload a valid export file.');
            }
        };
        reader.readAsText(file);
    };

    const handleImport = async () => {
        if (!parsedData) return;
        setStep('importing');
        setError(null);
        try {
            const res = await api.guilds.importServer(guildId, {
                source,
                channels: parsedData.channels,
                roles: parsedData.roles,
            });
            setResult(res.created);
            setStep('done');
            addToast({ title: 'Import complete!', variant: 'success' });
        } catch (err: any) {
            setError(err?.message || 'Import failed');
            setStep('preview');
        }
    };

    const discordTypeNames: Record<number, string> = { 0: 'Text', 2: 'Voice', 4: 'Category', 5: 'Announcement', 13: 'Stage', 15: 'Forum' };

    if (step === 'done' && result) {
        return (
            <>
                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Import Complete</h2>
                <div style={{ background: 'var(--bg-tertiary)', padding: '24px', borderRadius: '12px', border: '1px solid var(--stroke)', textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#10003;</div>
                    <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Successfully imported</div>
                    <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
                        <div><strong>{result.categories}</strong> categories</div>
                        <div><strong>{result.channels}</strong> channels</div>
                        <div><strong>{result.roles}</strong> roles</div>
                    </div>
                    <button onClick={() => { setStep('upload'); setParsedData(null); setResult(null); }}
                        style={{ marginTop: '20px', padding: '8px 20px', background: 'var(--accent-primary)', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                        Import Another
                    </button>
                </div>
            </>
        );
    }

    if (step === 'importing') {
        return (
            <>
                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Importing...</h2>
                <div style={{ background: 'var(--bg-tertiary)', padding: '40px', borderRadius: '12px', border: '1px solid var(--stroke)', textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Creating channels and roles, please wait...</div>
                </div>
            </>
        );
    }

    if (step === 'preview' && parsedData) {
        const categories = parsedData.channels.filter((c: any) => (typeof c.type === 'number' ? c.type : parseInt(c.type)) === 4);
        const textChannels = parsedData.channels.filter((c: any) => { const t = typeof c.type === 'number' ? c.type : parseInt(c.type); return t === 0 || t === 5 || t === 15; });
        const voiceChannels = parsedData.channels.filter((c: any) => { const t = typeof c.type === 'number' ? c.type : parseInt(c.type); return t === 2 || t === 13; });
        const filteredRoles = parsedData.roles.filter((r: any) => r.name !== '@everyone');

        return (
            <>
                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Preview Import</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '13px' }}>
                    Review what will be imported from your {source === 'discord' ? 'server' : 'workspace'} export.
                </p>
                {error && <div style={{ background: 'var(--error)', color: 'white', padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '13px' }}>{error}</div>}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '10px', border: '1px solid var(--stroke)' }}>
                        <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '14px' }}>Channels ({parsedData.channels.length})</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {categories.length} categories, {textChannels.length} text, {voiceChannels.length} voice
                        </div>
                    </div>
                    <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '10px', border: '1px solid var(--stroke)' }}>
                        <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '14px' }}>Roles ({filteredRoles.length})</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {filteredRoles.slice(0, 5).map((r: any) => r.name).join(', ')}{filteredRoles.length > 5 ? ` +${filteredRoles.length - 5} more` : ''}
                        </div>
                    </div>
                </div>

                {parsedData.channels.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '13px' }}>Channels to create:</div>
                        <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {parsedData.channels.slice(0, 50).map((ch: any, i: number) => {
                                const typeNum = typeof ch.type === 'number' ? ch.type : parseInt(ch.type);
                                return (
                                    <div key={ch.id || i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px', background: 'var(--bg-tertiary)', borderRadius: '6px', fontSize: '13px' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '11px', minWidth: '60px' }}>{discordTypeNames[typeNum] || 'Text'}</span>
                                        <span>{ch.name}</span>
                                    </div>
                                );
                            })}
                            {parsedData.channels.length > 50 && <div style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '4px 8px' }}>...and {parsedData.channels.length - 50} more</div>}
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => { setStep('upload'); setParsedData(null); setError(null); }}
                        style={{ padding: '8px 16px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--stroke)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>
                        Back
                    </button>
                    <button onClick={handleImport}
                        style={{ padding: '8px 20px', background: 'var(--accent-primary)', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                        Import {parsedData.channels.length} channels and {filteredRoles.length} roles
                    </button>
                </div>
            </>
        );
    }

    // Upload step
    return (
        <>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Import Server</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>
                Import channels and roles from another platform's JSON export.
            </p>

            <div style={{ marginBottom: '20px' }}>
                <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '14px' }}>Source</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {(['discord', 'slack'] as const).map(s => (
                        <button key={s} onClick={() => setSource(s)}
                            style={{
                                padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                                background: source === s ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                color: source === s ? '#000' : 'var(--text-secondary)',
                                border: source === s ? 'none' : '1px solid var(--stroke)',
                            }}>
                            {s === 'discord' ? 'Server Export' : 'Workspace Export'}
                        </button>
                    ))}
                </div>
            </div>

            {error && <div style={{ background: 'var(--error)', color: 'white', padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '13px' }}>{error}</div>}

            <div
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
                onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--stroke)'; }}
                onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--stroke)'; const file = e.dataTransfer.files[0]; if (file) handleFile(file); }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                    border: '2px dashed var(--stroke)', borderRadius: '12px', padding: '48px 24px',
                    textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s',
                    background: 'var(--bg-tertiary)',
                }}>
                <div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.5 }}>&#128196;</div>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>Drop your export file here</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>or click to browse. Accepts .json files.</div>
                <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }}
                    onChange={e => { const file = e.target.files?.[0]; if (file) handleFile(file); }} />
            </div>

            <div style={{ marginTop: '20px', background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '10px', border: '1px solid var(--stroke)' }}>
                <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '13px' }}>How to export in {source === 'discord' ? 'server' : 'workspace'} JSON format</div>
                {source === 'discord' ? (
                    <ol style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0, paddingLeft: '16px', lineHeight: 1.8 }}>
                        <li>Use a server export tool to export your server in JSON format</li>
                        <li>Include channels and roles in the export</li>
                        <li>Upload the exported .json file above</li>
                    </ol>
                ) : (
                    <ol style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0, paddingLeft: '16px', lineHeight: 1.8 }}>
                        <li>Go to your workspace settings</li>
                        <li>Navigate to Import/Export Data and click Export</li>
                        <li>Extract the .zip and upload the channels.json file above</li>
                    </ol>
                )}
            </div>
        </>
    );
}

export default ImportWizard;
