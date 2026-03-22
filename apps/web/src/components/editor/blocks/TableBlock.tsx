/**
 * TableBlock.tsx — Editable table block.
 */
import { Plus, Trash2 } from 'lucide-react';
import type { Block, TableBlockContent } from '@gratonite/types';
import { useEditorContext } from '../BlockEditorContext';

interface Props { block: Block<'table'>; }

export default function TableBlock({ block }: Props) {
  const { updateBlockContent, readOnly } = useEditorContext();
  const content = block.content as TableBlockContent;
  const headers = content.headers || [];
  const rows = content.rows || [];

  const updateCell = (rowIdx: number, colIdx: number, value: string) => {
    const newRows = rows.map((r, i) => i === rowIdx ? r.map((c, j) => j === colIdx ? value : c) : [...r]);
    updateBlockContent(block.id, { rows: newRows });
  };

  const updateHeader = (colIdx: number, value: string) => {
    const newHeaders = headers.map((h, i) => i === colIdx ? value : h);
    updateBlockContent(block.id, { headers: newHeaders });
  };

  const addRow = () => {
    updateBlockContent(block.id, { rows: [...rows, headers.map(() => '')] });
  };

  const addColumn = () => {
    updateBlockContent(block.id, {
      headers: [...headers, `Column ${headers.length + 1}`],
      rows: rows.map(r => [...r, '']),
    });
  };

  const deleteRow = (idx: number) => {
    updateBlockContent(block.id, { rows: rows.filter((_, i) => i !== idx) });
  };

  const deleteColumn = (idx: number) => {
    if (headers.length <= 1) return;
    updateBlockContent(block.id, {
      headers: headers.filter((_, i) => i !== idx),
      rows: rows.map(r => r.filter((_, i) => i !== idx)),
    });
  };

  return (
    <div style={{ margin: '4px 0', overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={{
                padding: '8px 12px', background: 'var(--bg-tertiary)',
                borderBottom: '2px solid var(--border)', borderRight: '1px solid var(--border)',
                textAlign: 'left', fontWeight: 600, position: 'relative',
              }}>
                {readOnly ? h : (
                  <input
                    value={h}
                    onChange={(e) => updateHeader(i, e.target.value)}
                    style={{
                      background: 'none', border: 'none', outline: 'none',
                      color: 'var(--text-primary)', fontWeight: 600, width: '100%',
                    }}
                  />
                )}
                {!readOnly && headers.length > 1 && (
                  <button onClick={() => deleteColumn(i)} style={{
                    position: 'absolute', top: 2, right: 2, background: 'none', border: 'none',
                    cursor: 'pointer', color: 'var(--text-muted)', opacity: 0.5, padding: 0,
                  }} tabIndex={-1} title="Delete column">
                    <Trash2 size={10} />
                  </button>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} style={{
                  padding: '6px 12px', borderBottom: '1px solid var(--border)',
                  borderRight: '1px solid var(--border)',
                }}>
                  {readOnly ? cell : (
                    <input
                      value={cell}
                      onChange={(e) => updateCell(ri, ci, e.target.value)}
                      style={{
                        background: 'none', border: 'none', outline: 'none',
                        color: 'var(--text-primary)', width: '100%',
                      }}
                    />
                  )}
                </td>
              ))}
              {!readOnly && (
                <td style={{ padding: '4px', width: 24 }}>
                  <button onClick={() => deleteRow(ri)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', opacity: 0.5, padding: 2,
                  }} tabIndex={-1} title="Delete row">
                    <Trash2 size={12} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly && (
        <div style={{ display: 'flex', gap: 8, padding: '6px 12px', background: 'var(--bg-tertiary)' }}>
          <button onClick={addRow} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 'var(--text-xs)',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Plus size={12} /> Row
          </button>
          <button onClick={addColumn} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 'var(--text-xs)',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Plus size={12} /> Column
          </button>
        </div>
      )}
    </div>
  );
}
