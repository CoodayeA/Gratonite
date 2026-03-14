/**
 * StagePanel.tsx — Moderated voice stage UI: speakers, audience, raise hand.
 * Used inside VoiceChannel for GUILD_STAGE channels.
 */
import { useState, useCallback } from 'react';
import { Crown, Hand, Mic, MicOff, Users, Radio, X, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../../lib/api';
import Avatar from '../ui/Avatar';

type Speaker = {
    id: string;
    sessionId: string;
    userId: string;
    invitedBy: string | null;
    joinedAt: string;
};

type StageSession = {
    id: string;
    channelId: string;
    hostId: string | null;
    topic: string | null;
    startedAt: string;
};

type Participant = {
    identity: string;
    displayName?: string;
    avatarHash?: string | null;
    isSpeaking?: boolean;
};

export default function StagePanel({
    channelId,
    session,
    speakers,
    raisedHands,
    currentUserId,
    participants,
    onStartStage,
    onEndStage,
    onRaiseHand,
    onInviteSpeaker,
    onRemoveSpeaker,
    addToast,
}: {
    channelId: string;
    session: StageSession | null;
    speakers: Speaker[];
    raisedHands: string[];
    currentUserId: string;
    participants: Participant[];
    onStartStage: () => void;
    onEndStage: () => void;
    onRaiseHand: () => void;
    onInviteSpeaker: (userId: string) => void;
    onRemoveSpeaker: (userId: string) => void;
    addToast: (t: { title: string; variant: string }) => void;
}) {
    const [showAudience, setShowAudience] = useState(true);
    const [topicInput, setTopicInput] = useState('');
    const [showTopicEdit, setShowTopicEdit] = useState(false);

    const isHost = session?.hostId === currentUserId;
    const isSpeaker = speakers.some(s => s.userId === currentUserId);
    const speakerIds = new Set(speakers.map(s => s.userId));
    const audienceMembers = participants.filter(p => !speakerIds.has(p.identity) && p.identity !== session?.hostId);

    if (!session) {
        return (
            <div style={{
                padding: '24px', textAlign: 'center', background: 'var(--bg-elevated)',
                borderRadius: '12px', border: '1px solid var(--stroke)', margin: '12px',
            }}>
                <Radio size={32} color="var(--text-muted)" style={{ marginBottom: '12px', opacity: 0.5 }} />
                <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>No active stage</p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>Start a stage to begin a moderated discussion.</p>
                <button
                    onClick={onStartStage}
                    style={{
                        padding: '10px 24px', borderRadius: '8px', border: 'none',
                        background: 'var(--accent-primary)', color: '#000',
                        fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                    }}
                >
                    Start Stage
                </button>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px' }}>
            {/* Stage header */}
            <div style={{
                padding: '16px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))',
                border: '1px solid rgba(99,102,241,0.3)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }} />
                        <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#10b981' }}>Live</span>
                    </div>
                    {isHost && (
                        <button
                            onClick={onEndStage}
                            style={{
                                padding: '4px 12px', borderRadius: '6px', border: '1px solid #ef4444',
                                background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                            }}
                        >End Stage</button>
                    )}
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    {session.topic || 'Stage Discussion'}
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {speakers.length} speaker{speakers.length !== 1 ? 's' : ''} &middot; {audienceMembers.length} listening
                </div>
            </div>

            {/* Speakers section */}
            <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '10px' }}>
                    Speakers
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                    {/* Host */}
                    {session.hostId && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '64px' }}>
                            <div style={{ position: 'relative' }}>
                                <Avatar userId={session.hostId} displayName="Host" size={48} />
                                <Crown size={14} style={{ position: 'absolute', top: '-4px', right: '-4px', color: '#f59e0b' }} />
                            </div>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '64px' }}>
                                Host
                            </span>
                        </div>
                    )}
                    {/* Other speakers */}
                    {speakers.filter(s => s.userId !== session.hostId).map(sp => {
                        const participant = participants.find(p => p.identity === sp.userId);
                        return (
                            <div key={sp.userId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '64px', position: 'relative' }}>
                                <Avatar userId={sp.userId} displayName={participant?.displayName || sp.userId.slice(0, 6)} avatarHash={participant?.avatarHash} size={48} />
                                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '64px' }}>
                                    {participant?.displayName || sp.userId.slice(0, 6)}
                                </span>
                                {isHost && (
                                    <button
                                        onClick={() => onRemoveSpeaker(sp.userId)}
                                        style={{ position: 'absolute', top: '-4px', right: '-4px', width: '18px', height: '18px', borderRadius: '50%', background: '#ef4444', border: 'none', color: '#fff', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        <X size={10} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Raise hand / audience actions */}
            {!isHost && !isSpeaker && (
                <button
                    onClick={onRaiseHand}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        padding: '10px', borderRadius: '8px', border: '1px solid var(--stroke)',
                        background: 'var(--bg-elevated)', color: 'var(--text-primary)',
                        fontSize: '13px', fontWeight: 600, cursor: 'pointer', width: '100%',
                    }}
                >
                    <Hand size={16} /> Raise Hand to Speak
                </button>
            )}

            {/* Raised hands (host only) */}
            {isHost && raisedHands.length > 0 && (
                <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#f59e0b', marginBottom: '8px' }}>
                        <Hand size={12} style={{ verticalAlign: 'middle' }} /> {raisedHands.length} Raised Hand{raisedHands.length !== 1 ? 's' : ''}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {raisedHands.map(uid => {
                            const participant = participants.find(p => p.identity === uid);
                            return (
                                <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Avatar userId={uid} displayName={participant?.displayName || uid.slice(0, 6)} size={24} />
                                    <span style={{ flex: 1, fontSize: '13px', fontWeight: 600 }}>{participant?.displayName || uid.slice(0, 6)}</span>
                                    <button
                                        onClick={() => onInviteSpeaker(uid)}
                                        style={{
                                            padding: '4px 10px', borderRadius: '6px', border: 'none',
                                            background: 'var(--accent-primary)', color: '#000',
                                            fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                                        }}
                                    >Invite to Speak</button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Audience */}
            <div style={{ borderRadius: '10px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)' }}>
                <button
                    onClick={() => setShowAudience(!showAudience)}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                        padding: '10px 12px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)',
                    }}
                >
                    <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <Users size={12} style={{ verticalAlign: 'middle' }} /> Audience ({audienceMembers.length})
                    </span>
                    {showAudience ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {showAudience && audienceMembers.length > 0 && (
                    <div style={{ padding: '0 12px 12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {audienceMembers.slice(0, 30).map(p => (
                            <div key={p.identity} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', borderRadius: '6px', background: 'var(--bg-tertiary)' }}>
                                <Avatar userId={p.identity} displayName={p.displayName || p.identity.slice(0, 6)} avatarHash={p.avatarHash} size={20} />
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{p.displayName || p.identity.slice(0, 6)}</span>
                            </div>
                        ))}
                        {audienceMembers.length > 30 && (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '4px 8px' }}>+{audienceMembers.length - 30} more</span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
