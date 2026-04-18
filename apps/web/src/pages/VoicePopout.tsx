import { useEffect, useMemo, useState } from 'react';
import { Mic, MicOff, Headphones, HeadphoneOff, MonitorUp, PhoneOff, ArrowLeft } from 'lucide-react';

type ConnectionQuality = 'good' | 'fair' | 'poor';

interface VoicePopoutState {
    activeCallType: 'guild' | 'dm' | null;
    connected: boolean;
    channelId: string | null;
    channelName: string;
    guildId: string;
    guildName: string;
    muted: boolean;
    deafened: boolean;
    screenSharing: boolean;
    participantCount: number;
    connectionQuality: ConnectionQuality;
}

const defaultState: VoicePopoutState = {
    activeCallType: null,
    connected: true,
    channelId: null,
    channelName: '',
    guildId: '',
    guildName: '',
    muted: true,
    deafened: false,
    screenSharing: false,
    participantCount: 1,
    connectionQuality: 'good',
};

export default function VoicePopout() {
    const params = new URLSearchParams(window.location.search);
    const initialChannelName = params.get('channelName') || 'Voice Channel';
    const initialCallType = params.get('callType') === 'dm' ? 'dm' : 'guild';
    const initialGuildName = params.get('guildName') || '';
    const [voiceState, setVoiceState] = useState<VoicePopoutState>({
        ...defaultState,
        activeCallType: initialCallType,
        channelId: params.get('channelId'),
        channelName: initialChannelName,
        guildId: params.get('guildId') || '',
        guildName: initialGuildName,
    });

    const connectionColor = voiceState.connectionQuality === 'good'
        ? '#43b581'
        : voiceState.connectionQuality === 'fair'
            ? '#faa61a'
            : '#ed4245';

    const subtitle = useMemo(() => {
        if (voiceState.activeCallType === 'dm') {
            return voiceState.participantCount > 1
                ? `${voiceState.participantCount} people in call`
                : 'Direct message call';
        }

        if (voiceState.guildName) {
            return `${voiceState.guildName} · ${voiceState.participantCount} connected`;
        }

        return `${voiceState.participantCount} connected`;
    }, [voiceState.activeCallType, voiceState.guildName, voiceState.participantCount]);

    const postAction = (action: 'toggleMute' | 'toggleDeafen' | 'disconnect' | 'returnToCall') => {
        window.opener?.postMessage({ type: 'GRATONITE_VOICE_ACTION', action }, window.location.origin);
        if (action === 'returnToCall') {
            window.opener?.focus();
            window.close();
        }
        if (action === 'disconnect') {
            window.close();
        }
    };

    const handleReturn = () => {
        postAction('returnToCall');
    };

    useEffect(() => {
        window.opener?.postMessage({ type: 'GRATONITE_VOICE_POPOUT_READY' }, window.location.origin);

        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            const { data } = event;
            if (!data || typeof data !== 'object' || data.type !== 'GRATONITE_VOICE_STATE') return;
            setVoiceState((prev) => ({ ...prev, ...(data.payload as Partial<VoicePopoutState>) }));
        };

        window.addEventListener('message', handleMessage);
        const id = setInterval(() => {
            if (window.opener === null || (window.opener as any).closed) window.close();
        }, 2000);
        return () => {
            window.removeEventListener('message', handleMessage);
            clearInterval(id);
        };
    }, []);

    return (
        <div style={{
            background: 'radial-gradient(circle at top, rgba(88, 101, 242, 0.2), transparent 45%), #111214',
            color: '#fff',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            padding: 24,
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <button
                    type="button"
                    onClick={handleReturn}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        background: 'rgba(255,255,255,0.06)',
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 999,
                        padding: '10px 14px',
                        cursor: 'pointer',
                        fontWeight: 600,
                    }}
                >
                    <ArrowLeft size={16} />
                    Return
                </button>
                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    fontSize: 12,
                    color: '#c7cad1',
                }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: connectionColor, boxShadow: `0 0 10px ${connectionColor}` }} />
                    {voiceState.connectionQuality}
                </div>
            </div>

            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 18,
                textAlign: 'center',
                borderRadius: 24,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(20px)',
                padding: 28,
                boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
            }}>
                <div style={{
                    width: 88,
                    height: 88,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    background: 'linear-gradient(135deg, rgba(88, 101, 242, 0.9), rgba(67, 181, 129, 0.8))',
                    boxShadow: '0 20px 40px rgba(88, 101, 242, 0.28)',
                }}>
                    <span style={{ fontSize: 36 }}>{voiceState.activeCallType === 'dm' ? 'DM' : '#'}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>{voiceState.channelName || initialChannelName}</div>
                    <div style={{ fontSize: 14, color: '#aeb4c2' }}>{subtitle}</div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
                    <div style={{ padding: '8px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', fontSize: 12, color: '#d7dbe4' }}>
                        {voiceState.connected ? 'Call live' : 'Disconnected'}
                    </div>
                    <div style={{ padding: '8px 12px', borderRadius: 999, background: voiceState.screenSharing ? 'rgba(88, 101, 242, 0.2)' : 'rgba(255,255,255,0.06)', fontSize: 12, color: '#d7dbe4', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <MonitorUp size={14} />
                        {voiceState.screenSharing ? 'Sharing screen' : 'No screen share'}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                    <button
                        type="button"
                        onClick={() => postAction('toggleMute')}
                        aria-label={voiceState.muted ? 'Unmute microphone' : 'Mute microphone'}
                        style={{
                            width: 56,
                            height: 56,
                            borderRadius: '50%',
                            border: 'none',
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer',
                            background: voiceState.muted ? 'rgba(237, 66, 69, 0.18)' : 'rgba(255,255,255,0.08)',
                            color: voiceState.muted ? '#ed4245' : '#fff',
                        }}
                    >
                        {voiceState.muted ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>
                    <button
                        type="button"
                        onClick={() => postAction('toggleDeafen')}
                        aria-label={voiceState.deafened ? 'Undeafen audio' : 'Deafen audio'}
                        style={{
                            width: 56,
                            height: 56,
                            borderRadius: '50%',
                            border: 'none',
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer',
                            background: voiceState.deafened ? 'rgba(237, 66, 69, 0.18)' : 'rgba(255,255,255,0.08)',
                            color: voiceState.deafened ? '#ed4245' : '#fff',
                        }}
                    >
                        {voiceState.deafened ? <HeadphoneOff size={20} /> : <Headphones size={20} />}
                    </button>
                    <button
                        type="button"
                        onClick={() => postAction('disconnect')}
                        aria-label="Disconnect from call"
                        style={{
                            width: 56,
                            height: 56,
                            borderRadius: '50%',
                            border: 'none',
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer',
                            background: '#ed4245',
                            color: '#fff',
                            boxShadow: '0 10px 24px rgba(237, 66, 69, 0.35)',
                        }}
                    >
                        <PhoneOff size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
}
