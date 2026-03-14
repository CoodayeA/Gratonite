import { useState, useEffect } from 'react';
import { Clock, Trash2, Bell, MessageSquare, Hash, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

interface Reminder {
  id: string;
  messageId: string;
  channelId: string;
  guildId: string | null;
  remindAt: string;
  note: string | null;
  createdAt: string;
  messageContent: string | null;
  channelName: string | null;
}

export function RemindersList() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { addToast } = useToast();

  const loadReminders = async () => {
    setIsLoading(true);
    try {
      const data = await api.reminders.list();
      setReminders(data);
    } catch {
      // Reminders may not be available
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadReminders(); }, []);

  const handleDelete = async (id: string) => {
    try {
      await api.reminders.delete(id);
      setReminders(prev => prev.filter(r => r.id !== id));
      addToast({ title: 'Reminder cancelled', variant: 'success' });
    } catch {
      addToast({ title: 'Failed to cancel reminder', variant: 'error' });
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff < 0) return 'Overdue';
    if (diff < 3600000) return `in ${Math.ceil(diff / 60000)}m`;
    if (diff < 86400000) return `in ${Math.ceil(diff / 3600000)}h`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{
      background: 'var(--bg-secondary)', borderRadius: '12px',
      border: '1px solid var(--stroke)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', borderBottom: '1px solid var(--stroke)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={16} color="var(--accent-primary)" />
          <span style={{ fontWeight: 600, fontSize: '14px' }}>My Reminders</span>
          <span style={{
            fontSize: '11px', fontWeight: 600, padding: '2px 6px',
            borderRadius: '10px', background: 'var(--bg-tertiary)',
            color: 'var(--text-muted)',
          }}>
            {reminders.length}
          </span>
        </div>
        <button
          onClick={loadReminders}
          style={{
            background: 'var(--bg-tertiary)', border: 'none',
            color: 'var(--text-muted)', cursor: 'pointer',
            width: '28px', height: '28px', borderRadius: '6px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* List */}
      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {isLoading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            Loading reminders...
          </div>
        ) : reminders.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center' }}>
            <Clock size={32} color="var(--text-muted)" style={{ opacity: 0.3, marginBottom: '8px' }} />
            <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No active reminders</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px' }}>
              Right-click a message and choose "Remind Me" to set one.
            </div>
          </div>
        ) : (
          reminders.map(reminder => (
            <div key={reminder.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: '12px',
              padding: '12px 16px', borderBottom: '1px solid var(--stroke)',
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '8px',
                background: 'var(--bg-tertiary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Clock size={16} color="var(--accent-primary)" />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Channel */}
                {reminder.channelName && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <Hash size={10} />
                    {reminder.channelName}
                  </div>
                )}

                {/* Message preview */}
                {reminder.messageContent && (
                  <div style={{
                    fontSize: '13px', color: 'var(--text-secondary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    marginBottom: '4px',
                  }}>
                    <MessageSquare size={11} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                    {reminder.messageContent}
                  </div>
                )}

                {/* Note */}
                {reminder.note && (
                  <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500, marginBottom: '4px' }}>
                    {reminder.note}
                  </div>
                )}

                {/* Time */}
                <div style={{
                  fontSize: '12px', fontWeight: 600,
                  color: new Date(reminder.remindAt) < new Date() ? 'var(--error)' : 'var(--accent-primary)',
                }}>
                  {formatDate(reminder.remindAt)}
                </div>
              </div>

              <button
                onClick={() => handleDelete(reminder.id)}
                title="Cancel Reminder"
                style={{
                  background: 'none', border: 'none', color: 'var(--text-muted)',
                  cursor: 'pointer', padding: '4px', display: 'flex',
                  borderRadius: '4px',
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
