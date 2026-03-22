/**
 * SlashCommandMenu.tsx — "/" command palette for inserting new blocks.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Type, Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare,
  Image as ImageIcon, Video, Music, File, Table, Minus, AlertCircle,
  Code, Quote, Globe, ChevronRight, Columns, FileText, ListTree,
} from 'lucide-react';
import type { BlockType } from '@gratonite/types';

interface SlashCommandMenuProps {
  position: { top: number; left: number };
  onSelect: (type: BlockType, extra?: any) => void;
  onClose: () => void;
}

interface CommandItem {
  type: BlockType;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  extra?: any;
}

const COMMANDS: CommandItem[] = [
  // Text
  { type: 'text', label: 'Text', description: 'Plain text block', icon: <Type size={18} />, category: 'Text' },
  { type: 'heading', label: 'Heading 1', description: 'Large section heading', icon: <Heading1 size={18} />, category: 'Text', extra: { level: 1 } },
  { type: 'heading', label: 'Heading 2', description: 'Medium section heading', icon: <Heading2 size={18} />, category: 'Text', extra: { level: 2 } },
  { type: 'heading', label: 'Heading 3', description: 'Small section heading', icon: <Heading3 size={18} />, category: 'Text', extra: { level: 3 } },
  { type: 'quote', label: 'Quote', description: 'Block quote', icon: <Quote size={18} />, category: 'Text' },
  { type: 'callout', label: 'Callout', description: 'Highlighted callout box', icon: <AlertCircle size={18} />, category: 'Text' },

  // Lists
  { type: 'bulleted_list', label: 'Bulleted List', description: 'Simple bullet list', icon: <List size={18} />, category: 'Lists' },
  { type: 'numbered_list', label: 'Numbered List', description: 'Ordered number list', icon: <ListOrdered size={18} />, category: 'Lists' },
  { type: 'checklist', label: 'Checklist', description: 'To-do checkbox', icon: <CheckSquare size={18} />, category: 'Lists' },
  { type: 'toggle', label: 'Toggle', description: 'Expandable toggle block', icon: <ChevronRight size={18} />, category: 'Lists' },

  // Media
  { type: 'image', label: 'Image', description: 'Upload or embed an image', icon: <ImageIcon size={18} />, category: 'Media' },
  { type: 'video', label: 'Video', description: 'Embed a video', icon: <Video size={18} />, category: 'Media' },
  { type: 'audio', label: 'Audio', description: 'Embed an audio file', icon: <Music size={18} />, category: 'Media' },
  { type: 'file', label: 'File', description: 'Attach a file', icon: <File size={18} />, category: 'Media' },

  // Advanced
  { type: 'code', label: 'Code', description: 'Code block with syntax', icon: <Code size={18} />, category: 'Advanced' },
  { type: 'table', label: 'Table', description: 'Editable table', icon: <Table size={18} />, category: 'Advanced' },
  { type: 'divider', label: 'Divider', description: 'Horizontal line', icon: <Minus size={18} />, category: 'Advanced' },
  { type: 'embed', label: 'Embed', description: 'YouTube, Spotify, etc.', icon: <Globe size={18} />, category: 'Advanced' },
  { type: 'column_layout', label: 'Columns', description: 'Multi-column layout', icon: <Columns size={18} />, category: 'Advanced' },
  { type: 'table_of_contents', label: 'Table of Contents', description: 'Auto-generated TOC', icon: <ListTree size={18} />, category: 'Advanced' },
];

export default function SlashCommandMenu({ position, onSelect, onClose }: SlashCommandMenuProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = COMMANDS.filter(c =>
    c.label.toLowerCase().includes(search.toLowerCase()) ||
    c.description.toLowerCase().includes(search.toLowerCase()) ||
    c.category.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        onSelect(filtered[selectedIndex].type, filtered[selectedIndex].extra);
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [filtered, selectedIndex, onSelect, onClose]);

  // Group by category
  const categories = [...new Set(filtered.map(c => c.category))];

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: 320,
        maxHeight: 380,
        overflowY: 'auto',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
        zIndex: 10000,
        padding: '6px 0',
      }}
    >
      <div style={{ padding: '6px 10px' }}>
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search blocks..."
          style={{
            width: '100%', padding: '6px 10px', background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)', borderRadius: 6, outline: 'none',
            color: 'var(--text-primary)', fontSize: 'var(--text-sm)',
          }}
        />
      </div>

      {filtered.length === 0 && (
        <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
          No blocks found
        </div>
      )}

      {categories.map(cat => (
        <div key={cat}>
          <div style={{
            padding: '6px 14px', fontSize: 'var(--text-xs)', fontWeight: 600,
            color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            {cat}
          </div>
          {filtered.filter(c => c.category === cat).map((cmd) => {
            const globalIdx = filtered.indexOf(cmd);
            return (
              <div
                key={`${cmd.type}-${cmd.label}`}
                onClick={() => { onSelect(cmd.type, cmd.extra); onClose(); }}
                onMouseEnter={() => setSelectedIndex(globalIdx)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 14px', cursor: 'pointer',
                  background: globalIdx === selectedIndex ? 'var(--bg-tertiary)' : 'transparent',
                  transition: 'background 0.1s',
                }}
              >
                <div style={{
                  width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--bg-tertiary)', borderRadius: 6, color: 'var(--text-muted)', flexShrink: 0,
                  border: '1px solid var(--border)',
                }}>
                  {cmd.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{cmd.label}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{cmd.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
