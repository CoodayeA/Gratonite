/**
 * CalloutBlock.tsx — Highlighted callout with icon and text.
 */
import { Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import type { Block, CalloutBlockContent } from '@gratonite/types/api';
import InlineEditor from '../inline/InlineEditor';
import { useEditorContext } from '../BlockEditorContext';

interface Props {
  block: Block<'callout'>;
  onEnter?: (offset: number) => void;
  onBackspaceAtStart?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
}

/** Map callout emoji/icon hint to a Lucide icon + color. */
function getCalloutIcon(hint?: string): { Icon: React.ComponentType<any>; color: string } {
  switch (hint) {
    case '!':
    case 'warning':
      return { Icon: AlertTriangle, color: '#f59e0b' };
    case 'error':
    case 'x':
      return { Icon: XCircle, color: '#ef4444' };
    case 'success':
    case 'check':
      return { Icon: CheckCircle, color: '#22c55e' };
    default:
      return { Icon: Info, color: 'var(--accent-primary)' };
  }
}

export default function CalloutBlock({ block, onEnter, onBackspaceAtStart, onArrowUp, onArrowDown }: Props) {
  const { updateBlockContent } = useEditorContext();
  const content = block.content as CalloutBlockContent;
  const { Icon, color } = getCalloutIcon(content.emoji);

  return (
    <div style={{
      display: 'flex', gap: 10, padding: '12px 16px',
      background: content.color ? `${content.color}15` : 'var(--bg-tertiary)',
      borderRadius: 8, border: '1px solid var(--border)',
      margin: '4px 0',
    }}>
      <div style={{ flexShrink: 0, marginTop: 2 }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <InlineEditor
          blockId={block.id}
          richText={content.richText}
          onChange={(richText) => updateBlockContent(block.id, { richText })}
          onEnter={onEnter}
          onBackspaceAtStart={onBackspaceAtStart}
          onArrowUp={onArrowUp}
          onArrowDown={onArrowDown}
          placeholder="Type something..."
          style={{ fontSize: 'var(--text-base)', lineHeight: 1.65, color: 'var(--text-primary)' }}
        />
      </div>
    </div>
  );
}
