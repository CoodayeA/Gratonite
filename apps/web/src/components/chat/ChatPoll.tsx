import { useState, useEffect, useMemo, useCallback } from 'react';
import { Users, Clock, EyeOff, GripVertical, Trophy } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

interface PollOption {
    id: string;
    text: string;
    votes: number;
}

type PollType = 'single' | 'multiple' | 'ranked';

interface ChatPollProps {
    pollId?: string;
    question: string;
    options: PollOption[];
    totalVotes: number;
    multipleChoice?: boolean;
    pollType?: PollType;
    myVotes?: string[];
    myRanking?: string[];
    anonymous?: boolean;
    expiresAt?: string | null;
}

const ChatPoll = ({ pollId, question, options: initialOptions, totalVotes: initialTotal, multipleChoice, pollType: initialPollType, myVotes: initialMyVotes, myRanking: initialMyRanking, anonymous, expiresAt }: ChatPollProps) => {
    const { addToast } = useToast();
    const [options, setOptions] = useState<PollOption[]>(initialOptions);
    const [selectedOptionIds, setSelectedOptionIds] = useState<Set<string>>(new Set(initialMyVotes ?? []));
    const [totalVotes, setTotalVotes] = useState(initialTotal);
    const [isVoting, setIsVoting] = useState(false);
    const [timeLeft, setTimeLeft] = useState('');

    const pollType: PollType = initialPollType ?? (multipleChoice ? 'multiple' : 'single');

    // Ranked choice state
    const [ranking, setRanking] = useState<string[]>(initialMyRanking ?? []);
    const [dragIdx, setDragIdx] = useState<number | null>(null);
    const [hasSubmittedRanking, setHasSubmittedRanking] = useState((initialMyRanking ?? []).length > 0);

    // Sync from props on update
    useEffect(() => {
        setOptions(initialOptions);
        setTotalVotes(initialTotal);
        if (initialMyVotes) setSelectedOptionIds(new Set(initialMyVotes));
        if (initialMyRanking && initialMyRanking.length > 0) {
            setRanking(initialMyRanking);
            setHasSubmittedRanking(true);
        }
    }, [initialOptions, initialTotal, initialMyVotes, initialMyRanking]);

    // Initialize ranking with all options when switching to ranked mode
    useEffect(() => {
        if (pollType === 'ranked' && ranking.length === 0 && options.length > 0) {
            setRanking(options.map(o => o.id));
        }
    }, [pollType, options, ranking.length]);

    // Auto-close timer countdown
    useEffect(() => {
        if (!expiresAt) { setTimeLeft(''); return; }
        const update = () => {
            const diff = new Date(expiresAt).getTime() - Date.now();
            if (diff <= 0) { setTimeLeft('Ended'); return; }
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            if (h > 24) {
                const d = Math.floor(h / 24);
                setTimeLeft(`${d}d ${h % 24}h left`);
            } else if (h > 0) {
                setTimeLeft(`${h}h ${m}m left`);
            } else if (m > 0) {
                setTimeLeft(`${m}m ${s}s left`);
            } else {
                setTimeLeft(`${s}s left`);
            }
        };
        update();
        const iv = setInterval(update, 1000);
        return () => clearInterval(iv);
    }, [expiresAt]);

    const isExpired = useMemo(() => {
        if (!expiresAt) return false;
        return new Date(expiresAt).getTime() <= Date.now();
    }, [expiresAt, timeLeft]);

    const maxVotes = useMemo(() => Math.max(...options.map(o => o.votes), 0), [options]);

    // Calculate ranked scores for display
    const rankedScores = useMemo(() => {
        if (pollType !== 'ranked') return new Map<string, number>();
        const scores = new Map<string, number>();
        // Use votes as score (backend calculates Borda count: 1st = N pts, 2nd = N-1, etc.)
        options.forEach(o => scores.set(o.id, o.votes));
        return scores;
    }, [options, pollType]);

    const maxRankedScore = useMemo(() => Math.max(...Array.from(rankedScores.values()), 0), [rankedScores]);

    const handleVote = async (id: string) => {
        if (isVoting || pollType === 'ranked') return;
        if (!pollId) {
            addToast({ title: 'Poll is not ready', description: 'This poll cannot be voted on until it is synced with the server.', variant: 'error' });
            return;
        }

        setIsVoting(true);
        try {
            const result = await api.polls.vote(pollId, [id]);
            if (result && (result as any).options) {
                const r = result as any;
                setOptions(r.options.map((o: any) => ({ id: o.id, text: o.text, votes: o.voteCount ?? 0 })));
                setTotalVotes(r.totalVoters ?? 0);
                setSelectedOptionIds(new Set(r.myVotes ?? []));
            }
        } catch {
            addToast({ title: 'Could not submit vote', description: 'Please try again in a moment.', variant: 'error' });
        } finally {
            setIsVoting(false);
        }
    };

    const handleRankedSubmit = async () => {
        if (isVoting || !pollId || ranking.length === 0) return;
        setIsVoting(true);
        try {
            const result = await api.polls.vote(pollId, ranking);
            if (result && (result as any).options) {
                const r = result as any;
                setOptions(r.options.map((o: any) => ({ id: o.id, text: o.text, votes: o.voteCount ?? 0 })));
                setTotalVotes(r.totalVoters ?? 0);
            }
            setHasSubmittedRanking(true);
            addToast({ title: 'Ranking submitted', variant: 'success' });
        } catch {
            addToast({ title: 'Could not submit ranking', description: 'Please try again.', variant: 'error' });
        } finally {
            setIsVoting(false);
        }
    };

    const moveRanking = useCallback((fromIdx: number, toIdx: number) => {
        setRanking(prev => {
            const next = [...prev];
            const [moved] = next.splice(fromIdx, 1);
            next.splice(toIdx, 0, moved);
            return next;
        });
    }, []);

    const optionTextMap = useMemo(() => {
        const map = new Map<string, string>();
        options.forEach(o => map.set(o.id, o.text));
        return map;
    }, [options]);

    // Ranked Choice UI
    if (pollType === 'ranked') {
        return (
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '16px', marginTop: '8px', maxWidth: '400px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Trophy size={16} color="var(--accent-primary)" />
                    <span style={{ fontSize: '15px', fontWeight: 600, flex: 1 }}>{question}</span>
                    {anonymous && (
                        <span title="Anonymous poll" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 10, background: 'rgba(99,102,241,0.12)', color: 'var(--accent-primary)', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                            <EyeOff size={11} /> Anonymous
                        </span>
                    )}
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase' }}>
                    {hasSubmittedRanking ? 'Results' : 'Drag to rank your choices'}
                </div>

                {!hasSubmittedRanking && !isExpired ? (
                    <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {ranking.map((optId, idx) => (
                                <div
                                    key={optId}
                                    draggable
                                    onDragStart={() => setDragIdx(idx)}
                                    onDragOver={(e) => { e.preventDefault(); if (dragIdx !== null && dragIdx !== idx) moveRanking(dragIdx, idx); setDragIdx(idx); }}
                                    onDragEnd={() => setDragIdx(null)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        padding: '10px 12px', borderRadius: '8px',
                                        border: `1px solid ${dragIdx === idx ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                                        background: dragIdx === idx ? 'rgba(82, 109, 245, 0.1)' : 'var(--bg-tertiary)',
                                        cursor: 'grab', transition: 'border-color 0.15s, background 0.15s',
                                        userSelect: 'none',
                                    }}
                                >
                                    <GripVertical size={14} color="var(--text-muted)" />
                                    <span style={{
                                        width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '12px', fontWeight: 700, flexShrink: 0,
                                        background: idx === 0 ? 'var(--accent-primary)' : idx === 1 ? 'rgba(99,102,241,0.4)' : 'var(--bg-elevated)',
                                        color: idx <= 1 ? '#fff' : 'var(--text-muted)',
                                    }}>
                                        {idx + 1}
                                    </span>
                                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{optionTextMap.get(optId) ?? optId}</span>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={handleRankedSubmit}
                            disabled={isVoting}
                            style={{
                                width: '100%', marginTop: '12px', padding: '10px', borderRadius: '8px',
                                background: 'var(--accent-primary)', color: '#fff', border: 'none',
                                fontWeight: 600, fontSize: '14px', cursor: isVoting ? 'wait' : 'pointer',
                                opacity: isVoting ? 0.7 : 1,
                            }}
                        >
                            {isVoting ? 'Submitting...' : 'Submit Ranking'}
                        </button>
                    </>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {[...options].sort((a, b) => b.votes - a.votes).map((option, idx) => {
                            const score = rankedScores.get(option.id) ?? 0;
                            const pct = maxRankedScore > 0 ? Math.round((score / maxRankedScore) * 100) : 0;
                            return (
                                <div key={option.id} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)' }}>
                                    <div style={{
                                        position: 'absolute', top: 0, bottom: 0, left: 0,
                                        width: `${pct}%`,
                                        background: idx === 0 ? 'rgba(34, 197, 94, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                                        transition: 'width 0.4s ease-out', borderRadius: '8px',
                                    }} />
                                    <div style={{ position: 'relative', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{
                                                width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '12px', fontWeight: 700,
                                                background: idx === 0 ? '#22c55e' : idx === 1 ? '#f59e0b' : idx === 2 ? '#94a3b8' : 'var(--bg-elevated)',
                                                color: idx <= 2 ? '#fff' : 'var(--text-muted)',
                                            }}>
                                                {idx + 1}
                                            </span>
                                            <span style={{ fontSize: '14px', fontWeight: idx === 0 ? 600 : 500 }}>{option.text}</span>
                                        </div>
                                        <span style={{ fontSize: '13px', color: idx === 0 ? '#22c55e' : 'var(--text-muted)', fontWeight: 600 }}>
                                            {score} pts
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Users size={14} /> {totalVotes} voter{totalVotes !== 1 ? 's' : ''}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 8, background: 'rgba(168, 85, 247, 0.12)', color: '#a855f7', fontSize: 11, fontWeight: 600 }}>
                        Ranked Choice
                    </span>
                    {timeLeft && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 'auto', color: isExpired ? 'var(--error)' : 'var(--text-muted)' }}>
                            <Clock size={12} /> {timeLeft}
                        </span>
                    )}
                </div>
            </div>
        );
    }

    // Standard single/multiple choice UI
    return (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '16px', marginTop: '8px', maxWidth: '400px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, flex: 1 }}>{question}</span>
                {anonymous && (
                    <span title="Anonymous poll" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 10, background: 'rgba(99,102,241,0.12)', color: 'var(--accent-primary)', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                        <EyeOff size={11} /> Anonymous
                    </span>
                )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {options.map(option => {
                    const percentage = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
                    const isSelected = selectedOptionIds.has(option.id);
                    const isLeading = option.votes > 0 && option.votes === maxVotes;

                    return (
                        <div
                            key={option.id}
                            onClick={() => !isExpired && handleVote(option.id)}
                            style={{
                                position: 'relative',
                                border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                                borderRadius: '8px',
                                overflow: 'hidden',
                                cursor: isExpired ? 'default' : isVoting ? 'wait' : 'pointer',
                                transition: 'border-color 0.2s, background 0.2s',
                                background: isSelected ? 'rgba(82, 109, 245, 0.1)' : 'var(--bg-tertiary)',
                                opacity: isExpired && !isSelected ? 0.7 : 1,
                            }}
                        >
                            <div style={{
                                position: 'absolute',
                                top: 0, bottom: 0, left: 0,
                                width: `${percentage}%`,
                                background: isLeading
                                    ? 'rgba(34, 197, 94, 0.18)'
                                    : isSelected
                                        ? 'rgba(82, 109, 245, 0.2)'
                                        : 'rgba(255, 255, 255, 0.05)',
                                transition: 'width 0.4s ease-out',
                                borderRadius: '8px',
                            }} />

                            <div style={{ position: 'relative', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '18px', height: '18px', borderRadius: multipleChoice ? '4px' : '50%', border: `2px solid ${isSelected ? 'var(--accent-primary)' : 'var(--text-muted)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        {isSelected && <div style={{ width: '10px', height: '10px', borderRadius: multipleChoice ? '2px' : '50%', background: 'var(--accent-primary)' }} />}
                                    </div>
                                    <span style={{ fontSize: '14px', fontWeight: isSelected ? 600 : 500 }}>{option.text}</span>
                                </div>
                                <div style={{ fontSize: '13px', color: isLeading ? '#22c55e' : 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                    {percentage}%
                                    <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-muted)' }}>({option.votes})</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Users size={14} /> {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
                </span>
                {multipleChoice && <span> (multiple choice)</span>}
                {timeLeft && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 'auto', color: isExpired ? 'var(--error)' : 'var(--text-muted)' }}>
                        <Clock size={12} /> {timeLeft}
                    </span>
                )}
            </div>
        </div>
    );
};

export default ChatPoll;
