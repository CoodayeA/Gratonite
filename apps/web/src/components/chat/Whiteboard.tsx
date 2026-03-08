import { useState, useRef, useCallback, useEffect } from 'react';
import { Pencil, Square, Circle, Type, Eraser, Minus, Undo2, Redo2, Download, Plus, Trash2, MousePointer } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

type Tool = 'select' | 'pen' | 'line' | 'rectangle' | 'circle' | 'text' | 'eraser';

interface Stroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
  tool: Tool;
}

interface BoardSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface WhiteboardProps {
  channelId: string;
}

const COLORS = [
  '#ffffff', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1', '#000000',
];

const TOOL_ICONS: Record<Tool, React.ReactNode> = {
  select: <MousePointer className="w-4 h-4" />,
  pen: <Pencil className="w-4 h-4" />,
  line: <Minus className="w-4 h-4" />,
  rectangle: <Square className="w-4 h-4" />,
  circle: <Circle className="w-4 h-4" />,
  text: <Type className="w-4 h-4" />,
  eraser: <Eraser className="w-4 h-4" />,
};

export default function Whiteboard({ channelId }: WhiteboardProps) {
  const { addToast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#ffffff');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [showGallery, setShowGallery] = useState(true);

  const fetchBoards = useCallback(async () => {
    try {
      const data = await api.get(`/channels/${channelId}/whiteboards`);
      setBoards(data);
    } catch {
      // ignore
    }
  }, [channelId]);

  useEffect(() => { fetchBoards(); }, [fetchBoards]);

  const loadBoard = async (boardId: string) => {
    try {
      const data = await api.get(`/channels/${channelId}/whiteboards/${boardId}`);
      setActiveBoardId(boardId);
      setStrokes(data.data?.strokes || []);
      setRedoStack([]);
      setShowGallery(false);
    } catch {
      addToast({ title: 'Failed to load board', type: 'error' });
    }
  };

  const createBoard = async () => {
    try {
      const data = await api.post(`/channels/${channelId}/whiteboards`, { name: 'Untitled Board' });
      setActiveBoardId(data.id);
      setStrokes([]);
      setRedoStack([]);
      setShowGallery(false);
      fetchBoards();
    } catch {
      addToast({ title: 'Failed to create board', type: 'error' });
    }
  };

  const saveBoard = async () => {
    if (!activeBoardId) return;
    try {
      await api.put(`/channels/${channelId}/whiteboards/${activeBoardId}`, {
        data: { strokes, shapes: [], texts: [] },
      });
      addToast({ title: 'Board saved', type: 'success' });
    } catch {
      addToast({ title: 'Failed to save board', type: 'error' });
    }
  };

  // Render strokes on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const drawStroke = (s: Stroke) => {
      if (s.points.length < 2) return;
      ctx.strokeStyle = s.tool === 'eraser' ? '#1f2937' : s.color;
      ctx.lineWidth = s.tool === 'eraser' ? s.width * 3 : s.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (s.tool === 'rectangle' && s.points.length >= 2) {
        const p0 = s.points[0];
        const p1 = s.points[s.points.length - 1];
        ctx.beginPath();
        ctx.rect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
        ctx.stroke();
        return;
      }
      if (s.tool === 'circle' && s.points.length >= 2) {
        const p0 = s.points[0];
        const p1 = s.points[s.points.length - 1];
        const rx = Math.abs(p1.x - p0.x) / 2;
        const ry = Math.abs(p1.y - p0.y) / 2;
        ctx.beginPath();
        ctx.ellipse(p0.x + (p1.x - p0.x) / 2, p0.y + (p1.y - p0.y) / 2, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        return;
      }
      if (s.tool === 'line' && s.points.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        ctx.lineTo(s.points[s.points.length - 1].x, s.points[s.points.length - 1].y);
        ctx.stroke();
        return;
      }

      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x, s.points[i].y);
      }
      ctx.stroke();
    };

    strokes.forEach(drawStroke);
    if (currentStroke) drawStroke(currentStroke);
  }, [strokes, currentStroke]);

  const getPos = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (tool === 'select' || tool === 'text') return;
    setIsDrawing(true);
    const pos = getPos(e);
    setCurrentStroke({ points: [pos], color, width: strokeWidth, tool });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !currentStroke) return;
    const pos = getPos(e);
    setCurrentStroke(prev => prev ? { ...prev, points: [...prev.points, pos] } : null);
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentStroke) return;
    setIsDrawing(false);
    if (currentStroke.points.length > 1) {
      setStrokes(prev => [...prev, currentStroke]);
      setRedoStack([]);
    }
    setCurrentStroke(null);
  };

  const undo = () => {
    if (strokes.length === 0) return;
    const last = strokes[strokes.length - 1];
    setStrokes(prev => prev.slice(0, -1));
    setRedoStack(prev => [last, ...prev]);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setRedoStack(prev => prev.slice(1));
    setStrokes(prev => [...prev, next]);
  };

  const exportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'whiteboard.png';
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  if (showGallery) {
    return (
      <div className="p-4 bg-gray-900 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-medium">Whiteboards</h3>
          <button onClick={createBoard} className="flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm">
            <Plus className="w-3.5 h-3.5" /> New Board
          </button>
        </div>
        {boards.length === 0 ? (
          <p className="text-gray-500 text-sm">No boards yet. Create one to get started.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {boards.map(b => (
              <button
                key={b.id}
                onClick={() => loadBoard(b.id)}
                className="p-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-left transition-colors"
              >
                <p className="text-sm text-white font-medium truncate">{b.name}</p>
                <p className="text-xs text-gray-500 mt-1">{new Date(b.updatedAt).toLocaleDateString()}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-gray-900 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 bg-gray-800 border-b border-gray-700 flex-wrap">
        {(Object.keys(TOOL_ICONS) as Tool[]).map(t => (
          <button
            key={t}
            onClick={() => setTool(t)}
            className={`p-1.5 rounded ${tool === t ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}
            title={t.charAt(0).toUpperCase() + t.slice(1)}
          >
            {TOOL_ICONS[t]}
          </button>
        ))}
        <div className="w-px h-6 bg-gray-700 mx-1" />
        <div className="flex items-center gap-1">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-5 h-5 rounded-full border-2 ${color === c ? 'border-white' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="w-px h-6 bg-gray-700 mx-1" />
        <input
          type="range"
          min={1}
          max={20}
          value={strokeWidth}
          onChange={e => setStrokeWidth(Number(e.target.value))}
          className="w-20"
        />
        <span className="text-xs text-gray-400 w-4">{strokeWidth}</span>
        <div className="w-px h-6 bg-gray-700 mx-1" />
        <button onClick={undo} disabled={strokes.length === 0} className="p-1.5 rounded text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-30">
          <Undo2 className="w-4 h-4" />
        </button>
        <button onClick={redo} disabled={redoStack.length === 0} className="p-1.5 rounded text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-30">
          <Redo2 className="w-4 h-4" />
        </button>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={saveBoard} className="px-2 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-xs">Save</button>
          <button onClick={exportPng} className="p-1.5 rounded text-gray-400 hover:bg-gray-700 hover:text-white">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={() => setShowGallery(true)} className="px-2 py-1 text-xs text-gray-400 hover:text-white">Boards</button>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        className="cursor-crosshair w-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
}
