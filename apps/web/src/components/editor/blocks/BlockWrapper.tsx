/**
 * BlockWrapper.tsx — Shared chrome around every block: drag handle,
 * action menu button, selection outline, hover state.
 */
import { useCallback, useState, useRef } from 'react';
import { GripVertical, MoreHorizontal } from 'lucide-react';
import type { Block } from '@gratonite/types/api';
import { useEditorContext } from '../BlockEditorContext';

interface BlockWrapperProps {
  block: Block;
  children: React.ReactNode;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onOpenActionMenu?: (rect: DOMRect) => void;
}

export default function BlockWrapper({
  block,
  children,
  onDragStart,
  onDragOver,
  onDrop,
  onOpenActionMenu,
}: BlockWrapperProps) {
  const { selectedBlockId, multiSelected, readOnly, setSelectedBlockId, toggleMultiSelect } = useEditorContext();
  const [hovered, setHovered] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const isSelected = selectedBlockId === block.id;
  const isMultiSelected = multiSelected.has(block.id);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (e.shiftKey) {
      e.preventDefault();
      toggleMultiSelect(block.id);
    } else {
      setSelectedBlockId(block.id);
    }
  }, [block.id, setSelectedBlockId, toggleMultiSelect]);

  const handleActionClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (wrapperRef.current) {
      onOpenActionMenu?.(wrapperRef.current.getBoundingClientRect());
    }
  }, [onOpenActionMenu]);

  return (
    <div
      ref={wrapperRef}
      className={`block-wrapper ${isSelected ? 'selected' : ''} ${isMultiSelected ? 'multi-selected' : ''}`}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDragOver={onDragOver}
      onDrop={onDrop}
      data-block-id={block.id}
      data-block-type={block.type}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 4,
        padding: '3px 0',
        borderRadius: 4,
        background: isMultiSelected ? 'rgba(124, 92, 252, 0.08)' : undefined,
        transition: 'background 0.15s',
      }}
    >
      {/* Left gutter: drag handle + action menu */}
      {!readOnly && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            opacity: hovered ? 0.7 : 0,
            transition: 'opacity 0.15s',
            flexShrink: 0,
            paddingTop: 2,
            cursor: 'grab',
            userSelect: 'none',
          }}
        >
          <button
            onClick={handleActionClick}
            style={{
              background: 'none',
              border: 'none',
              padding: 2,
              cursor: 'pointer',
              color: 'var(--text-muted)',
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
            }}
            title="Block actions"
            tabIndex={-1}
          >
            <MoreHorizontal size={14} />
          </button>
          <div
            draggable={!readOnly}
            onDragStart={onDragStart}
            style={{
              padding: 2,
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Drag to reorder"
          >
            <GripVertical size={14} />
          </div>
        </div>
      )}

      {/* Block content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}
