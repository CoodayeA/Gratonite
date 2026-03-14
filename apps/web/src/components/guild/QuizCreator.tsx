/**
 * 134. User-Created Quizzes — Create, take, and view quiz leaderboards.
 */
import { useState, useEffect, useCallback } from 'react';
import { HelpCircle, Plus, Play, Trophy, Trash2, Check, X, Clock } from 'lucide-react';
import { api } from '../../lib/api';

interface Question {
  question: string;
  options: string[];
  correctIndex: number;
}

interface Quiz {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
  timeLimit?: number;
  createdByUsername?: string;
  createdAt: string;
  attemptCount?: number;
}

export default function QuizCreator({ guildId }: { guildId: string }) {
  const [tab, setTab] = useState<'browse' | 'create' | 'take' | 'results'>('browse');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  // Create form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<Question[]>([{ question: '', options: ['', '', '', ''], correctIndex: 0 }]);
  const [timeLimit, setTimeLimit] = useState(30);

  // Quiz-taking state
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [quizResult, setQuizResult] = useState<{ score: number; total: number; correct: number } | null>(null);

  const fetchQuizzes = useCallback(async () => {
    try { setQuizzes(await api.quizzes.list(guildId)); } catch {}
  }, [guildId]);

  useEffect(() => { fetchQuizzes(); }, [fetchQuizzes]);

  const createQuiz = async () => {
    if (!title.trim() || questions.some(q => !q.question.trim() || q.options.some(o => !o.trim()))) return;
    try {
      await api.quizzes.create(guildId, { title, description, questions, timeLimit });
      setTitle(''); setDescription(''); setQuestions([{ question: '', options: ['', '', '', ''], correctIndex: 0 }]);
      setTab('browse');
      fetchQuizzes();
    } catch {}
  };

  const startQuiz = async (quiz: Quiz) => {
    setActiveQuiz(quiz);
    setCurrentQ(0);
    setAnswers([]);
    setQuizResult(null);
    setTab('take');
  };

  const answerQuestion = async (optionIndex: number) => {
    const newAnswers = [...answers, optionIndex];
    setAnswers(newAnswers);

    if (currentQ + 1 < (activeQuiz?.questions.length || 0)) {
      setCurrentQ(currentQ + 1);
    } else {
      // Submit
      try {
        const result = await api.quizzes.attempt(guildId, activeQuiz!.id, newAnswers);
        setQuizResult(result);
      } catch {
        // Calculate locally
        const correct = newAnswers.filter((a, i) => a === activeQuiz!.questions[i].correctIndex).length;
        setQuizResult({ score: Math.round((correct / newAnswers.length) * 100), total: newAnswers.length, correct });
      }
    }
  };

  const viewLeaderboard = async (quizId: string) => {
    try {
      const lb = await api.quizzes.leaderboard(guildId, quizId);
      setLeaderboard(lb);
      setActiveQuiz(quizzes.find(q => q.id === quizId) || null);
      setTab('results');
    } catch {}
  };

  const deleteQuiz = async (quizId: string) => {
    try { await api.quizzes.delete(guildId, quizId); fetchQuizzes(); } catch {}
  };

  const addQuestion = () => {
    setQuestions([...questions, { question: '', options: ['', '', '', ''], correctIndex: 0 }]);
  };

  const updateQuestion = (qi: number, field: string, value: any) => {
    const updated = [...questions];
    if (field === 'question') updated[qi].question = value;
    else if (field === 'correctIndex') updated[qi].correctIndex = value;
    setQuestions(updated);
  };

  const updateOption = (qi: number, oi: number, value: string) => {
    const updated = [...questions];
    updated[qi].options[oi] = value;
    setQuestions(updated);
  };

  const removeQuestion = (qi: number) => {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== qi));
  };

  return (
    <div className="p-4 bg-gray-900 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-medium flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-cyan-400" /> Quizzes
        </h3>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['browse', 'create'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setQuizResult(null); }}
            className={`px-3 py-1 text-sm rounded capitalize ${tab === t ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            {t === 'create' ? 'Create Quiz' : 'Browse'}
          </button>
        ))}
      </div>

      {/* Browse */}
      {tab === 'browse' && (
        <div className="space-y-2">
          {quizzes.map(quiz => (
            <div key={quiz.id} className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg border border-gray-700">
              <HelpCircle className="w-5 h-5 text-cyan-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium">{quiz.title}</p>
                <p className="text-xs text-gray-500">
                  {quiz.questions.length} questions
                  {quiz.createdByUsername && ` by ${quiz.createdByUsername}`}
                </p>
              </div>
              <button onClick={() => startQuiz(quiz)} className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs rounded flex items-center gap-1">
                <Play className="w-3 h-3" /> Take
              </button>
              <button onClick={() => viewLeaderboard(quiz.id)} className="p-1 text-gray-400 hover:text-yellow-400">
                <Trophy className="w-4 h-4" />
              </button>
              <button onClick={() => deleteQuiz(quiz.id)} className="p-1 text-gray-400 hover:text-red-400">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {quizzes.length === 0 && <p className="text-gray-500 text-sm">No quizzes yet. Create one!</p>}
        </div>
      )}

      {/* Create */}
      {tab === 'create' && (
        <div className="space-y-4">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Quiz title" className="w-full bg-gray-800 text-white text-sm rounded px-3 py-2 border border-gray-700" />
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" className="w-full bg-gray-800 text-white text-sm rounded px-3 py-2 border border-gray-700" />
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <input type="number" value={timeLimit} onChange={e => setTimeLimit(parseInt(e.target.value) || 30)} className="w-20 bg-gray-800 text-white text-sm rounded px-2 py-1 border border-gray-700" />
            <span className="text-xs text-gray-400">seconds per question</span>
          </div>

          {questions.map((q, qi) => (
            <div key={qi} className="p-3 bg-gray-800 rounded-lg border border-gray-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Question {qi + 1}</span>
                {questions.length > 1 && (
                  <button onClick={() => removeQuestion(qi)} className="p-0.5 text-gray-500 hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <input value={q.question} onChange={e => updateQuestion(qi, 'question', e.target.value)} placeholder="Question..." className="w-full bg-gray-700 text-white text-sm rounded px-3 py-1.5 border border-gray-600" />
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuestion(qi, 'correctIndex', oi)}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      q.correctIndex === oi ? 'border-green-500 bg-green-500/20' : 'border-gray-600'
                    }`}
                  >
                    {q.correctIndex === oi && <Check className="w-3 h-3 text-green-400" />}
                  </button>
                  <input value={opt} onChange={e => updateOption(qi, oi, e.target.value)} placeholder={`Option ${oi + 1}`} className="flex-1 bg-gray-700 text-white text-sm rounded px-3 py-1.5 border border-gray-600" />
                </div>
              ))}
            </div>
          ))}

          <button onClick={addQuestion} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white">
            <Plus className="w-4 h-4" /> Add Question
          </button>
          <button onClick={createQuiz} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded font-medium">
            Publish Quiz
          </button>
        </div>
      )}

      {/* Take quiz */}
      {tab === 'take' && activeQuiz && !quizResult && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-400">Question {currentQ + 1} of {activeQuiz.questions.length}</span>
            <div className="h-1.5 flex-1 mx-3 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${((currentQ + 1) / activeQuiz.questions.length) * 100}%` }} />
            </div>
          </div>
          <p className="text-white font-medium mb-4">{activeQuiz.questions[currentQ].question}</p>
          <div className="space-y-2">
            {activeQuiz.questions[currentQ].options.map((opt, i) => (
              <button
                key={i}
                onClick={() => answerQuestion(i)}
                className="w-full text-left p-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-cyan-600 rounded-lg text-sm text-white transition-colors"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {tab === 'take' && quizResult && (
        <div className="text-center py-6">
          <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
          <h4 className="text-xl text-white font-bold mb-1">Score: {quizResult.score}%</h4>
          <p className="text-gray-400 mb-4">{quizResult.correct} of {quizResult.total} correct</p>
          <button onClick={() => setTab('browse')} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded">
            Back to Quizzes
          </button>
        </div>
      )}

      {/* Leaderboard */}
      {tab === 'results' && (
        <div>
          <h4 className="text-sm text-white font-medium mb-3 flex items-center gap-1">
            <Trophy className="w-4 h-4 text-yellow-400" /> {activeQuiz?.title} - Leaderboard
          </h4>
          <div className="space-y-1">
            {leaderboard.map((entry, i) => (
              <div key={entry.userId || i} className="flex items-center gap-3 p-2 bg-gray-800 rounded">
                <span className={`text-sm font-bold w-6 text-center ${i < 3 ? 'text-yellow-400' : 'text-gray-500'}`}>#{i + 1}</span>
                <span className="text-sm text-white flex-1">{entry.username || entry.displayName || 'User'}</span>
                <span className="text-sm text-cyan-400 font-medium">{entry.score}%</span>
                <span className="text-xs text-gray-500">{entry.timeTaken ? `${entry.timeTaken}s` : ''}</span>
              </div>
            ))}
            {leaderboard.length === 0 && <p className="text-gray-500 text-sm">No attempts yet.</p>}
          </div>
          <button onClick={() => setTab('browse')} className="mt-3 text-sm text-gray-400 hover:text-white">
            Back
          </button>
        </div>
      )}
    </div>
  );
}
