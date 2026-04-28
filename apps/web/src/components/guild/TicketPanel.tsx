import { useState, useEffect, useCallback } from 'react';
import { Ticket, Plus, User, Clock, AlertCircle, CheckCircle, X, ChevronDown } from 'lucide-react';
import { API_BASE, getAccessToken } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

interface TicketData {
  id: string;
  guildId: string;
  channelId: string | null;
  authorId: string;
  assigneeId: string | null;
  status: string;
  subject: string;
  priority: string;
  createdAt: string;
  closedAt: string | null;
  authorUsername?: string;
  authorDisplayName?: string;
}

interface TicketConfigData {
  guildId: string;
  categoryChannelId: string | null;
  supportRoleId: string | null;
  autoCloseHours: number;
  greeting: string;
}

const authHeaders = () => ({
  Authorization: `Bearer ${getAccessToken() ?? ''}`,
  'Content-Type': 'application/json',
});

const priorityColors: Record<string, string> = {
  low: 'bg-green-500/20 text-green-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  high: 'bg-red-500/20 text-red-400',
};

const statusIcons: Record<string, React.ReactNode> = {
  open: <AlertCircle className="w-4 h-4 text-blue-400" />,
  in_progress: <Clock className="w-4 h-4 text-yellow-400" />,
  resolved: <CheckCircle className="w-4 h-4 text-green-400" />,
  closed: <X className="w-4 h-4 text-gray-400" />,
};

export default function TicketPanel({ guildId, isStaff, onNavigateToChannel }: {
  guildId: string;
  isStaff: boolean;
  onNavigateToChannel?: (channelId: string) => void;
}) {
  const { addToast } = useToast();
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [statusFilter, setStatusFilter] = useState('open');
  const [showCreate, setShowCreate] = useState(false);
  const [subject, setSubject] = useState('');
  const [priority, setPriority] = useState('medium');
  const [loading, setLoading] = useState(false);

  const fetchTickets = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/guilds/${guildId}/tickets?status=${statusFilter}`, {
        credentials: 'include',
        headers: authHeaders(),
      });
      if (res.ok) setTickets(await res.json());
    } catch { /* ignore */ }
  }, [guildId, statusFilter]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const createTicket = async () => {
    if (!subject.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/guilds/${guildId}/tickets`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(),
        body: JSON.stringify({ subject, priority }),
      });
      if (res.ok) {
        const ticket = await res.json();
        addToast({ title: 'Ticket created', variant: 'success' });
        setShowCreate(false);
        setSubject('');
        setPriority('medium');
        fetchTickets();
        if (ticket.channel && onNavigateToChannel) {
          onNavigateToChannel(ticket.channel.id);
        }
      } else {
        addToast({ title: 'Failed to create ticket', variant: 'error' });
      }
    } catch {
      addToast({ title: 'Failed to create ticket', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const updateTicket = async (id: string, updates: Record<string, unknown>) => {
    try {
      const res = await fetch(`${API_BASE}/guilds/${guildId}/tickets/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: authHeaders(),
        body: JSON.stringify(updates),
      });
      if (res.ok) fetchTickets();
    } catch { /* ignore */ }
  };

  const closeTicket = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/guilds/${guildId}/tickets/${id}/close`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(),
      });
      if (res.ok) {
        addToast({ title: 'Ticket closed', variant: 'success' });
        fetchTickets();
      }
    } catch { /* ignore */ }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Ticket className="w-5 h-5" /> Tickets
        </h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm"
        >
          <Plus className="w-4 h-4" /> Open Ticket
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 bg-gray-900 rounded p-1">
        {['open', 'in_progress', 'resolved', 'closed'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded text-sm capitalize ${statusFilter === s ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Create ticket modal */}
      {showCreate && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Describe your issue..."
            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm"
            autoFocus
          />
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">Priority:</span>
            {['low', 'medium', 'high'].map(p => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`px-2 py-0.5 rounded text-xs capitalize ${priority === p ? priorityColors[p] : 'text-gray-500 hover:text-gray-300'}`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white">Cancel</button>
            <button onClick={createTicket} disabled={loading || !subject.trim()} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm disabled:opacity-50">
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Ticket list */}
      <div className="space-y-2">
        {tickets.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-8">No tickets found</p>
        )}
        {tickets.map(t => (
          <div key={t.id} className="bg-gray-800 border border-gray-700 rounded-lg p-3 hover:border-gray-600">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {statusIcons[t.status]}
                <span className="text-white text-sm font-medium truncate">{t.subject}</span>
                <span className={`px-1.5 py-0.5 rounded text-xs ${priorityColors[t.priority]}`}>{t.priority}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {t.channelId && onNavigateToChannel && (
                  <button onClick={() => onNavigateToChannel(t.channelId!)} className="text-xs text-indigo-400 hover:text-indigo-300">
                    Go to channel
                  </button>
                )}
                {isStaff && t.status !== 'closed' && (
                  <div className="relative group">
                    <button className="p-1 hover:bg-gray-700 rounded"><ChevronDown className="w-3 h-3 text-gray-400" /></button>
                    <div className="absolute right-0 top-full mt-1 bg-gray-900 border border-gray-700 rounded shadow-lg hidden group-hover:block z-10 min-w-[120px]">
                      {t.status === 'open' && (
                        <button onClick={() => updateTicket(t.id, { status: 'in_progress' })} className="block w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800">
                          Start
                        </button>
                      )}
                      {t.status !== 'resolved' && (
                        <button onClick={() => updateTicket(t.id, { status: 'resolved' })} className="block w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800">
                          Resolve
                        </button>
                      )}
                      <button onClick={() => closeTicket(t.id)} className="block w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-gray-800">
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
              <span className="flex items-center gap-1"><User className="w-3 h-3" /> {t.authorDisplayName || t.authorUsername || 'Unknown'}</span>
              <span>{new Date(t.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
