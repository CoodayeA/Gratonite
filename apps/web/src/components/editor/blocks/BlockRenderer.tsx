/**
 * BlockRenderer.tsx — Maps block.type to the correct component.
 */
import type { Block } from '@gratonite/types';
import TextBlock from './TextBlock';
import HeadingBlock from './HeadingBlock';
import ListBlock from './ListBlock';
import ChecklistBlock from './ChecklistBlock';
import ImageBlock from './ImageBlock';
import VideoBlock from './VideoBlock';
import AudioBlock from './AudioBlock';
import FileBlock from './FileBlock';
import TableBlock from './TableBlock';
import DividerBlock from './DividerBlock';
import CalloutBlock from './CalloutBlock';
import CodeBlock from './CodeBlock';
import QuoteBlock from './QuoteBlock';
import EmbedBlock from './EmbedBlock';
import ToggleBlock from './ToggleBlock';
import ColumnLayoutBlock from './ColumnLayoutBlock';
import ChildPageBlock from './ChildPageBlock';
import TableOfContentsBlock from './TableOfContentsBlock';
import BlockWrapper from './BlockWrapper';

interface BlockRendererProps {
  block: Block;
  index: number;
  /** Sequential index within same list type (for numbered lists). */
  listIndex?: number;
  onEnter?: (offset: number) => void;
  onBackspaceAtStart?: () => void;
  onSlash?: (rect: DOMRect) => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onOpenActionMenu?: (rect: DOMRect) => void;
}

export default function BlockRenderer({
  block, index, listIndex,
  onEnter, onBackspaceAtStart, onSlash, onArrowUp, onArrowDown,
  onDragStart, onDragOver, onDrop, onOpenActionMenu,
}: BlockRendererProps) {
  const textProps = { onEnter, onBackspaceAtStart, onSlash, onArrowUp, onArrowDown };

  const renderNestedBlock = (child: Block) => (
    <BlockRenderer key={child.id} block={child} index={0} />
  );

  let content: React.ReactNode;

  switch (block.type) {
    case 'text':
      content = <TextBlock block={block as Block<'text'>} {...textProps} />;
      break;
    case 'heading':
      content = <HeadingBlock block={block as Block<'heading'>} onEnter={onEnter} onBackspaceAtStart={onBackspaceAtStart} onArrowUp={onArrowUp} onArrowDown={onArrowDown} />;
      break;
    case 'bulleted_list':
    case 'numbered_list':
      content = <ListBlock block={block as Block<'bulleted_list'>} index={listIndex ?? index} {...textProps} />;
      break;
    case 'checklist':
      content = <ChecklistBlock block={block as Block<'checklist'>} onEnter={onEnter} onBackspaceAtStart={onBackspaceAtStart} onArrowUp={onArrowUp} onArrowDown={onArrowDown} />;
      break;
    case 'image':
      content = <ImageBlock block={block as Block<'image'>} />;
      break;
    case 'video':
      content = <VideoBlock block={block as Block<'video'>} />;
      break;
    case 'audio':
      content = <AudioBlock block={block as Block<'audio'>} />;
      break;
    case 'file':
      content = <FileBlock block={block as Block<'file'>} />;
      break;
    case 'table':
      content = <TableBlock block={block as Block<'table'>} />;
      break;
    case 'divider':
      content = <DividerBlock />;
      break;
    case 'callout':
      content = <CalloutBlock block={block as Block<'callout'>} onEnter={onEnter} onBackspaceAtStart={onBackspaceAtStart} onArrowUp={onArrowUp} onArrowDown={onArrowDown} />;
      break;
    case 'code':
      content = <CodeBlock block={block as Block<'code'>} />;
      break;
    case 'quote':
      content = <QuoteBlock block={block as Block<'quote'>} onEnter={onEnter} onBackspaceAtStart={onBackspaceAtStart} onArrowUp={onArrowUp} onArrowDown={onArrowDown} />;
      break;
    case 'embed':
      content = <EmbedBlock block={block as Block<'embed'>} />;
      break;
    case 'toggle':
      content = <ToggleBlock block={block as Block<'toggle'>} onEnter={onEnter} onBackspaceAtStart={onBackspaceAtStart} onArrowUp={onArrowUp} onArrowDown={onArrowDown} renderBlock={renderNestedBlock} />;
      break;
    case 'column_layout':
      content = <ColumnLayoutBlock block={block as Block<'column_layout'>} renderBlock={renderNestedBlock} />;
      break;
    case 'child_page':
      content = <ChildPageBlock block={block as Block<'child_page'>} />;
      break;
    case 'table_of_contents':
      content = <TableOfContentsBlock />;
      break;
    default:
      content = <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Unknown block type: {block.type}</div>;
  }

  return (
    <BlockWrapper
      block={block}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onOpenActionMenu={onOpenActionMenu}
    >
      {content}
    </BlockWrapper>
  );
}
