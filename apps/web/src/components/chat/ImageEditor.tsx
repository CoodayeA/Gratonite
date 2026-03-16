import { useState, useRef, useEffect, useCallback } from 'react';
import {
    Crop, RotateCw, Pencil, ArrowUpRight, Square, Circle, Type, Droplets,
    X, Check, Undo2, Palette, Minus, Plus
} from 'lucide-react';

type Tool = 'crop' | 'rotate' | 'draw' | 'arrow' | 'rectangle' | 'circle' | 'text' | 'blur';

interface ImageEditorProps {
    file: File;
    onSave: (editedFile: File) => void;
    onCancel: () => void;
}

const TOOLS: { key: Tool; label: string; icon: React.ReactNode }[] = [
    { key: 'crop', label: 'Crop', icon: <Crop size={18} /> },
    { key: 'rotate', label: 'Rotate', icon: <RotateCw size={18} /> },
    { key: 'draw', label: 'Draw', icon: <Pencil size={18} /> },
    { key: 'arrow', label: 'Arrow', icon: <ArrowUpRight size={18} /> },
    { key: 'rectangle', label: 'Rectangle', icon: <Square size={18} /> },
    { key: 'circle', label: 'Circle', icon: <Circle size={18} /> },
    { key: 'text', label: 'Text', icon: <Type size={18} /> },
    { key: 'blur', label: 'Blur', icon: <Droplets size={18} /> },
];

const COLORS = ['#ff4444', '#ff8c00', '#ffd700', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff', '#000000'];

interface HistoryEntry {
    imageData: ImageData;
}

const ImageEditor = ({ file, onSave, onCancel }: ImageEditorProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [activeTool, setActiveTool] = useState<Tool>('draw');
    const [color, setColor] = useState('#ff4444');
    const [brushSize, setBrushSize] = useState(4);
    const [isDrawing, setIsDrawing] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [rotation, setRotation] = useState(0);
    const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
    const [cropEnd, setCropEnd] = useState<{ x: number; y: number } | null>(null);
    const [isCropping, setIsCropping] = useState(false);
    const [textInput, setTextInput] = useState('');
    const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);
    const drawStartRef = useRef<{ x: number; y: number } | null>(null);
    const snapshotRef = useRef<ImageData | null>(null);

    // Load image onto canvas
    useEffect(() => {
        const img = new Image();
        img.onload = () => {
            const canvas = canvasRef.current;
            const overlay = overlayCanvasRef.current;
            if (!canvas || !overlay) return;

            const maxW = 800;
            const maxH = 600;
            let w = img.width;
            let h = img.height;
            if (w > maxW) { h = h * (maxW / w); w = maxW; }
            if (h > maxH) { w = w * (maxH / h); h = maxH; }

            canvas.width = w;
            canvas.height = h;
            overlay.width = w;
            overlay.height = h;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.drawImage(img, 0, 0, w, h);
            setImageLoaded(true);

            // Save initial state
            setHistory([{ imageData: ctx.getImageData(0, 0, w, h) }]);
        };
        img.src = URL.createObjectURL(file);
        return () => URL.revokeObjectURL(img.src);
    }, [file]);

    const saveToHistory = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        setHistory(prev => [...prev, { imageData: ctx.getImageData(0, 0, canvas.width, canvas.height) }]);
    }, []);

    const handleUndo = useCallback(() => {
        if (history.length <= 1) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const prev = history[history.length - 2];
        ctx.putImageData(prev.imageData, 0, 0);
        setHistory(h => h.slice(0, -1));
    }, [history]);

    const getCanvasPos = useCallback((e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        };
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        const pos = getCanvasPos(e);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (activeTool === 'text') {
            setTextPos(pos);
            return;
        }

        if (activeTool === 'crop') {
            setCropStart(pos);
            setCropEnd(pos);
            setIsCropping(true);
            return;
        }

        setIsDrawing(true);
        drawStartRef.current = pos;

        // Save snapshot for shape tools
        if (['arrow', 'rectangle', 'circle'].includes(activeTool)) {
            snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
        }

        if (activeTool === 'draw') {
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            ctx.strokeStyle = color;
            ctx.lineWidth = brushSize;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        }

        if (activeTool === 'blur') {
            applyBlurAt(ctx, pos.x, pos.y, brushSize * 4);
        }
    }, [activeTool, color, brushSize, getCanvasPos]);

    const applyBlurAt = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const r = Math.floor(radius);
        const sx = Math.max(0, Math.floor(x - r));
        const sy = Math.max(0, Math.floor(y - r));
        const sw = Math.min(canvas.width - sx, r * 2);
        const sh = Math.min(canvas.height - sy, r * 2);
        if (sw <= 0 || sh <= 0) return;

        const imageData = ctx.getImageData(sx, sy, sw, sh);
        const data = imageData.data;
        // Simple box blur
        const kernel = 3;
        const copy = new Uint8ClampedArray(data);
        for (let py = kernel; py < sh - kernel; py++) {
            for (let px = kernel; px < sw - kernel; px++) {
                let rr = 0, gg = 0, bb = 0, count = 0;
                for (let ky = -kernel; ky <= kernel; ky++) {
                    for (let kx = -kernel; kx <= kernel; kx++) {
                        const idx = ((py + ky) * sw + (px + kx)) * 4;
                        rr += copy[idx]; gg += copy[idx + 1]; bb += copy[idx + 2]; count++;
                    }
                }
                const idx = (py * sw + px) * 4;
                data[idx] = rr / count;
                data[idx + 1] = gg / count;
                data[idx + 2] = bb / count;
            }
        }
        ctx.putImageData(imageData, sx, sy);
    };

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const pos = getCanvasPos(e);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (isCropping && cropStart) {
            setCropEnd(pos);
            // Draw crop overlay
            const overlay = overlayCanvasRef.current;
            if (overlay) {
                const oCtx = overlay.getContext('2d');
                if (oCtx) {
                    oCtx.clearRect(0, 0, overlay.width, overlay.height);
                    oCtx.fillStyle = 'rgba(0,0,0,0.5)';
                    oCtx.fillRect(0, 0, overlay.width, overlay.height);
                    const x = Math.min(cropStart.x, pos.x);
                    const y = Math.min(cropStart.y, pos.y);
                    const w = Math.abs(pos.x - cropStart.x);
                    const h = Math.abs(pos.y - cropStart.y);
                    oCtx.clearRect(x, y, w, h);
                    oCtx.strokeStyle = '#fff';
                    oCtx.lineWidth = 2;
                    oCtx.setLineDash([6, 3]);
                    oCtx.strokeRect(x, y, w, h);
                    oCtx.setLineDash([]);
                }
            }
            return;
        }

        if (!isDrawing) return;

        if (activeTool === 'draw') {
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
        }

        if (activeTool === 'blur') {
            applyBlurAt(ctx, pos.x, pos.y, brushSize * 4);
        }

        if (['arrow', 'rectangle', 'circle'].includes(activeTool) && drawStartRef.current && snapshotRef.current) {
            ctx.putImageData(snapshotRef.current, 0, 0);
            const start = drawStartRef.current;

            ctx.strokeStyle = color;
            ctx.lineWidth = brushSize;
            ctx.lineCap = 'round';

            if (activeTool === 'rectangle') {
                ctx.strokeRect(start.x, start.y, pos.x - start.x, pos.y - start.y);
            } else if (activeTool === 'circle') {
                const rx = Math.abs(pos.x - start.x) / 2;
                const ry = Math.abs(pos.y - start.y) / 2;
                const cx = (start.x + pos.x) / 2;
                const cy = (start.y + pos.y) / 2;
                ctx.beginPath();
                ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
                ctx.stroke();
            } else if (activeTool === 'arrow') {
                ctx.beginPath();
                ctx.moveTo(start.x, start.y);
                ctx.lineTo(pos.x, pos.y);
                ctx.stroke();
                // Arrowhead
                const angle = Math.atan2(pos.y - start.y, pos.x - start.x);
                const headLen = 15;
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y);
                ctx.lineTo(pos.x - headLen * Math.cos(angle - Math.PI / 6), pos.y - headLen * Math.sin(angle - Math.PI / 6));
                ctx.moveTo(pos.x, pos.y);
                ctx.lineTo(pos.x - headLen * Math.cos(angle + Math.PI / 6), pos.y - headLen * Math.sin(angle + Math.PI / 6));
                ctx.stroke();
            }
        }
    }, [isDrawing, isCropping, cropStart, activeTool, color, brushSize, getCanvasPos]);

    const handleMouseUp = useCallback(() => {
        if (isCropping && cropStart && cropEnd) {
            setIsCropping(false);
            // Apply crop
            const canvas = canvasRef.current;
            const overlay = overlayCanvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const x = Math.min(cropStart.x, cropEnd.x);
            const y = Math.min(cropStart.y, cropEnd.y);
            const w = Math.abs(cropEnd.x - cropStart.x);
            const h = Math.abs(cropEnd.y - cropStart.y);

            if (w > 10 && h > 10) {
                const imageData = ctx.getImageData(x, y, w, h);
                canvas.width = w;
                canvas.height = h;
                ctx.putImageData(imageData, 0, 0);
                if (overlay) {
                    overlay.width = w;
                    overlay.height = h;
                    const oCtx = overlay.getContext('2d');
                    oCtx?.clearRect(0, 0, w, h);
                }
                saveToHistory();
            } else {
                // Too small — clear overlay
                if (overlay) {
                    const oCtx = overlay.getContext('2d');
                    oCtx?.clearRect(0, 0, overlay.width, overlay.height);
                }
            }
            setCropStart(null);
            setCropEnd(null);
            return;
        }

        if (isDrawing) {
            setIsDrawing(false);
            drawStartRef.current = null;
            snapshotRef.current = null;
            saveToHistory();
        }
    }, [isDrawing, isCropping, cropStart, cropEnd, saveToHistory]);

    const handleRotate = useCallback(() => {
        const canvas = canvasRef.current;
        const overlay = overlayCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d')!;
        tempCtx.putImageData(imageData, 0, 0);

        const newW = canvas.height;
        const newH = canvas.width;
        canvas.width = newW;
        canvas.height = newH;
        if (overlay) { overlay.width = newW; overlay.height = newH; }

        ctx.translate(newW, 0);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        setRotation(r => (r + 90) % 360);
        saveToHistory();
    }, [saveToHistory]);

    const handleTextPlace = useCallback(() => {
        if (!textPos || !textInput.trim()) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.font = `${Math.max(16, brushSize * 4)}px sans-serif`;
        ctx.fillStyle = color;
        ctx.fillText(textInput, textPos.x, textPos.y);
        setTextPos(null);
        setTextInput('');
        saveToHistory();
    }, [textPos, textInput, color, brushSize, saveToHistory]);

    const handleApply = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.toBlob(blob => {
            if (!blob) return;
            const ext = file.name.split('.').pop() || 'png';
            const editedFile = new File([blob], `edited-${file.name}`, { type: `image/${ext === 'jpg' ? 'jpeg' : ext}` });
            onSave(editedFile);
        }, file.type || 'image/png');
    }, [file, onSave]);

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.85)', display: 'flex',
            flexDirection: 'column', alignItems: 'center',
        }}>
            {/* Toolbar */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '8px 16px', background: 'var(--bg-elevated)',
                borderBottom: '1px solid var(--stroke)', width: '100%',
                justifyContent: 'center', flexWrap: 'wrap',
            }}>
                {TOOLS.map(tool => (
                    <button
                        key={tool.key}
                        onClick={() => {
                            if (tool.key === 'rotate') {
                                handleRotate();
                            } else {
                                setActiveTool(tool.key);
                            }
                        }}
                        title={tool.label}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '8px 12px', borderRadius: '8px', border: 'none',
                            cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                            background: activeTool === tool.key && tool.key !== 'rotate' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                            color: activeTool === tool.key && tool.key !== 'rotate' ? '#000' : 'var(--text-secondary)',
                            transition: 'all 0.15s',
                        }}
                    >
                        {tool.icon}
                        {tool.label}
                    </button>
                ))}

                <div style={{ width: '1px', height: '24px', background: 'var(--stroke)', margin: '0 8px' }} />

                {/* Color picker */}
                <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                    <Palette size={14} color="var(--text-muted)" />
                    {COLORS.map(c => (
                        <button
                            key={c}
                            onClick={() => setColor(c)}
                            style={{
                                width: 20, height: 20, borderRadius: '50%',
                                background: c, border: color === c ? '2px solid var(--text-primary)' : '2px solid transparent',
                                cursor: 'pointer', transition: 'border-color 0.15s',
                            }}
                        />
                    ))}
                </div>

                <div style={{ width: '1px', height: '24px', background: 'var(--stroke)', margin: '0 8px' }} />

                {/* Brush size */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button onClick={() => setBrushSize(s => Math.max(1, s - 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                        <Minus size={14} />
                    </button>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', minWidth: '20px', textAlign: 'center' }}>{brushSize}</span>
                    <button onClick={() => setBrushSize(s => Math.min(20, s + 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                        <Plus size={14} />
                    </button>
                </div>

                <div style={{ width: '1px', height: '24px', background: 'var(--stroke)', margin: '0 8px' }} />

                <button
                    onClick={handleUndo}
                    disabled={history.length <= 1}
                    title="Undo"
                    style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        padding: '8px 12px', borderRadius: '8px', border: 'none',
                        cursor: history.length <= 1 ? 'not-allowed' : 'pointer',
                        background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                        opacity: history.length <= 1 ? 0.4 : 1,
                    }}
                >
                    <Undo2 size={16} />
                </button>
            </div>

            {/* Canvas area */}
            <div ref={containerRef} style={{
                flex: 1, display: 'flex', alignItems: 'center',
                justifyContent: 'center', padding: '24px', overflow: 'auto',
                position: 'relative',
            }}>
                <div style={{ position: 'relative', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                    <canvas
                        ref={canvasRef}
                        style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 160px)', borderRadius: '4px', display: 'block' }}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    />
                    <canvas
                        ref={overlayCanvasRef}
                        style={{
                            position: 'absolute', top: 0, left: 0,
                            width: '100%', height: '100%',
                            pointerEvents: 'none',
                        }}
                    />
                </div>

                {/* Text input overlay */}
                {textPos && activeTool === 'text' && (
                    <div style={{
                        position: 'absolute',
                        top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                        borderRadius: '8px', padding: '12px', display: 'flex', gap: '8px',
                    }}>
                        <input
                            autoFocus
                            value={textInput}
                            onChange={e => setTextInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleTextPlace(); if (e.key === 'Escape') { setTextPos(null); setTextInput(''); } }}
                            placeholder="Type text..."
                            style={{
                                background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                borderRadius: '6px', padding: '6px 10px', color: 'var(--text-primary)',
                                fontSize: '14px', outline: 'none', minWidth: '200px',
                            }}
                        />
                        <button onClick={handleTextPlace} style={{
                            background: 'var(--accent-primary)', border: 'none',
                            borderRadius: '6px', padding: '6px 12px', cursor: 'pointer',
                            color: '#000', fontWeight: 600, fontSize: '12px',
                        }}>
                            Place
                        </button>
                    </div>
                )}
            </div>

            {/* Bottom bar */}
            <div style={{
                display: 'flex', justifyContent: 'center', gap: '12px',
                padding: '16px', background: 'var(--bg-elevated)',
                borderTop: '1px solid var(--stroke)', width: '100%',
            }}>
                <button
                    onClick={onCancel}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '10px 24px', borderRadius: '8px',
                        border: '1px solid var(--stroke)', background: 'none',
                        color: 'var(--text-secondary)', cursor: 'pointer',
                        fontSize: '14px', fontWeight: 600,
                    }}
                >
                    <X size={16} />
                    Cancel
                </button>
                <button
                    onClick={handleApply}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '10px 24px', borderRadius: '8px',
                        border: 'none', background: 'var(--accent-primary)',
                        color: '#000', cursor: 'pointer',
                        fontSize: '14px', fontWeight: 700,
                    }}
                >
                    <Check size={16} />
                    Apply
                </button>
            </div>
        </div>
    );
};

export default ImageEditor;
