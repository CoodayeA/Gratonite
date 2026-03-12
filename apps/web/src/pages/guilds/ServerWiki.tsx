import { useState } from 'react';
import { Book, Plus, Edit3, Save, ChevronRight } from 'lucide-react';

interface WikiPage {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
  updatedBy: string;
}

export default function ServerWiki({ guildId }: { guildId: string }) {
  const [pages, setPages] = useState<WikiPage[]>([
    { id: '1', title: 'Welcome', content: '# Welcome to the server wiki\n\nEdit this page to get started.', updatedAt: new Date().toISOString(), updatedBy: 'System' },
  ]);
  const [activePage, setActivePage] = useState<string>('1');
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  const currentPage = pages.find(p => p.id === activePage);

  const addPage = () => {
    const page: WikiPage = {
      id: crypto.randomUUID(),
      title: 'New Page',
      content: '',
      updatedAt: new Date().toISOString(),
      updatedBy: 'You',
    };
    setPages(prev => [...prev, page]);
    setActivePage(page.id);
    setEditing(true);
    setEditContent('');
  };

  const savePage = () => {
    setPages(prev => prev.map(p => p.id === activePage ? { ...p, content: editContent, updatedAt: new Date().toISOString(), updatedBy: 'You' } : p));
    setEditing(false);
  };

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ width: 220, borderRight: '1px solid var(--border-primary)', padding: 12, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Book size={16} style={{ color: 'var(--accent-primary)' }} />
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>Wiki</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'auto' }}>
          {pages.map(page => (
            <button
              key={page.id}
              onClick={() => { setActivePage(page.id); setEditing(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 4, border: 'none',
                background: activePage === page.id ? 'var(--accent-primary)' : 'transparent',
                color: activePage === page.id ? 'white' : 'var(--text-secondary)',
                cursor: 'pointer', fontSize: 13, textAlign: 'left', width: '100%',
              }}
            >
              <ChevronRight size={12} /> {page.title}
            </button>
          ))}
        </div>
        <button onClick={addPage} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: 'none', border: '1px solid var(--border-primary)', borderRadius: 6, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, marginTop: 8 }}>
          <Plus size={14} /> New Page
        </button>
      </div>
      <div style={{ flex: 1, padding: 24, overflow: 'auto' }}>
        {currentPage ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{currentPage.title}</h1>
              {editing ? (
                <button onClick={savePage} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
                  <Save size={14} /> Save
                </button>
              ) : (
                <button onClick={() => { setEditing(true); setEditContent(currentPage.content); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
                  <Edit3 size={14} /> Edit
                </button>
              )}
            </div>
            {editing ? (
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                style={{ width: '100%', minHeight: 400, padding: 16, borderRadius: 8, border: '1px solid var(--border-primary)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'monospace', resize: 'vertical' }}
              />
            ) : (
              <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {currentPage.content}
              </div>
            )}
            <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text-muted)' }}>
              Last updated by {currentPage.updatedBy} · {new Date(currentPage.updatedAt).toLocaleString()}
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Select a page</div>
        )}
      </div>
    </div>
  );
}
