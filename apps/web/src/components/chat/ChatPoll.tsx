import { useState, useEffect, useMemo } from 'react';
import { Users, Clock, EyeOff } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

interface PollOption {
    id: string;
    text: string;
    votes: number;
}

interface ChatPollProps {
    pollId?: string;
    question: string;
    options: PollOption[];
    totalVotes: number;
    multipleChoice?: boolean;
    myVotes?: string[];
    anonymous?: boolean;
    expiresAt?: string | null;
}

const ChatPoll = ({ pollId, question, options: initialOptions, totalVotes: initialTotal, multipleChoice, myVotes: initialMyVotes, anonymous, expiresAt }: ChatPollProps) => {
    const { addToast } = useToast();
    const [options, setOptions] = useState<PollOption[]>(initialOptions);
    const [selectedOptionIds, setSelectedOptionIds] = useState<Set<string>>(new Set(initialMyVotes ?? []));
    const [totalVotes, setTotalVotes] = useState(initialTotal);
    const [isVoting, setIsVoting] = useState(false);
    const [timeLeft, setTimeLeft] = useState('');

    // Sync from props on update
    useEffect(() => {
        setOptions(initialOptions);
        setTotalVotes(initialTotal);
        if (initialMyVotes) setSelectedOptionIds(new Set(initialMyVotes));
    }, [initialOptions, initialTotal, initialMyVotes]);

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

    // Find the leading option for color accent
    const maxVotes = useMemo(() => Math.max(...options.map(o => o.votes), 0), [options]);

    const handleVote = async (id: string) => {
        if (isVoting) return;
        if (!pollId) {
            addToast({
                title: 'Poll is not ready',
                description: 'This poll cannot be voted on until it is synced with the server.',
                variant: 'error',
            });
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
            addToast({
                title: 'Could not submit vote',
                description: 'Please try again in a moment.',
                variant: 'error',
            });
        } finally {
            setIsVoting(false);
        }
    };

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
                            {/* Progress bar background */}
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

                            {/* Content */}
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
