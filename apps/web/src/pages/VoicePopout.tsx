import { useEffect } from 'react';

export default function VoicePopout() {
    const params = new URLSearchParams(window.location.search);
    const channelName = params.get('channelName') || 'Voice Channel';

    const handleReturn = () => {
        window.opener?.focus();
        window.close();
    };

    useEffect(() => {
        const id = setInterval(() => {
            if (window.opener === null || (window.opener as any).closed) window.close();
        }, 2000);
        return () => clearInterval(id);
    }, []);

    return (
        <div style={{
            background: '#1e1f22', color: '#fff', minHeight: '100vh',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 24, padding: 24,
        }}>
            <div style={{ fontSize: 32 }}>📞</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{channelName}</div>
            <div style={{ fontSize: 13, color: '#aaa' }}>Call in progress</div>
            <button
                onClick={handleReturn}
                style={{
                    background: '#5865f2', color: '#fff', border: 'none', borderRadius: 8,
                    padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
            >
                Return to Call
            </button>
        </div>
    );
}
