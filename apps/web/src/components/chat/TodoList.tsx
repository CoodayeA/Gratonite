/**
 * 113. To-do Lists — Shared checklists in channels with assignees.
 */
import { useState, useEffect, useCallback } from 'react';
import { Plus, Check, Square, CheckSquare, Trash2, User } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

interface TodoItem { id: string; text: string; completed: boolean; assigneeId: string | null; position: number; }
interface TodoListData { id: string; title: string; createdAt: string; }

export default function TodoList({ channelId }: { channelId: string }) {
  const [lists, setLists] = useState<TodoListData[]>([]);
  const [activeList, setActiveList] = useState<string | null>(null);
  const [items, setItems] = useState<TodoItem[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newItem, setNewItem] = useState('');
  const { addToast } = useToast();

  const fetchLists = useCallback(async () => {
    try { setLists(await api.todoLists.list(channelId)); } catch {}
  }, [channelId]);

  useEffect(() => { fetchLists(); }, [fetchLists]);

  const fetchItems = useCallback(async (listId: string) => {
    try { setItems(await api.todoLists.getItems(channelId, listId)); } catch {}
  }, [channelId]);

  useEffect(() => { if (activeList) fetchItems(activeList); }, [activeList, fetchItems]);

  const createList = async () => {
    if (!newTitle.trim()) return;
    try {
      const list = await api.todoLists.create(channelId, newTitle);
      setLists(prev => [list, ...prev]);
      setActiveList(list.id);
      setNewTitle('');
    } catch { addToast({ title: 'Failed to create list', variant: 'error' }); }
  };

  const addItem = async () => {
    if (!newItem.trim() || !activeList) return;
    try {
      const item = await api.todoLists.addItem(channelId, activeList, { text: newItem });
      setItems(prev => [...prev, item]);
      setNewItem('');
    } catch { addToast({ title: 'Failed to add item', variant: 'error' }); }
  };

  const toggleItem = async (item: TodoItem) => {
    if (!activeList) return;
    try {
      const updated = await api.todoLists.updateItem(channelId, activeList, item.id, { completed: !item.completed });
      setItems(prev => prev.map(i => i.id === item.id ? updated : i));
    } catch { addToast({ title: 'Failed to update item', variant: 'error' }); }
  };

  const deleteItem= async (itemId: string) => {
    if (!activeList) return;
    try {
      await api.todoLists.deleteItem(channelId, activeList, itemId);
      setItems(prev => prev.filter(i => i.id !== itemId));
    } catch { addToast({ title: 'Failed to delete item', variant: 'error' }); }
  };

  const completed= items.filter(i => i.completed).length;
  const total = items.length;

  return (
    <div className="p-4 bg-gray-900 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-medium">To-Do Lists</h3>
      </div>

      {/* List selector */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
        {lists.map(l => (
          <button key={l.id} onClick={() => setActiveList(l.id)} className={`px-3 py-1 text-sm rounded flex-shrink-0 ${activeList === l.id ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            {l.title}
          </button>
        ))}
        <div className="flex items-center gap-1 flex-shrink-0">
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && createList()} placeholder="New list..." className="bg-gray-800 text-white text-sm rounded px-2 py-1 border border-gray-700 w-28" />
          <button onClick={createList} className="p-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded"><Plus className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Items */}
      {activeList && (
        <>
          {total > 0 && (
            <div className="mb-2">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span>{completed}/{total} completed</span>
                <span>{Math.round((completed / total) * 100)}%</span>
              </div>
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${(completed / total) * 100}%` }} />
              </div>
            </div>
          )}

          <div className="space-y-1 mb-3">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-2 p-2 hover:bg-gray-800 rounded group">
                <button onClick={() => toggleItem(item)} className="flex-shrink-0">
                  {item.completed
                    ? <CheckSquare className="w-5 h-5 text-green-400" />
                    : <Square className="w-5 h-5 text-gray-500" />
                  }
                </button>
                <span className={`flex-1 text-sm ${item.completed ? 'text-gray-500 line-through' : 'text-white'}`}>{item.text}</span>
                <button onClick={() => deleteItem(item.id)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem()} placeholder="Add item..." className="flex-1 bg-gray-800 text-white text-sm rounded px-3 py-2 border border-gray-700" />
            <button onClick={addItem} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded">Add</button>
          </div>
        </>
      )}
    </div>
  );
}
