import { useState, useEffect, useRef, useCallback } from 'react';
import { Pencil, Highlighter, Square, Circle, Minus, Eraser, Trash2, X, Pointer } from 'lucide-react';
import { getSocket, onScreenAnnotation, onScreenAnnotationClear, type ScreenAnnotationPayload } from '../../lib/socket';

type Tool = 'pointer' | 'pen' | 'highlighter' | 'rectangle' | 'circle' | 'line' | 'eraser';

interface Annotation {
  id: string;
  tool: string;
  points: number[];
  color: string;
  width: number;
  userId: string;
}

interface ScreenAnnotationProps {
  channelId: string;
  isActive: boolean;
  onClose: () => void;
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff'];
const WIDTHS = [2, 4, 8];

export default function ScreenAnnotation({ channelId, isActive, onClose }: ScreenAnnotationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#ef4444');
  const [width, setWidth] = useState(4);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentPoints = useRef<number[]>([]);
  const currentId = useRef<string>('');

  // Render all annotations to the canvas
  const renderAnnotations = useCallback((annots: Annotation[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const ann of annots) {
      ctx.strokeStyle = ann.color;
      ctx.lineWidth = ann.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (ann.tool === 'highlighter') {
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = ann.width * 4;
      } else {
        ctx.globalAlpha = 1;
      }

      if (ann.tool === 'pen' || ann.tool === 'highlighter') {
        if (ann.points.length < 4) continue;
        ctx.beginPath();
        ctx.moveTo(ann.points[0], ann.points[1]);
        for (let i = 2; i < ann.points.length; i += 2) {
          ctx.lineTo(ann.points[i], ann.points[i + 1]);
        }
        ctx.stroke();
      } else if (ann.tool === 'rectangle') {
        if (ann.points.length < 4) continue;
        const [x1, y1, x2, y2] = ann.points;
        ctx.beginPath();
        ctx.rect(x1, y1, x2 - x1, y2 - y1);
        ctx.stroke();
      } else if (ann.tool === 'circle') {
        if (ann.points.length < 4) continue;
        const [x1, y1, x2, y2] = ann.points;
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        const rx = Math.abs(x2 - x1) / 2;
        const ry = Math.abs(y2 - y1) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (ann.tool === 'line') {
        if (ann.points.length < 4) continue;
        ctx.beginPath();
        ctx.moveTo(ann.points[0], ann.points[1]);
        ctx.lineTo(ann.points[2], ann.points[3]);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }, []);

  // Re-render whenever annotations change
  useEffect(() => {
    renderAnnotations(annotations);
  }, [annotations, renderAnnotations]);

  // Resize canvas to match parent
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      renderAnnotations(annotations);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [annotations, renderAnnotations]);

  // Listen for remote annotations
  useEffect(() => {
    const unsub1 = onScreenAnnotation((payload: ScreenAnnotationPayload) => {
      if (payload.channelId !== channelId) return;
      setAnnotations(prev => [...prev, {
        id: payload.id,
        tool: payload.tool,
        points: payload.points,
        color: payload.color,
        width: payload.width,
        userId: payload.userId,
      }]);
    });

    const unsub2 = onScreenAnnotationClear((payload) => {
      if (payload.channelId !== channelId) return;
      setAnnotations([]);
    });

    return () => { unsub1(); unsub2(); };
  }, [channelId]);

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>): [number, number] => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === 'pointer') return;
    if (tool === 'eraser') {
      // Find annotation at click point and remove it
      const [x, y] = getCanvasPos(e);
      const threshold = 10;
      setAnnotations(prev => prev.filter(ann => {
        for (let i = 0; i < ann.points.length; i += 2) {
          if (Math.abs(ann.points[i] - x) < threshold && Math.abs(ann.points[i + 1] - y) < threshold) {
            return false;
          }
        }
        return true;
      }));
      return;
    }

    setIsDrawing(true);
    const [x, y] = getCanvasPos(e);
    currentPoints.current = [x, y];
    currentId.current = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || tool === 'pointer') return;
    const [x, y] = getCanvasPos(e);

    if (tool === 'pen' || tool === 'highlighter') {
      currentPoints.current.push(x, y);
      // Live preview
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      renderAnnotations(annotations);
      ctx.strokeStyle = color;
      ctx.lineWidth = tool === 'highlighter' ? width * 4 : width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = tool === 'highlighter' ? 0.3 : 1;
      ctx.beginPath();
      const pts = currentPoints.current;
      ctx.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) {
        ctx.lineTo(pts[i], pts[i + 1]);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      // Shape preview — store start point + current cursor
      const startX = currentPoints.current[0];
      const startY = currentPoints.current[1];
      const preview: Annotation = {
        id: 'preview',
        tool,
        points: [startX, startY, x, y],
        color,
        width,
        userId: '',
      };
      renderAnnotations([...annotations, preview]);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || tool === 'pointer') return;
    setIsDrawing(false);

    let finalPoints = currentPoints.current;
    if (tool !== 'pen' && tool !== 'highlighter') {
      const [x, y] = getCanvasPos(e);
      finalPoints = [currentPoints.current[0], currentPoints.current[1], x, y];
    }

    if (finalPoints.length < 4) return;

    const annotation: Annotation = {
      id: currentId.current,
      tool,
      points: finalPoints,
      color,
      width,
      userId: '',
    };

    setAnnotations(prev => [...prev, annotation]);

    // Broadcast to others
    getSocket()?.emit('SCREEN_ANNOTATION', {
      channelId,
      tool,
      points: finalPoints,
      color,
      width,
      id: currentId.current,
    });

    currentPoints.current = [];
  };

  const clearAll = () => {
    setAnnotations([]);
    getSocket()?.emit('SCREEN_ANNOTATION_CLEAR', { channelId });
  };

  if (!isActive) return null;

  return (
    <div className="absolute inset-0 z-50">
      {/* Canvas overlay */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 ${tool === 'pointer' ? 'pointer-events-none' : 'cursor-crosshair'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { if (isDrawing) { setIsDrawing(false); currentPoints.current = []; } }}
      />

      {/* Toolbar */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[var(--bg-secondary)]/95 border border-[var(--border)] shadow-lg backdrop-blur-sm">
        {/* Tool buttons */}
        <ToolButton icon={<Pointer className="w-4 h-4" />} active={tool === 'pointer'} onClick={() => setTool('pointer')} title="Select" />
        <ToolButton icon={<Pencil className="w-4 h-4" />} active={tool === 'pen'} onClick={() => setTool('pen')} title="Pen" />
        <ToolButton icon={<Highlighter className="w-4 h-4" />} active={tool === 'highlighter'} onClick={() => setTool('highlighter')} title="Highlighter" />
        <ToolButton icon={<Square className="w-4 h-4" />} active={tool === 'rectangle'} onClick={() => setTool('rectangle')} title="Rectangle" />
        <ToolButton icon={<Circle className="w-4 h-4" />} active={tool === 'circle'} onClick={() => setTool('circle')} title="Circle" />
        <ToolButton icon={<Minus className="w-4 h-4" />} active={tool === 'line'} onClick={() => setTool('line')} title="Line" />
        <ToolButton icon={<Eraser className="w-4 h-4" />} active={tool === 'eraser'} onClick={() => setTool('eraser')} title="Eraser" />

        <div className="w-px h-6 bg-[var(--border)] mx-1" />

        {/* Colors */}
        {COLORS.map(c => (
          <button
            key={c}
            className={`w-5 h-5 rounded-full border-2 transition-transform ${color === c ? 'border-white scale-110' : 'border-transparent scale-100'}`}
            style={{ backgroundColor: c }}
            onClick={() => setColor(c)}
          />
        ))}

        <div className="w-px h-6 bg-[var(--border)] mx-1" />

        {/* Widths */}
        {WIDTHS.map(w => (
          <button
            key={w}
            className={`p-1 rounded transition-colors ${width === w ? 'bg-indigo-600' : 'hover:bg-[var(--bg-tertiary)]'}`}
            onClick={() => setWidth(w)}
            title={`Width ${w}`}
          >
            <div
              className="rounded-full bg-current"
              style={{ width: `${w + 4}px`, height: `${w + 4}px` }}
            />
          </button>
        ))}

        <div className="w-px h-6 bg-[var(--border)] mx-1" />

        {/* Actions */}
        <button
          className="p-1.5 rounded hover:bg-red-500/20 text-red-400 transition-colors"
          onClick={clearAll}
          title="Clear all annotations"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors"
          onClick={onClose}
          title="Close annotations"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ToolButton({ icon, active, onClick, title }: { icon: React.ReactNode; active: boolean; onClick: () => void; title: string }) {
  return (
    <button
      className={`p-1.5 rounded transition-colors ${active ? 'bg-indigo-600 text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}`}
      onClick={onClick}
      title={title}
    >
      {icon}
    </button>
  );
}
