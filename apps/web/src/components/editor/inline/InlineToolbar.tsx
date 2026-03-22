/**
 * InlineToolbar.tsx — Floating formatting toolbar shown on text selection.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { Bold, Italic, Underline, Strikethrough, Code, Link } from 'lucide-react';

export default function InlineToolbar() {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      setVisible(false);
      return;
    }

    // Only show if selection is within an inline-editor
    const anchor = sel.anchorNode?.parentElement;
    if (!anchor?.closest('.inline-editor')) {
      setVisible(false);
      return;
    }

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setPosition({
      top: rect.top - 44,
      left: rect.left + rect.width / 2 - 120,
    });
    setVisible(true);
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', updatePosition);
    return () => document.removeEventListener('selectionchange', updatePosition);
  }, [updatePosition]);

  const execCommand = useCallback((cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
  }, []);

  const handleLinkClick = useCallback(() => {
    const url = prompt('Enter URL:');
    if (url) {
      const trimmed = url.trim();
      const lower = trimmed.toLowerCase();
      // SECURITY: reject dangerous URL schemes
      if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) return;
      execCommand('createLink', trimmed);
    }
  }, [execCommand]);

  const handleCodeClick = useCallback(() => {
    const selectedText = window.getSelection()?.toString() ?? '';
    // SECURITY: escape HTML entities before inserting
    const escaped = selectedText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    execCommand('insertHTML', `<code>${escaped}</code>`);
  }, [execCommand]);

  if (!visible) return null;

  const buttonStyle: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-primary)', padding: '6px 8px',
    display: 'flex', alignItems: 'center', borderRadius: 4,
  };

  return (
    <div
      ref={toolbarRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        zIndex: 10000,
        padding: '2px 4px',
      }}
      onMouseDown={(e) => e.preventDefault()} // Prevent losing selection
    >
      <button style={buttonStyle} onClick={() => execCommand('bold')} title="Bold (Ctrl+B)"><Bold size={15} /></button>
      <button style={buttonStyle} onClick={() => execCommand('italic')} title="Italic (Ctrl+I)"><Italic size={15} /></button>
      <button style={buttonStyle} onClick={() => execCommand('underline')} title="Underline (Ctrl+U)"><Underline size={15} /></button>
      <button style={buttonStyle} onClick={() => execCommand('strikeThrough')} title="Strikethrough"><Strikethrough size={15} /></button>
      <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
      <button style={buttonStyle} onClick={handleCodeClick} title="Code"><Code size={15} /></button>
      <button style={buttonStyle} onClick={handleLinkClick} title="Link"><Link size={15} /></button>
    </div>
  );
}
