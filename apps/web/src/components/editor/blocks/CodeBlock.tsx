/**
 * CodeBlock.tsx — Code block with language selector.
 */
import type { Block, CodeBlockContent } from '@gratonite/types/api';
import { useEditorContext } from '../BlockEditorContext';

interface Props { block: Block<'code'>; }

const LANGUAGES = [
  'javascript', 'typescript', 'python', 'java', 'c', 'cpp', 'csharp', 'go',
  'rust', 'ruby', 'php', 'swift', 'kotlin', 'sql', 'html', 'css', 'json',
  'yaml', 'markdown', 'bash', 'plaintext',
];

export default function CodeBlock({ block }: Props) {
  const { updateBlockContent, readOnly } = useEditorContext();
  const content = block.content as CodeBlockContent;

  return (
    <div style={{
      background: 'var(--bg-tertiary)', borderRadius: 8,
      border: '1px solid var(--border)', margin: '4px 0', overflow: 'hidden',
    }}>
      {!readOnly && (
        <div style={{
          display: 'flex', justifyContent: 'flex-end',
          padding: '4px 8px', borderBottom: '1px solid var(--border)',
        }}>
          <select
            value={content.language || 'plaintext'}
            onChange={(e) => updateBlockContent(block.id, { language: e.target.value })}
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text-muted)', fontSize: 'var(--text-xs)',
              cursor: 'pointer',
            }}
          >
            {LANGUAGES.map(lang => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        </div>
      )}
      <textarea
        value={content.code}
        onChange={(e) => updateBlockContent(block.id, { code: e.target.value })}
        readOnly={readOnly}
        spellCheck={false}
        style={{
          width: '100%', minHeight: 80, padding: '12px 16px',
          background: 'transparent', border: 'none', outline: 'none',
          color: 'var(--text-primary)', fontSize: 'var(--text-sm)',
          fontFamily: '"Fira Code", monospace', lineHeight: 1.6,
          resize: 'vertical', whiteSpace: 'pre', overflowX: 'auto',
        }}
        placeholder="// Write some code..."
      />
    </div>
  );
}
