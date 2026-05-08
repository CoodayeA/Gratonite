import { useEffect, useMemo, useState } from 'react';
import {
    Mic,
    MicOff,
    Headphones,
    HeadphoneOff,
    MonitorUp,
    PhoneOff,
    Maximize2,
    GripVertical,
} from 'lucide-react';

/**
 * VoicePopout — C5 "Edge Ticker" design.
 *
 * A slim horizontal status bar that lives in a frameless popup window.
 * Shows the essential call state (channel, who's talking, screen-share status)
 * and the three primary actions: mic, deafen, hang up. Designed to snap to a
 * screen edge and stay out of the user's way.
 *
 * Communicates with the opener via window.postMessage; same protocol as before
 * (GRATONITE_VOICE_ACTION / GRATONITE_VOICE_STATE / GRATONITE_VOICE_POPOUT_READY).
 */

type ConnectionQuality = 'good' | 'fair' | 'poor';

interface ParticipantSnapshot {
    id: string;
    username: string;
    isSpeaking: boolean;
}

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
    participants?: ParticipantSnapshot[];
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
    participants: [],
};

const TICKER_HEIGHT = 56;

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

    const connectionColor =
        voiceState.connectionQuality === 'good'
            ? '#43b581'
            : voiceState.connectionQuality === 'fair'
              ? '#faa61a'
              : '#ed4245';

    const speakers = useMemo(() => {
        return (voiceState.participants ?? []).filter((p) => p.isSpeaking).slice(0, 3);
    }, [voiceState.participants]);

    const subtitle = useMemo(() => {
        if (speakers.length > 0) {
            const names = speakers.map((s) => s.username).join(', ');
            return `${names} ${speakers.length > 1 ? 'are' : 'is'} speaking`;
        }
        if (voiceState.activeCallType === 'dm') {
            return voiceState.participantCount > 1
                ? `${voiceState.participantCount} in call`
                : 'Direct message call';
        }
        if (voiceState.guildName) {
            return `${voiceState.guildName} · ${voiceState.participantCount} connected`;
        }
        return `${voiceState.participantCount} connected`;
    }, [speakers, voiceState.activeCallType, voiceState.guildName, voiceState.participantCount]);

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
            if (window.opener === null || (window.opener as { closed?: boolean }).closed) window.close();
        }, 2000);
        return () => {
            window.removeEventListener('message', handleMessage);
            clearInterval(id);
        };
    }, []);

    // Resize the actual browser window to a slim ticker shape on first mount.
    useEffect(() => {
        try {
            window.resizeTo(420, TICKER_HEIGHT + 8);
        } catch {
            /* some platforms restrict programmatic resize */
        }
    }, []);

    // Edge snap: drag handle uses the OS title bar via CSS; we just provide a
    // visual grip cue. Real edge snapping is OS-level on Windows/macOS.

    const anyoneSpeaking = speakers.length > 0;

    const iconBtnStyle = (active: boolean, danger?: boolean): React.CSSProperties => ({
        width: 36,
        height: 36,
        borderRadius: 18,
        border: 'none',
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
        background: danger
            ? '#ed4245'
            : active
              ? 'rgba(237, 66, 69, 0.18)'
              : 'rgba(255,255,255,0.08)',
        color: danger ? '#fff' : active ? '#ed4245' : '#fff',
        transition: 'background 0.15s, transform 0.1s',
    });

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'transparent',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                color: '#fff',
                userSelect: 'none',
                padding: 4,
            }}
        >
            <div
                style={{
                    height: TICKER_HEIGHT,
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '0 12px',
                    borderRadius: 14,
                    background:
                        'linear-gradient(135deg, rgba(20,22,30,0.96), rgba(28,28,40,0.96))',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02) inset',
                    overflow: 'hidden',
                    position: 'relative',
                }}
            >
                {/* Subtle aurora glow when anyone is speaking */}
                {anyoneSpeaking && (
                    <div
                        aria-hidden="true"
                        style={{
                            position: 'absolute',
                            inset: 0,
                            background:
                                'radial-gradient(120% 80% at 0% 50%, rgba(67, 181, 129, 0.18), transparent 60%)',
                            pointerEvents: 'none',
                        }}
                    />
                )}

                {/* Drag grip + connection dot */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'grab',
                        // Electron / browsers: this hint allows dragging in frameless windows.
                        WebkitAppRegion: 'drag',
                        flexShrink: 0,
                    } as React.CSSProperties}
                >
                    <GripVertical size={14} style={{ color: 'rgba(255,255,255,0.35)' }} />
                    <span
                        title={`Connection: ${voiceState.connectionQuality}`}
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: connectionColor,
                            boxShadow: `0 0 8px ${connectionColor}`,
                        }}
                    />
                </div>

                {/* Channel label + speakers ticker */}
                <button
                    type="button"
                    onClick={() => postAction('returnToCall')}
                    title="Return to call"
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#fff',
                        textAlign: 'left',
                        flex: 1,
                        minWidth: 0,
                        cursor: 'pointer',
                        padding: '4px 0',
                        WebkitAppRegion: 'no-drag',
                    } as React.CSSProperties}
                >
                    <div
                        style={{
                            fontSize: 13,
                            fontWeight: 700,
                            letterSpacing: '-0.01em',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                        }}
                    >
                        <span style={{ opacity: 0.75 }}>
                            {voiceState.activeCallType === 'dm' ? '@' : '#'}
                        </span>
                        {voiceState.channelName || initialChannelName}
                        {voiceState.screenSharing && (
                            <MonitorUp size={12} style={{ color: '#6366f1', flexShrink: 0 }} />
                        )}
                    </div>
                    <div
                        style={{
                            fontSize: 11,
                            color: anyoneSpeaking ? '#43b581' : '#aeb4c2',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            transition: 'color 0.2s',
                        }}
                    >
                        {voiceState.connected ? subtitle : 'Disconnected'}
                    </div>
                </button>

                {/* Action buttons */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        flexShrink: 0,
                        WebkitAppRegion: 'no-drag',
                    } as React.CSSProperties}
                >
                    <button
                        type="button"
                        onClick={() => postAction('toggleMute')}
                        aria-label={voiceState.muted ? 'Unmute microphone' : 'Mute microphone'}
                        title={voiceState.muted ? 'Unmute' : 'Mute'}
                        style={iconBtnStyle(voiceState.muted)}
                    >
                        {voiceState.muted ? <MicOff size={16} /> : <Mic size={16} />}
                    </button>
                    <button
                        type="button"
                        onClick={() => postAction('toggleDeafen')}
                        aria-label={voiceState.deafened ? 'Undeafen' : 'Deafen'}
                        title={voiceState.deafened ? 'Undeafen' : 'Deafen'}
                        style={iconBtnStyle(voiceState.deafened)}
                    >
                        {voiceState.deafened ? <HeadphoneOff size={16} /> : <Headphones size={16} />}
                    </button>
                    <button
                        type="button"
                        onClick={() => postAction('returnToCall')}
                        aria-label="Return to call"
                        title="Return to call"
                        style={iconBtnStyle(false)}
                    >
                        <Maximize2 size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={() => postAction('disconnect')}
                        aria-label="Disconnect"
                        title="Hang up"
                        style={iconBtnStyle(false, true)}
                    >
                        <PhoneOff size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
