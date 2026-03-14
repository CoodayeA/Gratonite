/**
 * 108. Kanban Board — Drag-and-drop task board per channel.
 */
import { useState, useEffect, useCallback } from 'react';
import { Plus, GripVertical, Trash2, User, Calendar } from 'lucide-react';
import { api } from '../../lib/api';

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  assigneeId: string | null;
  dueDate: string | null;
  createdBy: string;
  position: number;
}

const COLUMNS = [
  { id: 'todo', label: 'To Do', color: 'bg-gray-600' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-blue-600' },
  { id: 'done', label: 'Done', color: 'bg-green-600' },
];

export default function KanbanBoard({ channelId }: { channelId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [draggedTask, setDraggedTask] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const data = await api.get<Task[]>(`/tasks/channels/${channelId}/tasks`);
      setTasks(data);
    } catch { /* ignore */ }
  }, [channelId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const addTask = async (status: string) => {
    if (!newTitle.trim()) return;
    try {
      const task = await api.post<Task>(`/tasks/channels/${channelId}/tasks`, { title: newTitle, status });
      setTasks(prev => [...prev, task]);
      setNewTitle('');
      setAddingTo(null);
    } catch { /* ignore */ }
  };

  const moveTask = async (taskId: string, newStatus: string) => {
    try {
      await api.patch(`/tasks/channels/${channelId}/tasks/${taskId}`, { status: newStatus });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch { /* ignore */ }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await api.delete(`/tasks/channels/${channelId}/tasks/${taskId}`);
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch { /* ignore */ }
  };

  const handleDragStart = (taskId: string) => setDraggedTask(taskId);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (status: string) => {
    if (draggedTask) {
      moveTask(draggedTask, status);
      setDraggedTask(null);
    }
  };

  return (
    <div className="flex gap-3 p-4 overflow-x-auto min-h-[400px]">
      {COLUMNS.map(col => {
        const columnTasks = tasks.filter(t => t.status === col.id);
        return (
          <div
            key={col.id}
            className="flex-shrink-0 w-72 bg-gray-800 rounded-lg flex flex-col"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(col.id)}
          >
            {/* Column header */}
            <div className="flex items-center gap-2 p-3 border-b border-gray-700">
              <div className={`w-3 h-3 rounded-full ${col.color}`} />
              <span className="text-sm font-medium text-white">{col.label}</span>
              <span className="text-xs text-gray-500 ml-auto">{columnTasks.length}</span>
            </div>

            {/* Tasks */}
            <div className="flex-1 p-2 space-y-2 overflow-y-auto">
              {columnTasks.map(task => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={() => handleDragStart(task.id)}
                  className="bg-gray-900 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:bg-gray-850 border border-gray-700 group"
                >
                  <div className="flex items-start gap-2">
                    <GripVertical className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{task.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        {task.dueDate && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Calendar className="w-3 h-3" /> {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => deleteTask(task.id)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Add task form */}
              {addingTo === col.id ? (
                <div className="space-y-2">
                  <input
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTask(col.id)}
                    placeholder="Task title..."
                    className="w-full bg-gray-900 text-white text-sm rounded px-3 py-2 border border-gray-600 focus:outline-none focus:border-indigo-500"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button onClick={() => addTask(col.id)} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded">Add</button>
                    <button onClick={() => setAddingTo(null)} className="px-3 py-1 text-gray-400 hover:text-white text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setAddingTo(col.id); setNewTitle(''); }}
                  className="w-full flex items-center gap-1 px-3 py-2 text-gray-500 hover:text-white hover:bg-gray-900 rounded text-sm transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add task
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
