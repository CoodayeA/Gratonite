import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, Image, Palette, Type, Link, X, GripVertical } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

interface Position {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface MoodItem {
  id: string;
  channelId: string;
  itemType: 'image' | 'color' | 'text' | 'link';
  content: string;
  position: Position;
  addedBy: string;
  createdAt: string;
}

interface MoodBoardProps {
  channelId: string;
}

export default function MoodBoard({ channelId }: MoodBoardProps) {
  const { addToast } = useToast();
  const [items, setItems] = useState<MoodItem[]>([]);
  const [showAddPopover, setShowAddPopover] = useState(false);
  const [addType, setAddType] = useState<MoodItem['itemType']>('image');
  const [addContent, setAddContent] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const boardRef = useRef<HTMLDivElement>(null);

  const fetchItems = useCallback(async () => {
    try {
      const data = await api.get(`/channels/${channelId}/mood-board`) as MoodItem[];
      setItems(data);
    } catch {
      // ignore
    }
  }, [channelId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const addItem = async () => {
    if (!addContent.trim()) return;
    try {
      const item = await api.post(`/channels/${channelId}/mood-board`, {
        itemType: addType,
        content: addContent,
        position: { x: Math.random() * 300, y: Math.random() * 200, w: 200, h: 200 },
      }) as MoodItem;
      setItems(prev => [...prev, item]);
      setAddContent('');
      setShowAddPopover(false);
    } catch {
      addToast({ title: 'Failed to add item', variant: 'error' });
    }
  };

  const deleteItem = async (id: string) => {
    try {
      await api.delete(`/channels/${channelId}/mood-board/${id}`);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch {
      addToast({ title: 'Failed to delete item', variant: 'error' });
    }
  };

  const updatePosition = async (id: string, pos: Partial<Position>) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const newPos = { ...item.position, ...pos };
    setItems(prev => prev.map(i => i.id === id ? { ...i, position: newPos } : i));
    try {
      await api.patch(`/channels/${channelId}/mood-board/${id}`, { position: newPos });
    } catch {
      // revert silently
    }
  };

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const item = items.find(i => i.id === id);
    if (!item) return;
    setDraggingId(id);
    const boardRect = boardRef.current?.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - (boardRect?.left || 0) - item.position.x,
      y: e.clientY - (boardRect?.top || 0) - item.position.y,
    };
  };

  const handleResizeDown = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const item = items.find(i => i.id === id);
    if (!item) return;
    setResizingId(id);
    resizeStart.current = { x: e.clientX, y: e.clientY, w: item.position.w, h: item.position.h };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingId) {
        const boardRect = boardRef.current?.getBoundingClientRect();
        if (!boardRect) return;
        const x = Math.max(0, e.clientX - boardRect.left - dragOffset.current.x);
        const y = Math.max(0, e.clientY - boardRect.top - dragOffset.current.y);
        setItems(prev => prev.map(i => i.id === draggingId ? { ...i, position: { ...i.position, x, y } } : i));
      }
      if (resizingId) {
        const dx = e.clientX - resizeStart.current.x;
        const dy = e.clientY - resizeStart.current.y;
        const w = Math.max(80, resizeStart.current.w + dx);
        const h = Math.max(80, resizeStart.current.h + dy);
        setItems(prev => prev.map(i => i.id === resizingId ? { ...i, position: { ...i.position, w, h } } : i));
      }
    };
    const handleMouseUp = () => {
      if (draggingId) {
        const item = items.find(i => i.id === draggingId);
        if (item) updatePosition(draggingId, item.position);
        setDraggingId(null);
      }
      if (resizingId) {
        const item = items.find(i => i.id === resizingId);
        if (item) updatePosition(resizingId, item.position);
        setResizingId(null);
      }
    };

    if (draggingId || resizingId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingId, resizingId, items]);

  const renderItem = (item: MoodItem) => {
    switch (item.itemType) {
      case 'image':
        return <img src={item.content} alt="" loading="lazy" className="w-full h-full object-cover rounded" />;
      case 'color':
        return <div className="w-full h-full rounded" style={{ backgroundColor: item.content }} />;
      case 'text':
        return <div className="w-full h-full flex items-center justify-center p-2 text-white text-sm text-center">{item.content}</div>;
      case 'link':
        return (
          <div className="w-full h-full flex flex-col items-center justify-center p-2 bg-gray-800 rounded">
            <Link className="w-6 h-6 text-indigo-400 mb-1" />
            <a href={item.content} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:underline truncate max-w-full">
              {item.content}
            </a>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col bg-gray-900 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-2 bg-gray-800 border-b border-gray-700">
        <span className="text-sm font-medium text-white">Mood Board</span>
        <button onClick={() => setShowAddPopover(!showAddPopover)} className="flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>

      {/* Add Popover */}
      {showAddPopover && (
        <div className="p-3 bg-gray-800 border-b border-gray-700">
          <div className="flex gap-1 mb-2">
            {([
              { type: 'image' as const, icon: Image, label: 'Image' },
              { type: 'color' as const, icon: Palette, label: 'Color' },
              { type: 'text' as const, icon: Type, label: 'Text' },
              { type: 'link' as const, icon: Link, label: 'Link' },
            ]).map(({ type, icon: Icon, label }) => (
              <button
                key={type}
                onClick={() => setAddType(type)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${addType === type ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              >
                <Icon className="w-3 h-3" /> {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {addType === 'color' ? (
              <input type="color" value={addContent || '#3b82f6'} onChange={e => setAddContent(e.target.value)} className="w-10 h-8 rounded cursor-pointer" />
            ) : (
              <input
                type="text"
                value={addContent}
                onChange={e => setAddContent(e.target.value)}
                placeholder={addType === 'image' ? 'Image URL...' : addType === 'link' ? 'Link URL...' : 'Enter text...'}
                className="flex-1 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                onKeyDown={e => e.key === 'Enter' && addItem()}
              />
            )}
            <button onClick={addItem} className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-xs">Add</button>
            <button onClick={() => setShowAddPopover(false)} className="p-1 text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Board Canvas */}
      <div ref={boardRef} className="relative w-full min-h-[400px] bg-gray-900/50 overflow-auto" style={{ height: 500 }}>
        {items.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-sm">
            Add items to start your mood board
          </div>
        )}
        {items.map(item => (
          <div
            key={item.id}
            className="absolute group"
            style={{
              left: item.position.x,
              top: item.position.y,
              width: item.position.w,
              height: item.position.h,
            }}
          >
            <div
              className="absolute top-0 left-0 p-1 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity z-10"
              onMouseDown={e => handleMouseDown(e, item.id)}
            >
              <GripVertical className="w-4 h-4 text-white/70" />
            </div>
            <button
              onClick={() => deleteItem(item.id)}
              className="absolute top-0 right-0 p-1 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity z-10"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <div className="w-full h-full border border-gray-700 rounded overflow-hidden">
              {renderItem(item)}
            </div>
            {/* Resize handle */}
            <div
              className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity"
              onMouseDown={e => handleResizeDown(e, item.id)}
            >
              <div className="w-2 h-2 border-r-2 border-b-2 border-white/50 absolute bottom-0.5 right-0.5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
