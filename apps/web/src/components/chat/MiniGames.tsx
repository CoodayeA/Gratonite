import { useState, useCallback } from 'react';
import { Gamepad2, RotateCcw, Trophy } from 'lucide-react';

type CellValue = 'X' | 'O' | null;

// ─── Tic-tac-toe ────────────────────────────────────────────────────────

function TicTacToe({ onResult }: { onResult: (msg: string) => void }) {
  const [board, setBoard] = useState<CellValue[]>(Array(9).fill(null));
  const [isX, setIsX] = useState(true);
  const [winner, setWinner] = useState<string | null>(null);

  const checkWinner = useCallback((b: CellValue[]): CellValue => {
    const lines = [
      [0,1,2],[3,4,5],[6,7,8], // rows
      [0,3,6],[1,4,7],[2,5,8], // cols
      [0,4,8],[2,4,6],         // diags
    ];
    for (const [a, b2, c] of lines) {
      if (b[a] && b[a] === b[b2] && b[a] === b[c]) return b[a];
    }
    return null;
  }, []);

  const handleClick = (i: number) => {
    if (board[i] || winner) return;
    const next = [...board];
    next[i] = isX ? 'X' : 'O';
    setBoard(next);

    const w = checkWinner(next);
    if (w) {
      setWinner(w);
      onResult(`${w} wins at Tic-tac-toe!`);
    } else if (next.every(c => c !== null)) {
      setWinner('draw');
      onResult("It's a draw!");
    }
    setIsX(!isX);
  };

  const reset = () => {
    setBoard(Array(9).fill(null));
    setIsX(true);
    setWinner(null);
  };

  return (
    <div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 48px)',
        gap: '4px', marginBottom: '8px',
      }}>
        {board.map((cell, i) => (
          <button
            key={i}
            onClick={() => handleClick(i)}
            style={{
              width: '48px', height: '48px', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '6px', background: cell ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
              color: cell === 'X' ? '#6366f1' : '#f59e0b',
              fontSize: '20px', fontWeight: 700, cursor: winner ? 'default' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {cell}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {winner ? (winner === 'draw' ? "Draw!" : `${winner} wins!`) : `${isX ? 'X' : 'O'}'s turn`}
        </span>
        <button onClick={reset} style={{
          background: 'none', border: 'none', color: 'var(--text-muted)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
          fontSize: '11px',
        }}>
          <RotateCcw size={12} /> Reset
        </button>
      </div>
    </div>
  );
}

// ─── Trivia ─────────────────────────────────────────────────────────────

const TRIVIA_QUESTIONS = [
  { q: 'What year was the World Wide Web invented?', options: ['1989', '1991', '1995', '1983'], answer: 0 },
  { q: 'Which planet has the most moons?', options: ['Jupiter', 'Saturn', 'Neptune', 'Uranus'], answer: 1 },
  { q: 'What is the hardest natural substance?', options: ['Titanium', 'Quartz', 'Diamond', 'Graphene'], answer: 2 },
  { q: 'Who painted the Mona Lisa?', options: ['Michelangelo', 'Raphael', 'Donatello', 'Da Vinci'], answer: 3 },
  { q: 'What is the smallest country in the world?', options: ['Monaco', 'Vatican City', 'San Marino', 'Liechtenstein'], answer: 1 },
  { q: 'How many bones are in the human body?', options: ['206', '205', '208', '200'], answer: 0 },
  { q: 'What is the chemical symbol for gold?', options: ['Go', 'Gd', 'Au', 'Ag'], answer: 2 },
  { q: 'Which ocean is the largest?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], answer: 3 },
];

function Trivia({ onResult }: { onResult: (msg: string) => void }) {
  const [qIdx, setQIdx] = useState(Math.floor(Math.random() * TRIVIA_QUESTIONS.length));
  const [selected, setSelected] = useState<number | null>(null);

  const question = TRIVIA_QUESTIONS[qIdx];

  const handleAnswer = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    if (idx === question.answer) {
      onResult('Correct! Great job!');
    } else {
      onResult(`Wrong! The answer was: ${question.options[question.answer]}`);
    }
  };

  const nextQuestion = () => {
    setQIdx(Math.floor(Math.random() * TRIVIA_QUESTIONS.length));
    setSelected(null);
  };

  return (
    <div>
      <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: '0 0 10px', fontWeight: 600 }}>
        {question.q}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {question.options.map((opt, i) => {
          let bg = 'rgba(255,255,255,0.04)';
          let border = 'rgba(255,255,255,0.1)';
          if (selected !== null) {
            if (i === question.answer) { bg = 'rgba(34, 197, 94, 0.15)'; border = 'rgba(34, 197, 94, 0.4)'; }
            else if (i === selected) { bg = 'rgba(239, 68, 68, 0.15)'; border = 'rgba(239, 68, 68, 0.4)'; }
          }
          return (
            <button
              key={i}
              onClick={() => handleAnswer(i)}
              style={{
                padding: '8px 12px', borderRadius: '6px', textAlign: 'left',
                background: bg, border: `1px solid ${border}`,
                color: 'var(--text-primary)', fontSize: '12px', cursor: selected !== null ? 'default' : 'pointer',
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {selected !== null && (
        <button onClick={nextQuestion} style={{
          marginTop: '8px', background: 'var(--accent-primary)', border: 'none',
          borderRadius: '6px', padding: '6px 14px', color: 'white',
          cursor: 'pointer', fontSize: '12px', fontWeight: 600,
        }}>
          Next Question
        </button>
      )}
    </div>
  );
}

// ─── Word Chain ─────────────────────────────────────────────────────────

function WordChain({ onResult }: { onResult: (msg: string) => void }) {
  const [words, setWords] = useState<string[]>(['apple']);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const word = input.trim().toLowerCase();
    if (!word) return;

    const lastWord = words[words.length - 1];
    const lastChar = lastWord[lastWord.length - 1];

    if (word[0] !== lastChar) {
      setError(`Word must start with "${lastChar}"`);
      return;
    }
    if (words.includes(word)) {
      setError('Word already used!');
      return;
    }
    if (word.length < 2) {
      setError('Word too short');
      return;
    }

    setWords([...words, word]);
    setInput('');
    setError('');
    onResult(`Word chain: ${word} (${words.length + 1} words)`);
  };

  return (
    <div>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px',
        maxHeight: '80px', overflowY: 'auto',
      }}>
        {words.map((w, i) => (
          <span key={i} style={{
            padding: '2px 8px', borderRadius: '4px', fontSize: '12px',
            background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)',
          }}>
            {w}
          </span>
        ))}
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '6px' }}>
        <input
          value={input}
          onChange={e => { setInput(e.target.value); setError(''); }}
          placeholder={`Word starting with "${words[words.length - 1].slice(-1)}"...`}
          style={{
            flex: 1, padding: '6px 10px', borderRadius: '6px',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--text-primary)', fontSize: '12px', outline: 'none',
          }}
        />
        <button type="submit" style={{
          padding: '6px 12px', borderRadius: '6px', border: 'none',
          background: 'var(--accent-primary)', color: 'white',
          cursor: 'pointer', fontSize: '12px', fontWeight: 600,
        }}>
          Go
        </button>
      </form>
      {error && <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#ef4444' }}>{error}</p>}
    </div>
  );
}

// ─── Main MiniGames Component ───────────────────────────────────────────

type GameType = 'tictactoe' | 'trivia' | 'wordchain' | null;

interface MiniGamesProps {
  onSendMessage?: (content: string) => void;
  onClose?: () => void;
}

export default function MiniGames({ onSendMessage, onClose }: MiniGamesProps) {
  const [activeGame, setActiveGame] = useState<GameType>(null);

  const handleResult = (msg: string) => {
    onSendMessage?.(`[Game] ${msg}`);
  };

  if (activeGame) {
    return (
      <div style={{
        background: 'rgba(30, 31, 34, 0.95)', borderRadius: '12px',
        padding: '14px', border: '1px solid rgba(255,255,255,0.08)',
        maxWidth: '280px',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '10px',
        }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {activeGame === 'tictactoe' ? 'Tic-tac-toe' :
             activeGame === 'trivia' ? 'Trivia' : 'Word Chain'}
          </span>
          <button onClick={() => setActiveGame(null)} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', fontSize: '18px', lineHeight: 1,
          }}>
            &times;
          </button>
        </div>
        {activeGame === 'tictactoe' && <TicTacToe onResult={handleResult} />}
        {activeGame === 'trivia' && <Trivia onResult={handleResult} />}
        {activeGame === 'wordchain' && <WordChain onResult={handleResult} />}
      </div>
    );
  }

  return (
    <div style={{
      background: 'rgba(30, 31, 34, 0.95)', borderRadius: '12px',
      padding: '14px', border: '1px solid rgba(255,255,255,0.08)',
      maxWidth: '280px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px',
      }}>
        <Gamepad2 size={16} color="var(--accent-primary)" />
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Mini Games</span>
        {onClose && (
          <button onClick={onClose} style={{
            marginLeft: 'auto', background: 'none', border: 'none',
            color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1,
          }}>
            &times;
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {([
          { id: 'tictactoe' as GameType, label: 'Tic-tac-toe', desc: 'Classic 3x3 grid game' },
          { id: 'trivia' as GameType, label: 'Trivia', desc: 'Test your knowledge' },
          { id: 'wordchain' as GameType, label: 'Word Chain', desc: 'Chain words by last letter' },
        ]).map(game => (
          <button
            key={game.id}
            onClick={() => setActiveGame(game.id)}
            style={{
              display: 'flex', flexDirection: 'column', gap: '2px',
              padding: '8px 12px', borderRadius: '8px', textAlign: 'left',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              cursor: 'pointer', color: 'var(--text-primary)',
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 600 }}>{game.label}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{game.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
