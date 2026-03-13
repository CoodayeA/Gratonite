import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { API_BASE, getAccessToken } from '../../lib/api';

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  assigneeId: string | null;
  dueDate: string | null;
  createdBy: string;
  createdAt: string;
}

const COLUMNS = [
  { id: 'todo', label: 'To Do', color: '#6366f1' },
  { id: 'in_progress', label: 'In Progress', color: '#f59e0b' },
  { id: 'done', label: 'Done', color: '#22c55e' },
];

export default function TaskBoard({ channelId }: { channelId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addingTo, setAddingTo] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    fetch(`${API_BASE}/tasks/channels/${channelId}/tasks`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(setTasks)
      .catch((err) => { console.error('Failed to fetch tasks:', err); });
  }, [channelId]);

  const addTask = async (status: string) => {
    if (!newTaskTitle.trim()) return;
    const token = getAccessToken();
    const res = await fetch(`${API_BASE}/tasks/channels/${channelId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: newTaskTitle, status }),
    });
    if (res.ok) {
      const task = await res.json();
      setTasks(prev => [...prev, task]);
      setNewTaskTitle('');
      setAddingTo(null);
    }
  };

  const moveTask = async (taskId: string, newStatus: string) => {
    const token = getAccessToken();
    await fetch(`${API_BASE}/tasks/channels/${channelId}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: newStatus }),
    });
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  };

  const deleteTask = async (taskId: string) => {
    const token = getAccessToken();
    await fetch(`${API_BASE}/tasks/channels/${channelId}/tasks/${taskId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  return (
    <div style={{ display: 'flex', gap: 16, padding: 16, height: '100%', overflow: 'auto' }}>
      {COLUMNS.map(col => (
        <div key={col.id} style={{ flex: '1 1 0', minWidth: 240, background: 'var(--bg-secondary)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{col.label}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {tasks.filter(t => t.status === col.id).length}
            </span>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto' }}>
            {tasks.filter(t => t.status === col.id).map(task => (
              <div
                key={task.id}
                style={{
                  background: 'var(--bg-primary)',
                  borderRadius: 6,
                  padding: '10px 12px',
                  cursor: 'pointer',
                  border: '1px solid var(--border-primary)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{task.title}</span>
                  <button onClick={() => deleteTask(task.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}><Trash2 size={12} /></button>
                </div>
                {task.description && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>{task.description}</p>}
                <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                  {COLUMNS.filter(c => c.id !== col.id).map(c => (
                    <button key={c.id} onClick={() => moveTask(task.id, c.id)} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, border: '1px solid var(--border-primary)', background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {addingTo === col.id ? (
            <div style={{ marginTop: 8 }}>
              <input
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTask(col.id)}
                placeholder="Task title..."
                autoFocus
                style={{ width: '100%', padding: '8px', borderRadius: 4, border: '1px solid var(--border-primary)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                <button onClick={() => addTask(col.id)} style={{ flex: 1, padding: '6px', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Add</button>
                <button onClick={() => { setAddingTo(null); setNewTaskTitle(''); }} style={{ padding: '6px 8px', background: 'none', border: '1px solid var(--border-primary)', color: 'var(--text-muted)', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingTo(col.id)} style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, padding: '8px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, width: '100%', borderRadius: 4 }}>
              <Plus size={14} /> Add task
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
