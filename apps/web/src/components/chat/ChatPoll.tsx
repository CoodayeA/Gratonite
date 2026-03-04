import { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
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
}

const ChatPoll = ({ pollId, question, options: initialOptions, totalVotes: initialTotal, multipleChoice, myVotes: initialMyVotes }: ChatPollProps) => {
    const { addToast } = useToast();
    const [options, setOptions] = useState<PollOption[]>(initialOptions);
    const [selectedOptionIds, setSelectedOptionIds] = useState<Set<string>>(new Set(initialMyVotes ?? []));
    const [totalVotes, setTotalVotes] = useState(initialTotal);
    const [isVoting, setIsVoting] = useState(false);

    // Sync from props on update
    useEffect(() => {
        setOptions(initialOptions);
        setTotalVotes(initialTotal);
        if (initialMyVotes) setSelectedOptionIds(new Set(initialMyVotes));
    }, [initialOptions, initialTotal, initialMyVotes]);

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
                <span style={{ fontSize: '15px', fontWeight: 600 }}>{question}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {options.map(option => {
                    const percentage = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
                    const isSelected = selectedOptionIds.has(option.id);

                    return (
                        <div
                            key={option.id}
                            onClick={() => handleVote(option.id)}
                            style={{
                                position: 'relative',
                                border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                                borderRadius: '8px',
                                overflow: 'hidden',
                                cursor: isVoting ? 'wait' : 'pointer',
                                transition: 'border-color 0.2s, background 0.2s',
                                background: isSelected ? 'rgba(82, 109, 245, 0.1)' : 'var(--bg-tertiary)',
                            }}
                        >
                            {/* Progress bar background */}
                            <div style={{
                                position: 'absolute',
                                top: 0, bottom: 0, left: 0,
                                width: `${percentage}%`,
                                background: isSelected ? 'rgba(82, 109, 245, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                transition: 'width 0.4s ease-out'
                            }} />

                            {/* Content */}
                            <div style={{ position: 'relative', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '18px', height: '18px', borderRadius: multipleChoice ? '4px' : '50%', border: `2px solid ${isSelected ? 'var(--accent-primary)' : 'var(--text-muted)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {isSelected && <div style={{ width: '10px', height: '10px', borderRadius: multipleChoice ? '2px' : '50%', background: 'var(--accent-primary)' }} />}
                                    </div>
                                    <span style={{ fontSize: '14px', fontWeight: isSelected ? 600 : 500 }}>{option.text}</span>
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {percentage}%
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <Users size={14} /> {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
                {multipleChoice && <span style={{ marginLeft: '4px' }}> (multiple choice)</span>}
            </div>
        </div>
    );
};

export default ChatPoll;
