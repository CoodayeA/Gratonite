import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Search,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  MessageSquare,
  Plus,
  CornerDownRight,
  ArrowLeft,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useToast } from '../../components/ui/ToastManager';
import { useUser } from '../../contexts/UserContext';
import { api } from '../../lib/api';

type Answer = {
  id: number;
  author: string;
  authorColor: string;
  content: string;
  upvotes: number;
  isSolution: boolean;
  time: string;
};

type Question = {
  id: number;
  threadId: string;
  title: string;
  body: string;
  author: string;
  authorColor: string;
  authorInitial: string;
  votes: number;
  voteState: 'up' | 'down' | null;
  status: 'solved' | 'unsolved';
  answerCount: number;
  time: string;
  answers: Answer[];
};

const FILTERS = ['All', 'Unsolved', 'Solved', 'My Questions'] as const;

let nextId = 1000;
const genId = () => ++nextId;

/** Map a thread object from the API to our Question shape */
function threadToQuestion(thread: any): Question {
  return {
    id: genId(),
    threadId: thread.id,
    title: thread.name ?? 'Untitled',
    body: thread.firstMessage ?? thread.topic ?? '',
    author: thread.author ?? thread.ownerId ?? 'Unknown',
    authorColor: 'var(--accent-primary)',
    authorInitial: (thread.name ?? '?').charAt(0).toUpperCase(),
    votes: thread.votes ?? 0,
    voteState: null,
    status: thread.archived ? 'solved' : 'unsolved',
    answerCount: thread.messageCount != null ? Math.max(0, thread.messageCount - 1) : 0,
    time: thread.createdAt ? new Date(thread.createdAt).toLocaleDateString() : 'Unknown',
    answers: [],
  };
}

/** Map an API message to an Answer shape */
function messageToAnswer(msg: any, idx: number): Answer {
  return {
    id: msg.id ? parseInt(msg.id, 16) % 9999999 : genId(),
    author: msg.authorId ?? 'Unknown',
    authorColor: 'var(--accent-primary)',
    content: msg.content ?? '',
    upvotes: 0,
    isSolution: false,
    time: msg.createdAt ? new Date(msg.createdAt).toLocaleDateString() : 'Unknown',
  };
}

const QAChannel = () => {
  const { addToast } = useToast();
  const { user: ctxUser } = useUser();
  const { channelId } = useParams<{ channelId: string; guildId: string }>();
  const CURRENT_USER = ctxUser.name || ctxUser.handle || 'You';

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>('All');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showAskModal, setShowAskModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [answerText, setAnswerText] = useState('');
  const [isPostingAnswer, setIsPostingAnswer] = useState(false);
  const [loadingAnswers, setLoadingAnswers] = useState(false);
  const [answerVotes, setAnswerVotes] = useState<Record<number, { count: number; state: 'up' | 'down' | null }>>({});

  // ── Fetch threads on mount ─────────────────────────────────────────────────

  useEffect(() => {
    if (!channelId) return;
    setLoading(true);
    setError(null);
    api.threads.list(channelId)
      .then((threads: any[]) => {
        setQuestions(threads.map(threadToQuestion));
      })
      .catch((err: any) => {
        setError(err.message ?? 'Failed to load questions.');
        addToast({ title: 'Error', description: err.message ?? 'Failed to load questions.', variant: 'error' });
      })
      .finally(() => setLoading(false));
  }, [channelId]);

  // ── Fetch answers when a question is selected ──────────────────────────────

  const handleSelectQuestion = async (id: number) => {
    setSelectedId(id);
    setAnswerText('');
    const q = questions.find(q => q.id === id);
    if (!q || q.answers.length > 0) return; // already loaded

    setLoadingAnswers(true);
    try {
      const messages = await api.messages.list(q.threadId, { limit: 50 });
      // First message is usually the question body — skip it
      const answerMessages = messages.slice(1);
      const answers: Answer[] = answerMessages.map((msg: any, i: number) => messageToAnswer(msg, i));
      setQuestions(prev =>
        prev.map(item => item.id === id ? { ...item, answers, answerCount: answers.length } : item)
      );
    } catch (err: any) {
      addToast({ title: 'Error', description: err.message ?? 'Failed to load answers.', variant: 'error' });
    } finally {
      setLoadingAnswers(false);
    }
  };

  // ── Filtered questions ─────────────────────────────────────────────────────

  const filteredQuestions = useMemo(() => {
    let list = questions;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (item) => item.title.toLowerCase().includes(q) || item.body.toLowerCase().includes(q),
      );
    }
    if (filterType === 'Unsolved') list = list.filter((item) => item.status === 'unsolved');
    else if (filterType === 'Solved') list = list.filter((item) => item.status === 'solved');
    else if (filterType === 'My Questions') list = list.filter((item) => item.author === CURRENT_USER);
    return list;
  }, [questions, searchQuery, filterType]);

  const selectedQuestion = selectedId !== null ? questions.find((q) => q.id === selectedId) ?? null : null;

  // ── Vote handlers (local only — no vote endpoint in API) ───────────────────

  const handleQuestionVote = (qId: number, dir: 'up' | 'down') => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        const base = q.votes;
        if (q.voteState === dir) return { ...q, voteState: null, votes: base };
        return { ...q, voteState: dir, votes: dir === 'up' ? base + 1 : base - 1 };
      }),
    );
  };

  const getAnswerVote = (answer: Answer) =>
    answerVotes[answer.id] ?? { count: answer.upvotes, state: null };

  const handleAnswerVote = (answer: Answer, dir: 'up' | 'down') => {
    const current = getAnswerVote(answer);
    const base = answer.upvotes;
    if (current.state === dir) {
      setAnswerVotes((p) => ({ ...p, [answer.id]: { count: base, state: null } }));
    } else {
      setAnswerVotes((p) => ({
        ...p,
        [answer.id]: { count: dir === 'up' ? base + 1 : base - 1, state: dir },
      }));
    }
  };

  // ── Ask question — creates a new thread ───────────────────────────────────

  const handleAskSubmit = async () => {
    if (!newTitle.trim() || !newBody.trim()) {
      addToast({ title: 'Missing fields', description: 'Please fill in both the title and body.', variant: 'error' });
      return;
    }
    if (!channelId) return;
    setIsSubmitting(true);
    try {
      const thread = await api.threads.create(channelId, {
        name: newTitle.trim(),
        message: newBody.trim(),
      });
      const newQ = threadToQuestion({ ...thread, firstMessage: newBody.trim(), author: CURRENT_USER });
      setQuestions((prev) => [newQ, ...prev]);
      setNewTitle('');
      setNewBody('');
      setShowAskModal(false);
      addToast({ title: 'Question posted', description: 'Your question has been submitted.', variant: 'success' });
    } catch (err: any) {
      addToast({ title: 'Error', description: err.message ?? 'Failed to post question.', variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Post answer — sends a message in the thread ───────────────────────────

  const handlePostAnswer = async () => {
    if (!answerText.trim() || !selectedQuestion) return;
    setIsPostingAnswer(true);
    try {
      const msg = await api.messages.send(selectedQuestion.threadId, { content: answerText.trim() });
      const newAnswer: Answer = {
        id: genId(),
        author: CURRENT_USER,
        authorColor: 'var(--accent-primary)',
        content: answerText.trim(),
        upvotes: 0,
        isSolution: false,
        time: 'just now',
      };
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === selectedQuestion.id
            ? { ...q, answers: [...q.answers, newAnswer], answerCount: q.answerCount + 1 }
            : q,
        ),
      );
      setAnswerText('');
      addToast({ title: 'Answer posted', description: 'Your answer has been submitted.', variant: 'success' });
    } catch (err: any) {
      addToast({ title: 'Error', description: err.message ?? 'Failed to post answer.', variant: 'error' });
    } finally {
      setIsPostingAnswer(false);
    }
  };

  // ── Loading / Error ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', background: 'var(--bg-primary)' }}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)' }} />
        <p style={{ color: 'var(--text-muted)' }}>Loading questions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', background: 'var(--bg-primary)' }}>
        <AlertCircle size={32} color="var(--error)" />
        <p style={{ color: 'var(--error)', fontSize: '15px' }}>{error}</p>
        <button
          onClick={() => { setError(null); setLoading(true); api.threads.list(channelId!).then(ts => setQuestions(ts.map(threadToQuestion))).catch(e => setError(e.message)).finally(() => setLoading(false)); }}
          style={{ padding: '0 24px', height: '36px', border: 'none', borderRadius: '8px', background: 'var(--accent-primary)', color: '#000', fontWeight: 600, cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    );
  }

  // ======================= RENDER =======================

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      {/* Header */}
      <header className="channel-header glass-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageSquare size={20} color="var(--text-muted)" />
          <h2 style={{ fontSize: '15px', fontWeight: 600 }}>q-and-a</h2>
        </div>
      </header>

      <div className="content-padding" style={{ flex: 1, overflowY: 'auto', padding: '32px 48px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>

          {/* ---------- DETAIL VIEW ---------- */}
          {selectedQuestion ? (
            <div>
              {/* Back button */}
              <button
                onClick={() => { setSelectedId(null); setAnswerText(''); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'none', border: 'none', color: 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: '14px', fontWeight: 500, padding: '0',
                  marginBottom: '20px',
                }}
              >
                <ArrowLeft size={16} /> Back to questions
              </button>

              {/* Question card */}
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '16px', padding: '24px', borderBottom: '1px solid var(--stroke)' }}>
                  {/* Vote column */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '40px' }}>
                    <button
                      onClick={() => handleQuestionVote(selectedQuestion.id, 'up')}
                      style={{
                        background: selectedQuestion.voteState === 'up' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                        border: '1px solid var(--stroke)', borderRadius: 'var(--radius-sm)',
                        width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: selectedQuestion.voteState === 'up' ? '#000' : 'var(--text-muted)', transition: 'all 0.15s',
                      }}
                    >
                      <ChevronUp size={20} />
                    </button>
                    <span style={{ fontSize: '18px', fontWeight: 600, color: 'var(--accent-primary)' }}>{selectedQuestion.votes}</span>
                    <button
                      onClick={() => handleQuestionVote(selectedQuestion.id, 'down')}
                      style={{
                        background: selectedQuestion.voteState === 'down' ? 'var(--error)' : 'transparent',
                        border: 'none', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: selectedQuestion.voteState === 'down' ? '#fff' : 'var(--text-muted)',
                        borderRadius: 'var(--radius-sm)', transition: 'all 0.15s',
                      }}
                    >
                      <ChevronDown size={20} />
                    </button>
                  </div>

                  {/* Question body */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      {selectedQuestion.status === 'solved' ? (
                        <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                          <CheckCircle2 size={12} /> Solved
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                          Unsolved
                        </span>
                      )}
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Posted {selectedQuestion.time}</span>
                    </div>
                    <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px' }}>{selectedQuestion.title}</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.6, marginBottom: '16px' }}>
                      {selectedQuestion.body}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: selectedQuestion.authorColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600 }}>
                        {selectedQuestion.authorInitial}
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 500 }}>{selectedQuestion.author}</span>
                    </div>
                  </div>
                </div>

                {/* Answers section */}
                <div style={{ padding: '24px', background: 'var(--bg-primary)' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-muted)' }}>
                    {selectedQuestion.answers.length} {selectedQuestion.answers.length === 1 ? 'Answer' : 'Answers'}
                  </h4>

                  {loadingAnswers && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '8px', color: 'var(--text-muted)' }}>
                      <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Loading answers...
                    </div>
                  )}

                  {!loadingAnswers && selectedQuestion.answers.length === 0 && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>
                      No answers yet. Be the first to help!
                    </p>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {selectedQuestion.answers.map((answer) => {
                      const av = getAnswerVote(answer);
                      return (
                        <div
                          key={answer.id}
                          style={{
                            display: 'flex', gap: '16px',
                            background: answer.isSolution ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-elevated)',
                            border: `1px solid ${answer.isSolution ? 'var(--success)' : 'var(--stroke)'}`,
                            borderRadius: 'var(--radius-md)', padding: '16px',
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '32px' }}>
                            <button
                              onClick={() => handleAnswerVote(answer, 'up')}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: av.state === 'up' ? 'var(--accent-primary)' : 'var(--text-muted)', transition: 'color 0.15s' }}
                            >
                              <ChevronUp size={20} />
                            </button>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: av.count > 20 ? 'var(--success)' : 'var(--text-primary)' }}>
                              {av.count}
                            </span>
                            <button
                              onClick={() => handleAnswerVote(answer, 'down')}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: av.state === 'down' ? 'var(--error)' : 'var(--text-muted)', transition: 'color 0.15s' }}
                            >
                              <ChevronDown size={20} />
                            </button>
                            {answer.isSolution && <CheckCircle2 size={24} color="var(--success)" style={{ marginTop: '8px' }} />}
                          </div>

                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: answer.authorColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 600 }}>
                                  {answer.author.charAt(0)}
                                </div>
                                <span style={{ fontSize: '14px', fontWeight: 600 }}>{answer.author}</span>
                                {answer.isSolution && (
                                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--success)', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                                    Solution
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{answer.time}</span>
                            </div>
                            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{answer.content}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Answer composer */}
                  <div style={{ marginTop: '24px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <CornerDownRight size={20} color="var(--text-muted)" style={{ marginTop: '12px' }} />
                    <div style={{ flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
                      <textarea
                        placeholder="Write an answer..."
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        style={{ width: '100%', minHeight: '60px', background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', fontSize: '14px', fontFamily: 'inherit' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                        <button
                          onClick={handlePostAnswer}
                          disabled={!answerText.trim() || isPostingAnswer}
                          style={{
                            margin: 0, border: 'none', borderRadius: 'var(--radius-sm)',
                            padding: '0 16px', height: '32px', fontSize: '13px', fontWeight: 600,
                            background: answerText.trim() ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                            color: answerText.trim() ? '#000' : 'var(--text-muted)',
                            cursor: answerText.trim() && !isPostingAnswer ? 'pointer' : 'not-allowed',
                            transition: 'all 0.15s',
                            display: 'flex', alignItems: 'center', gap: '6px',
                          }}
                        >
                          {isPostingAnswer && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
                          {isPostingAnswer ? 'Posting...' : 'Post Answer'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ---------- LIST VIEW ---------- */
            <div>
              {/* Title row */}
              <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <h1 style={{ fontSize: '28px', fontWeight: 600, fontFamily: 'var(--font-display)', marginBottom: '8px' }}>
                    Questions &amp; Answers
                  </h1>
                  <p style={{ color: 'var(--text-secondary)' }}>Find solutions or ask the community for help.</p>
                </div>
                <button
                  onClick={() => setShowAskModal(true)}
                  style={{
                    margin: 0, width: 'auto', padding: '0 24px', display: 'flex', alignItems: 'center', gap: '8px',
                    background: 'var(--accent-primary)', height: '40px', border: 'none', borderRadius: 'var(--radius-md)',
                    color: '#000', fontSize: '14px', fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.15s',
                  }}
                >
                  <Plus size={16} /> Ask Question
                </button>
              </div>

              {/* Search + Filter bar */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Search questions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%', height: '40px', paddingLeft: '36px',
                      background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                      borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none',
                      fontSize: '14px', fontFamily: 'inherit',
                    }}
                  />
                </div>
                <div style={{ position: 'relative' }}>
                  <div
                    onClick={() => setFilterOpen(!filterOpen)}
                    style={{
                      background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-md)',
                      padding: '0 16px', height: '40px', display: 'flex', alignItems: 'center', gap: '8px',
                      cursor: 'pointer', fontSize: '14px', fontWeight: 500, userSelect: 'none',
                    }}
                  >
                    Filter: {filterType}
                    <ChevronDown size={14} style={{ transform: filterOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                  </div>
                  {filterOpen && (
                    <div style={{ position: 'absolute', top: '44px', right: 0, background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-md)', padding: '4px', zIndex: 50, minWidth: '160px', boxShadow: 'var(--shadow-panel)' }}>
                      {FILTERS.map((f) => (
                        <div
                          key={f}
                          onClick={() => { setFilterType(f); setFilterOpen(false); }}
                          style={{
                            padding: '8px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                            fontSize: '13px', fontWeight: filterType === f ? 600 : 400,
                            color: filterType === f ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            background: filterType === f ? 'var(--bg-tertiary)' : 'transparent',
                            transition: 'background 0.1s',
                          }}
                        >
                          {f}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Question cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredQuestions.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: '14px' }}>
                    {questions.length === 0
                      ? 'No questions yet. Be the first to ask!'
                      : 'No questions match your search or filter.'}
                  </div>
                )}
                {filteredQuestions.map((q) => (
                  <div
                    key={q.id}
                    onClick={() => handleSelectQuestion(q.id)}
                    style={{
                      display: 'flex', gap: '16px', padding: '20px',
                      background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                      borderRadius: 'var(--radius-lg)', cursor: 'pointer', transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent-primary)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--stroke)'; }}
                  >
                    {/* Vote count */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '48px' }}>
                      <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent-primary)' }}>{q.votes}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>votes</span>
                    </div>

                    {/* Answer count */}
                    <div
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '48px',
                        background: q.status === 'solved' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                        border: q.status === 'solved' ? '1px solid var(--success)' : '1px solid var(--stroke)',
                        borderRadius: 'var(--radius-sm)', padding: '4px 8px',
                      }}
                    >
                      <span style={{ fontSize: '20px', fontWeight: 700, color: q.status === 'solved' ? 'var(--success)' : 'var(--text-primary)' }}>
                        {q.answerCount}
                      </span>
                      <span style={{ fontSize: '11px', color: q.status === 'solved' ? 'var(--success)' : 'var(--text-muted)' }}>
                        {q.answerCount === 1 ? 'answer' : 'answers'}
                      </span>
                    </div>

                    {/* Question info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {q.title}
                        </h3>
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {q.body}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: q.authorColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700 }}>
                            {q.authorInitial}
                          </div>
                          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>{q.author}</span>
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{q.time}</span>
                        {q.status === 'solved' && (
                          <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={12} /> Solved
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---------- ASK QUESTION MODAL ---------- */}
      {showAskModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 100,
          }}
          onClick={() => !isSubmitting && setShowAskModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-lg)',
              width: 'min(520px, 95vw)', padding: '28px', boxShadow: 'var(--shadow-panel)',
              maxHeight: '90vh', overflowY: 'auto' as const,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Ask a Question</h2>
              <button onClick={() => setShowAskModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>Title</label>
                <input
                  type="text"
                  placeholder="What's your question?"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', outline: 'none', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>Body</label>
                <textarea
                  placeholder="Describe your question in detail..."
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  rows={5}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', fontSize: '14px', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button onClick={() => setShowAskModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--stroke)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}>
                  Cancel
                </button>
                <button
                  onClick={handleAskSubmit}
                  disabled={isSubmitting || !newTitle.trim() || !newBody.trim()}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: newTitle.trim() && newBody.trim() ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: newTitle.trim() && newBody.trim() ? '#000' : 'var(--text-muted)', fontWeight: 700, cursor: isSubmitting ? 'not-allowed' : 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  {isSubmitting && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                  {isSubmitting ? 'Posting...' : 'Post Question'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QAChannel;
