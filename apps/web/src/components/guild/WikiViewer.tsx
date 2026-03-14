/**
 * 110. Wiki Pages — Frontend wiki viewer/editor with revision history.
 */
import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit3, History, ArrowLeft, Save, Trash2, RotateCcw } from 'lucide-react';
import { api } from '../../lib/api';

interface WikiPage {
  id: string;
  channelId: string;
  title: string;
  content: string;
  author: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

interface Revision {
  id: string;
  content: string;
  author: string;
  createdAt: string;
}

export default function WikiViewer({ channelId }: { channelId: string }) {
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [activePage, setActivePage] = useState<WikiPage | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [showRevisions, setShowRevisions] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchPages = useCallback(async () => {
    try {
      const data = await api.wiki.listPages(channelId);
      setPages(data);
    } catch { /* ignore */ }
  }, [channelId]);

  useEffect(() => { fetchPages(); }, [fetchPages]);

  const loadPage = async (pageId: string) => {
    try {
      const page = await api.wiki.getPage(pageId);
      setActivePage(page);
      setShowRevisions(false);
    } catch { /* ignore */ }
  };

  const createPage = async () => {
    if (!editTitle.trim()) return;
    try {
      const page = await api.wiki.createPage(channelId, { title: editTitle, content: editContent });
      setActivePage(page);
      setCreating(false);
      setEditing(false);
      fetchPages();
    } catch { /* ignore */ }
  };

  const savePage = async () => {
    if (!activePage) return;
    try {
      const updated = await api.wiki.updatePage(activePage.id, { title: editTitle, content: editContent });
      setActivePage(updated);
      setEditing(false);
      fetchPages();
    } catch { /* ignore */ }
  };

  const deletePage = async () => {
    if (!activePage) return;
    try {
      await api.wiki.deletePage(activePage.id);
      setActivePage(null);
      fetchPages();
    } catch { /* ignore */ }
  };

  const loadRevisions = async () => {
    if (!activePage) return;
    try {
      const data = await api.wiki.getRevisions(activePage.id);
      setRevisions(data);
      setShowRevisions(true);
    } catch { /* ignore */ }
  };

  const revertRevision = async (revisionId: string) => {
    if (!activePage) return;
    try {
      const updated = await api.wiki.revertRevision(activePage.id, revisionId);
      setActivePage(updated);
      setShowRevisions(false);
    } catch { /* ignore */ }
  };

  // Page list view
  if (!activePage && !creating) {
    return (
      <div className="p-4 bg-gray-900 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-medium">Wiki</h3>
          <button onClick={() => { setCreating(true); setEditTitle(''); setEditContent(''); setEditing(true); }} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded">
            <Plus className="w-4 h-4" /> New Page
          </button>
        </div>
        {pages.length === 0 ? (
          <p className="text-gray-500 text-sm">No wiki pages yet.</p>
        ) : (
          <div className="space-y-2">
            {pages.map(p => (
              <button key={p.id} onClick={() => loadPage(p.id)} className="w-full p-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-left transition-colors">
                <p className="text-sm text-white font-medium">{p.title}</p>
                <p className="text-xs text-gray-500 mt-1">
                  by {p.author} - {new Date(p.updatedAt).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Editor view
  if (editing || creating) {
    return (
      <div className="p-4 bg-gray-900 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => { setEditing(false); setCreating(false); }} className="p-1 text-gray-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h3 className="text-white font-medium">{creating ? 'New Page' : 'Edit Page'}</h3>
        </div>
        <input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Page title" className="w-full bg-gray-800 text-white rounded px-3 py-2 mb-2 border border-gray-700 text-sm" />
        <textarea value={editContent} onChange={e => setEditContent(e.target.value)} placeholder="Page content (Markdown supported)" className="w-full bg-gray-800 text-white rounded px-3 py-2 border border-gray-700 text-sm min-h-[300px] font-mono" />
        <div className="flex gap-2 mt-3">
          <button onClick={creating ? createPage : savePage} className="flex items-center gap-1 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm rounded">
            <Save className="w-4 h-4" /> {creating ? 'Create' : 'Save'}
          </button>
          <button onClick={() => { setEditing(false); setCreating(false); }} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancel</button>
        </div>
      </div>
    );
  }

  // Page view
  return (
    <div className="p-4 bg-gray-900 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => setActivePage(null)} className="p-1 text-gray-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h3 className="text-white font-medium flex-1">{activePage?.title}</h3>
        <button onClick={() => { setEditTitle(activePage?.title || ''); setEditContent(activePage?.content || ''); setEditing(true); }} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded">
          <Edit3 className="w-4 h-4" />
        </button>
        <button onClick={loadRevisions} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded">
          <History className="w-4 h-4" />
        </button>
        <button onClick={deletePage} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {showRevisions ? (
        <div className="space-y-2">
          <h4 className="text-sm text-gray-300 font-medium">Revision History</h4>
          {revisions.map(rev => (
            <div key={rev.id} className="flex items-center gap-3 p-2 bg-gray-800 rounded">
              <div className="flex-1">
                <p className="text-xs text-gray-400">{rev.author} - {new Date(rev.createdAt).toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{rev.content.slice(0, 100)}...</p>
              </div>
              <button onClick={() => revertRevision(rev.id)} className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded">
                <RotateCcw className="w-3 h-3" /> Revert
              </button>
            </div>
          ))}
          <button onClick={() => setShowRevisions(false)} className="text-xs text-gray-400 hover:text-white">Back to page</button>
        </div>
      ) : (
        <div className="prose prose-invert max-w-none">
          <div className="text-sm text-gray-300 whitespace-pre-wrap">{activePage?.content || 'Empty page.'}</div>
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500">
        Last edited: {activePage?.updatedAt ? new Date(activePage.updatedAt).toLocaleString() : 'Never'}
      </div>
    </div>
  );
}
