import { useEffect, useState, CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/lib/api';

interface Poll {
  id: string;
  messageId: string;
  question: string;
  options: PollOption[];
  isMultiSelect: boolean;
  createdAt: string;
  endsAt?: string;
  status: 'active' | 'closed';
  totalVotes: number;
  userVoted?: string[];
}

interface PollOption {
  id: string;
  text: string;
  voteCount: number;
}

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#2c2c3e',
    color: '#e8e4e0',
    overflow: 'hidden',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    gap: 12,
    color: '#a8a4b8',
  },
  spinner: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: '3px solid #4a4660',
    borderTopColor: '#d4af37',
    animation: 'spin 0.8s linear infinite',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    borderBottom: '1px solid #4a4660',
  },
  headerTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 600,
    color: '#e8e4e0',
  },
  createBtn: {
    padding: '8px 20px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    background: '#d4af37',
    color: '#1a1a2e',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  filters: {
    display: 'flex',
    gap: 4,
    padding: '12px 24px',
    borderBottom: '1px solid #4a4660',
  },
  filterBtn: {
    padding: '6px 14px',
    borderRadius: 'var(--radius-sm)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#4a4660',
    background: 'transparent',
    color: '#a8a4b8',
    fontSize: 13,
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  },
  filterBtnActive: {
    background: '#413d58',
    color: '#e8e4e0',
    borderColor: '#d4af37',
  },
  errorBar: {
    padding: '10px 24px',
    background: 'rgba(232, 90, 110, 0.15)',
    color: '#e85a6e',
    fontSize: 13,
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 0',
    gap: 8,
    color: '#6e6a80',
  },
  emptyTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#a8a4b8',
  },
  emptyText: {
    margin: 0,
    fontSize: 13,
  },
  card: {
    padding: 16,
    background: '#25243a',
    borderRadius: 'var(--radius-md)',
    border: '1px solid #4a4660',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  cardQuestion: {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
    color: '#e8e4e0',
  },
  statusActive: {
    padding: '3px 10px',
    borderRadius: 'var(--radius-lg)',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    background: 'rgba(106, 234, 138, 0.15)',
    color: '#6aea8a',
    whiteSpace: 'nowrap' as const,
  },
  statusClosed: {
    padding: '3px 10px',
    borderRadius: 'var(--radius-lg)',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    background: 'rgba(110, 106, 128, 0.15)',
    color: '#6e6a80',
    whiteSpace: 'nowrap' as const,
  },
  options: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  option: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid #4a4660',
    background: '#353348',
    cursor: 'pointer',
    overflow: 'hidden',
    fontSize: 14,
    color: '#e8e4e0',
    width: '100%',
    textAlign: 'left' as const,
  },
  optionDisabled: {
    cursor: 'default',
    opacity: 0.8,
  },
  optionBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    background: 'rgba(212, 175, 55, 0.15)',
    borderRadius: 'var(--radius-sm)',
    transition: 'width 0.3s ease',
  },
  optionBarWinning: {
    background: 'rgba(212, 175, 55, 0.3)',
  },
  optionText: {
    position: 'relative',
    zIndex: 1,
  },
  optionPercent: {
    position: 'relative',
    zIndex: 1,
    fontSize: 13,
    fontWeight: 600,
    color: '#a8a4b8',
    marginLeft: 8,
    flexShrink: 0,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginTop: 12,
    fontSize: 12,
    color: '#6e6a80',
  },
  multiTag: {
    padding: '2px 8px',
    borderRadius: 10,
    background: '#413d58',
    color: '#a8a4b8',
    fontSize: 11,
  },
};

export function PollsPage() {
  const { channelId } = useParams();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'active' | 'closed' | 'all'>('active');

  // Create Poll modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [question, setQuestion] = useState('');
  const [answers, setAnswers] = useState<string[]>(['', '']);
  const [allowMultiselect, setAllowMultiselect] = useState(false);
  const [duration, setDuration] = useState<number | undefined>(undefined);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function fetchPolls() {
      try {
        const res = await fetch(`/api/v1/polls?status=${filter}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to fetch polls');
        const data = await res.json();
        setPolls(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchPolls();
  }, [filter]);

  const handleVote = async (pollId: string, optionId: string) => {
    try {
      await api.polls.vote(pollId, [optionId]);
      setPolls(polls.map(p => {
        if (p.id !== pollId) return p;
        return {
          ...p,
          options: p.options.map(o => o.id === optionId ? { ...o, voteCount: o.voteCount + 1 } : o),
          totalVotes: p.totalVotes + 1,
        };
      }));
    } catch (err) {
      console.error('Vote failed:', err);
    }
  };

  const handleCreatePoll = async () => {
    if (!channelId) {
      setCreateError('No channel selected');
      return;
    }
    const validAnswers = answers.filter(a => a.trim());
    if (!question.trim()) {
      setCreateError('Question is required');
      return;
    }
    if (validAnswers.length < 2) {
      setCreateError('At least 2 answers are required');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      await api.polls.create(channelId, {
        question: question.trim(),
        options: validAnswers,
        multiselect: allowMultiselect,
        duration,
      });
      // Refresh polls list
      const res = await fetch(`/api/v1/polls?status=${filter}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPolls(data);
      }
      // Reset form and close modal
      setShowCreateModal(false);
      setQuestion('');
      setAnswers(['', '']);
      setAllowMultiselect(false);
      setDuration(undefined);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create poll');
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loading}>
          <div style={styles.spinner} />
          <p>Loading polls...</p>
        </div>
      </div>
    );
  }

  // Find winning option per poll for bar highlighting
  const getMaxVoteCount = (options: PollOption[]) =>
    Math.max(...options.map(o => o.voteCount), 0);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>Polls</h1>
        <button style={styles.createBtn} onClick={() => setShowCreateModal(true)}>Create Poll</button>
      </div>

      <div style={styles.filters}>
        {(['active', 'closed', 'all'] as const).map((f) => (
          <button
            key={f}
            style={{
              ...styles.filterBtn,
              ...(filter === f ? styles.filterBtnActive : {}),
            }}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {error && <div style={styles.errorBar}><p style={{ margin: 0 }}>{error}</p></div>}

      <div style={styles.list}>
        {polls.length === 0 ? (
          <div style={styles.empty}>
            <h3 style={styles.emptyTitle}>No polls</h3>
            <p style={styles.emptyText}>Create the first poll for your community</p>
          </div>
        ) : (
          polls.map((poll) => {
            const maxVotes = getMaxVoteCount(poll.options);
            return (
              <div key={poll.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardQuestion}>{poll.question}</h3>
                  <span style={poll.status === 'active' ? styles.statusActive : styles.statusClosed}>
                    {poll.status}
                  </span>
                </div>
                <div style={styles.options}>
                  {poll.options.map((option) => {
                    const percentage = poll.totalVotes > 0
                      ? Math.round((option.voteCount / poll.totalVotes) * 100)
                      : 0;
                    const isWinning = option.voteCount === maxVotes && maxVotes > 0;
                    return (
                      <button
                        key={option.id}
                        style={{
                          ...styles.option,
                          ...(poll.status !== 'active' ? styles.optionDisabled : {}),
                        }}
                        onClick={() => poll.status === 'active' && handleVote(poll.id, option.id)}
                        disabled={poll.status !== 'active'}
                      >
                        <div
                          style={{
                            ...styles.optionBar,
                            ...(isWinning ? styles.optionBarWinning : {}),
                            width: `${percentage}%`,
                          }}
                        />
                        <span style={styles.optionText}>{option.text}</span>
                        <span style={styles.optionPercent}>{percentage}%</span>
                      </button>
                    );
                  })}
                </div>
                <div style={styles.footer}>
                  <span>{poll.totalVotes} votes</span>
                  {poll.endsAt && <span>Ends: {formatDate(poll.endsAt)}</span>}
                  {poll.isMultiSelect && <span style={styles.multiTag}>Multiple choice</span>}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Poll Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              background: '#2c2c3e',
              border: '1px solid #4a4660',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              maxWidth: 480,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#e8e4e0' }}>Create Poll</h2>

            {createError && (
              <div style={{ padding: '8px 12px', background: 'rgba(232,90,110,0.15)', color: '#e85a6e', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
                {createError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#a8a4b8' }}>Question *</label>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask a question..."
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #4a4660',
                  background: '#25243a',
                  color: '#e8e4e0',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#a8a4b8' }}>Answers (min 2, max 10)</label>
              {answers.map((answer, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={answer}
                    onChange={(e) => {
                      const updated = [...answers];
                      updated[idx] = e.target.value;
                      setAnswers(updated);
                    }}
                    placeholder={`Answer ${idx + 1}`}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid #4a4660',
                      background: '#25243a',
                      color: '#e8e4e0',
                      fontSize: 14,
                      outline: 'none',
                    }}
                  />
                  {answers.length > 2 && (
                    <button
                      onClick={() => setAnswers(answers.filter((_, i) => i !== idx))}
                      style={{
                        padding: '0 10px',
                        border: '1px solid #4a4660',
                        borderRadius: 'var(--radius-sm)',
                        background: 'transparent',
                        color: '#e85a6e',
                        cursor: 'pointer',
                        fontSize: 16,
                      }}
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
              {answers.length < 10 && (
                <button
                  onClick={() => setAnswers([...answers, ''])}
                  style={{
                    padding: '6px 12px',
                    border: '1px dashed #4a4660',
                    borderRadius: 'var(--radius-sm)',
                    background: 'transparent',
                    color: '#a8a4b8',
                    cursor: 'pointer',
                    fontSize: 13,
                    alignSelf: 'flex-start',
                  }}
                >
                  + Add Answer
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                id="multiselect"
                checked={allowMultiselect}
                onChange={(e) => setAllowMultiselect(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <label htmlFor="multiselect" style={{ fontSize: 13, color: '#a8a4b8', cursor: 'pointer' }}>
                Allow multiple selections
              </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#a8a4b8' }}>Duration</label>
              <select
                value={duration === undefined ? '' : String(duration)}
                onChange={(e) => setDuration(e.target.value === '' ? undefined : Number(e.target.value))}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #4a4660',
                  background: '#25243a',
                  color: '#e8e4e0',
                  fontSize: 14,
                  outline: 'none',
                }}
              >
                <option value="">No expiry</option>
                <option value="1">1 hour</option>
                <option value="24">24 hours</option>
                <option value="168">7 days</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid #4a4660',
                  background: 'transparent',
                  color: '#a8a4b8',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePoll}
                disabled={creating}
                style={{
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: '#d4af37',
                  color: '#1a1a2e',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: creating ? 'not-allowed' : 'pointer',
                  opacity: creating ? 0.7 : 1,
                }}
              >
                {creating ? 'Creating...' : 'Create Poll'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
