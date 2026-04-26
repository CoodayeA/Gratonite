import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import LoadingRow from '../../ui/LoadingRow';

function BackupsPanel({ guildId, addToast }: { guildId: string; addToast: (t: any) => void }) {
    const [backups, setBackups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [backupName, setBackupName] = useState('');
    const [verifyState, setVerifyState] = useState<Record<string, { loading: boolean; result: any | null }>>({});
    const [dryRunState, setDryRunState] = useState<Record<string, { loading: boolean; result: any | null; open: boolean }>>({});

    useEffect(() => {
        api.guildBackup.list(guildId).then(setBackups).catch(() => {}).finally(() => setLoading(false));
    }, [guildId]);

    const createBackup = async () => {
        setCreating(true);
        try {
            const backup = await api.guildBackup.create(guildId, backupName || undefined);
            setBackups(prev => [backup, ...prev]);
            setBackupName('');
            addToast({ title: 'Backup created', variant: 'success' });
        } catch { addToast({ title: 'Failed to create backup', variant: 'error' }); }
        finally { setCreating(false); }
    };

    const downloadBackup = async (backupId: string) => {
        try {
            const data = await api.guildBackup.get(guildId, backupId);
            const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `backup-${data.name}.json`; a.click();
            URL.revokeObjectURL(url);
        } catch { addToast({ title: 'Failed to download', variant: 'error' }); }
    };

    const verifyBackup = async (backupId: string) => {
        setVerifyState(prev => ({ ...prev, [backupId]: { loading: true, result: null } }));
        try {
            const result = await api.guildBackup.verify(guildId, backupId);
            setVerifyState(prev => ({ ...prev, [backupId]: { loading: false, result } }));
        } catch {
            setVerifyState(prev => ({ ...prev, [backupId]: { loading: false, result: { ok: false, detail: 'Verification failed' } } }));
        }
    };

    const runDryRun = async (backupId: string) => {
        setDryRunState(prev => ({ ...prev, [backupId]: { loading: true, result: null, open: true } }));
        try {
            const result = await api.guildBackup.dryRun(guildId, backupId);
            setDryRunState(prev => ({ ...prev, [backupId]: { loading: false, result, open: true } }));
        } catch {
            setDryRunState(prev => ({ ...prev, [backupId]: { loading: false, result: null, open: true } }));
            addToast({ title: 'Failed to run dry-run', variant: 'error' });
        }
    };

    return (
        <>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Server Backups</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>Export your server structure (channels, roles, settings) as JSON backups.</p>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                <input type="text" value={backupName} onChange={e => setBackupName(e.target.value)} placeholder="Backup name (optional)" style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px' }} />
                <button onClick={createBackup} disabled={creating} style={{ padding: '10px 24px', borderRadius: '8px', background: 'var(--accent-primary)', border: 'none', color: '#000', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>
                    {creating ? 'Creating...' : 'Create Backup'}
                </button>
            </div>

            {loading ? (
                <div style={{ padding: '48px 16px' }}><LoadingRow inline /></div>
            ) : backups.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>No backups yet.</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {backups.map(b => {
                        const verify = verifyState[b.id];
                        const dryRun = dryRunState[b.id];
                        return (
                            <div key={b.id}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: dryRun?.open ? '10px 10px 0 0' : '10px' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{b.name}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                            {new Date(b.createdAt).toLocaleString()} · {Math.round((b.sizeBytes || 0) / 1024)} KB
                                            {verify?.result && (
                                                <span style={{ marginLeft: '10px', color: verify.result.ok ? 'var(--success, #22c55e)' : 'var(--error, #ef4444)', fontWeight: 600 }}>
                                                    {verify.result.ok ? '✓ Integrity OK' : '⚠ Checksum mismatch'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                        <button
                                            onClick={() => void verifyBackup(b.id)}
                                            disabled={verify?.loading}
                                            title="Verify backup integrity"
                                            style={{ padding: '6px 12px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: verify?.result ? (verify.result.ok ? 'var(--success, #22c55e)' : 'var(--error, #ef4444)') : 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, opacity: verify?.loading ? 0.6 : 1 }}
                                        >
                                            {verify?.loading ? '...' : '🔍 Verify'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (dryRun?.open && dryRun.result) {
                                                    setDryRunState(prev => ({ ...prev, [b.id]: { ...prev[b.id], open: !dryRun.open } }));
                                                } else {
                                                    void runDryRun(b.id);
                                                }
                                            }}
                                            disabled={dryRun?.loading}
                                            title="Preview restore without applying"
                                            style={{ padding: '6px 12px', borderRadius: '6px', background: dryRun?.open ? 'rgba(99,102,241,0.12)' : 'var(--bg-tertiary)', border: `1px solid ${dryRun?.open ? '#6366f1' : 'var(--stroke)'}`, color: dryRun?.open ? '#818cf8' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, opacity: dryRun?.loading ? 0.6 : 1 }}
                                        >
                                            {dryRun?.loading ? '...' : '🔎 Dry Run'}
                                        </button>
                                        <button onClick={() => downloadBackup(b.id)} style={{ padding: '6px 12px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Download</button>
                                        <button onClick={async () => {
                                            try { await api.guildBackup.delete(guildId, b.id); setBackups(prev => prev.filter(x => x.id !== b.id)); addToast({ title: 'Backup deleted', variant: 'info' }); } catch { addToast({ title: 'Failed to delete backup', variant: 'error' }); }
                                        }} style={{ padding: '6px 12px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--error)', color: 'var(--error)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Delete</button>
                                    </div>
                                </div>
                                {dryRun?.open && dryRun.result && (
                                    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--stroke)', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '12px 16px' }}>
                                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Dry Run — What Would Be Restored</div>
                                        <div style={{ display: 'flex', gap: '16px', marginBottom: '8px', flexWrap: 'wrap' }}>
                                            {(dryRun.result.wouldRestore as string[]).map((item: string) => (
                                                <span key={item} style={{ fontSize: '13px', background: 'var(--bg-tertiary)', padding: '4px 10px', borderRadius: '6px', color: 'var(--text-primary)' }}>✓ {item}</span>
                                            ))}
                                        </div>
                                        {dryRun.result.warnings?.length > 0 && (
                                            <div style={{ fontSize: '12px', color: '#fbbf24', marginTop: '6px' }}>
                                                ⚠ {(dryRun.result.warnings as string[]).join(' · ')}
                                            </div>
                                        )}
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                                            Export version {dryRun.result.summary?.version ?? 1} · {dryRun.result.summary?.exportedAt ? new Date(dryRun.result.summary.exportedAt).toLocaleDateString() : 'Unknown date'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
}

// ─── Highlights Panel (Item 103) ─────────────────────────────────────────────

export default BackupsPanel;
