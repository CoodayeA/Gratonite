import { useEffect, useState, CSSProperties } from 'react';
import { useParams } from 'react-router-dom';

interface Question {
  id: string;
  channelId: string;
  guildId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  title: string;
  content: string;
  votes: number;
  answerCount: number;
  isResolved: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Answer {
  id: string;
  questionId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  votes: number;
  isAccepted: boolean;
  createdAt: string;
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
  askBtn: {
    padding: '8px 20px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    background: '#d4af37',
    color: '#1a1a2e',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 24px',
    borderBottom: '1px solid #4a4660',
  },
  filters: {
    display: 'flex',
    gap: 4,
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
  sort: {},
  sortSelect: {
    padding: '6px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid #4a4660',
    background: '#25243a',
    color: '#e8e4e0',
    fontSize: 13,
    cursor: 'pointer',
    outline: 'none',
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
    gap: 12,
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
    display: 'flex',
    gap: 16,
    padding: 16,
    background: '#25243a',
    borderRadius: 'var(--radius-md)',
    border: '1px solid #4a4660',
  },
  votes: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    minWidth: 40,
  },
  voteBtn: {
    background: 'transparent',
    border: 'none',
    color: '#6e6a80',
    fontSize: 16,
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: 'var(--radius-sm)',
    transition: 'color 0.15s',
  },
  voteCount: {
    fontSize: 15,
    fontWeight: 600,
    color: '#e8e4e0',
  },
  cardContent: {
    flex: 1,
    cursor: 'pointer',
    minWidth: 0,
  },
  cardTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
    color: '#e8e4e0',
    marginBottom: 4,
  },
  preview: {
    margin: 0,
    fontSize: 13,
    color: '#a8a4b8',
    lineHeight: 1.5,
    marginBottom: 8,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 12,
    color: '#6e6a80',
  },
  author: {
    color: '#a8a4b8',
  },
  resolved: {
    color: '#6aea8a',
    fontWeight: 600,
  },
  // Modal styles
  modal: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 24,
  },
  detail: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '80vh',
    background: '#353348',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid #4a4660',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'transparent',
    color: '#a8a4b8',
    fontSize: 20,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailHeader: {
    padding: '20px 24px 12px',
    borderBottom: '1px solid #4a4660',
  },
  detailTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: '#e8e4e0',
    paddingRight: 32,
  },
  detailBody: {
    padding: '16px 24px',
    fontSize: 14,
    lineHeight: 1.7,
    color: '#e8e4e0',
  },
  answersSection: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 24px 24px',
  },
  answersSectionTitle: {
    margin: '0 0 12px',
    fontSize: 15,
    fontWeight: 600,
    color: '#a8a4b8',
  },
  answer: {
    display: 'flex',
    gap: 12,
    padding: 12,
    background: '#25243a',
    borderRadius: 'var(--radius-md)',
    marginBottom: 8,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#4a4660',
  },
  answerAccepted: {
    borderColor: '#6aea8a',
  },
  acceptedBadge: {
    color: '#6aea8a',
    fontSize: 16,
    fontWeight: 700,
  },
  answerContent: {
    flex: 1,
    minWidth: 0,
  },
  answerText: {
    margin: '0 0 8px',
    fontSize: 14,
    lineHeight: 1.6,
    color: '#e8e4e0',
  },
  acceptBtn: {
    padding: '4px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid #4a4660',
    background: 'transparent',
    color: '#a8a4b8',
    fontSize: 12,
    cursor: 'pointer',
    alignSelf: 'flex-start',
    whiteSpace: 'nowrap' as const,
  },
};

export function QAPage() {
  const { guildId, channelId } = useParams();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer[]>>({});
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'resolved' | 'unanswered'>('all');
  const [sort, setSort] = useState<'votes' | 'newest' | 'activity'>('votes');

  // Ask Question modal state
  const [showAskModal, setShowAskModal] = useState(false);
  const [askTitle, setAskTitle] = useState('');
  const [askBody, setAskBody] = useState('');
  const [askError, setAskError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    async function fetchQuestions() {
      if (!channelId) return;
      try {
        const res = await fetch(`/api/v1/qa/channels/${channelId}/questions?filter=${filter}&sort=${sort}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to fetch questions');
        const data = await res.json();
        setQuestions(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchQuestions();
  }, [channelId, filter, sort]);

  const fetchAnswers = async (questionId: string) => {
    try {
      const res = await fetch(`/api/v1/qa/questions/${questionId}/answers`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch answers');
      const data = await res.json();
      setAnswers(prev => ({ ...prev, [questionId]: data }));
    } catch (err) {
      console.error('Failed to fetch answers:', err);
    }
  };

  const handleVote = async (questionId: string, direction: 1 | -1) => {
    try {
      const res = await fetch(`/api/v1/qa/questions/${questionId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Vote failed');
      setQuestions(questions.map(q =>
        q.id === questionId ? { ...q, votes: q.votes + direction } : q
      ));
    } catch (err) {
      console.error('Vote failed:', err);
    }
  };

  const handleAnswerVote = async (questionId: string, answerId: string, direction: 1 | -1) => {
    try {
      const res = await fetch(`/api/v1/qa/answers/${answerId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Vote failed');
      setAnswers(prev => ({
        ...prev,
        [questionId]: (prev[questionId] ?? []).map(a =>
          a.id === answerId ? { ...a, votes: a.votes + direction } : a
        ),
      }));
    } catch (err) {
      console.error('Vote failed:', err);
    }
  };

  const handleAcceptAnswer = async (questionId: string, answerId: string) => {
    try {
      const res = await fetch(`/api/v1/qa/questions/${questionId}/accept/${answerId}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to accept answer');
      setQuestions(questions.map(q =>
        q.id === questionId ? { ...q, isResolved: true } : q
      ));
      setAnswers(prev => ({
        ...prev,
        [questionId]: (prev[questionId] ?? []).map(a =>
          a.id === answerId ? { ...a, isAccepted: true } : { ...a, isAccepted: false }
        ),
      }));
    } catch (err) {
      console.error('Accept failed:', err);
    }
  };

  const handleAskQuestion = async () => {
    if (!channelId) return;
    if (!askTitle.trim()) { setAskError('Title is required'); return; }
    setAsking(true);
    setAskError(null);
    try {
      const res = await fetch(`/api/v1/qa/channels/${channelId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: askTitle, body: askBody }),
      });
      if (!res.ok) throw new Error('Failed to submit question');
      const newQuestion = await res.json();
      setQuestions(prev => [newQuestion, ...prev]);
      setShowAskModal(false);
      setAskTitle('');
      setAskBody('');
    } catch (err) {
      setAskError(err instanceof Error ? err.message : 'Failed to submit question');
    } finally {
      setAsking(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loading}>
          <div style={styles.spinner} />
          <p>Loading questions...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>Q&amp;A</h1>
        <button style={styles.askBtn} onClick={() => setShowAskModal(true)}>Ask Question</button>
      </div>

      <div style={styles.controls}>
        <div style={styles.filters}>
          {(['all', 'resolved', 'unanswered'] as const).map((f) => (
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
        <div style={styles.sort}>
          <select
            style={styles.sortSelect}
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
          >
            <option value="votes">Most Votes</option>
            <option value="newest">Newest</option>
            <option value="activity">Recent Activity</option>
          </select>
        </div>
      </div>

      {error && <div style={styles.errorBar}><p style={{ margin: 0 }}>{error}</p></div>}

      <div style={styles.list}>
        {questions.length === 0 ? (
          <div style={styles.empty}>
            <h3 style={styles.emptyTitle}>No questions yet</h3>
            <p style={styles.emptyText}>Be the first to ask a question!</p>
          </div>
        ) : (
          questions.map((question) => (
            <div key={question.id} style={styles.card}>
              <div style={styles.votes}>
                <button style={styles.voteBtn} onClick={() => handleVote(question.id, 1)}>&#9650;</button>
                <span style={styles.voteCount}>{question.votes}</span>
                <button style={styles.voteBtn} onClick={() => handleVote(question.id, -1)}>&#9660;</button>
              </div>
              <div style={styles.cardContent} onClick={() => {
                setSelectedQuestion(question);
                if (!answers[question.id]) fetchAnswers(question.id);
              }}>
                <h3 style={styles.cardTitle}>{question.title}</h3>
                <p style={styles.preview}>{question.content.slice(0, 150)}...</p>
                <div style={styles.meta}>
                  <span style={styles.author}>{question.authorName}</span>
                  <span>{formatDate(question.createdAt)}</span>
                  <span>{question.answerCount} answers</span>
                  {question.isResolved && <span style={styles.resolved}>&#10003; Resolved</span>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedQuestion && (
        <div style={styles.modal} onClick={() => setSelectedQuestion(null)}>
          <div style={styles.detail} onClick={(e) => e.stopPropagation()}>
            <button style={styles.closeBtn} onClick={() => setSelectedQuestion(null)}>&times;</button>
            <div style={styles.detailHeader}>
              <h2 style={styles.detailTitle}>{selectedQuestion.title}</h2>
              <div style={{ ...styles.meta, marginTop: 8 }}>
                <span>{selectedQuestion.authorName}</span>
                <span>{formatDate(selectedQuestion.createdAt)}</span>
              </div>
            </div>
            <div style={styles.detailBody}>
              <p style={{ margin: 0 }}>{selectedQuestion.content}</p>
            </div>
            <div style={styles.answersSection}>
              <h3 style={styles.answersSectionTitle}>Answers ({answers[selectedQuestion.id]?.length || 0})</h3>
              {answers[selectedQuestion.id]?.map((answer) => (
                <div
                  key={answer.id}
                  style={{
                    ...styles.answer,
                    ...(answer.isAccepted ? styles.answerAccepted : {}),
                  }}
                >
                  <div style={styles.votes}>
                    <button style={styles.voteBtn} onClick={() => handleAnswerVote(selectedQuestion.id, answer.id, 1)}>&#9650;</button>
                    <span style={styles.voteCount}>{answer.votes}</span>
                    <button style={styles.voteBtn} onClick={() => handleAnswerVote(selectedQuestion.id, answer.id, -1)}>&#9660;</button>
                    {answer.isAccepted && <span style={styles.acceptedBadge}>&#10003;</span>}
                  </div>
                  <div style={styles.answerContent}>
                    <p style={styles.answerText}>{answer.content}</p>
                    <div style={styles.meta}>
                      <span>{answer.authorName}</span>
                      <span>{formatDate(answer.createdAt)}</span>
                    </div>
                  </div>
                  {!selectedQuestion.isResolved && !answer.isAccepted && (
                    <button
                      style={styles.acceptBtn}
                      onClick={() => handleAcceptAnswer(selectedQuestion.id, answer.id)}
                    >
                      Accept
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Ask Question Modal */}
      {showAskModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 24,
          }}
          onClick={() => setShowAskModal(false)}
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
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#e8e4e0' }}>Ask a Question</h2>

            {askError && (
              <div style={{ padding: '8px 12px', background: 'rgba(232,90,110,0.15)', color: '#e85a6e', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
                {askError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#a8a4b8' }}>Title *</label>
              <input
                type="text"
                value={askTitle}
                onChange={(e) => setAskTitle(e.target.value)}
                placeholder="What is your question?"
                required
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
              <label style={{ fontSize: 13, fontWeight: 500, color: '#a8a4b8' }}>Body (optional)</label>
              <textarea
                value={askBody}
                onChange={(e) => setAskBody(e.target.value)}
                rows={4}
                placeholder="Provide more details about your question..."
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #4a4660',
                  background: '#25243a',
                  color: '#e8e4e0',
                  fontSize: 14,
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                onClick={() => setShowAskModal(false)}
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
                onClick={handleAskQuestion}
                disabled={asking}
                style={{
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: '#d4af37',
                  color: '#1a1a2e',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: asking ? 'not-allowed' : 'pointer',
                  opacity: asking ? 0.7 : 1,
                }}
              >
                {asking ? 'Submitting...' : 'Ask Question'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
