import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Headphones, Plus, Users, LogIn, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';

interface Pod {
  id: string;
  channelId: string;
  name: string;
  participantCount: number;
  createdAt: string;
}

interface EphemeralPodsProps {
  guildId: string;
  onJoinPod: (channelId: string) => void;
}

export function EphemeralPods({ guildId, onJoinPod }: EphemeralPodsProps) {
  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newPodName, setNewPodName] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  // Fetch active pods
  const fetchPods = useCallback(async () => {
    try {
      const res = await api.ephemeralPods.list(guildId);
      setPods(res ?? []);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    fetchPods();
  }, [fetchPods]);

  // Listen for pod updates
  useEffect(() => {
    const handlePodUpdate = (data: { guildId: string; pods: Pod[] }) => {
      if (data.guildId === guildId) {
        setPods(data.pods);
      }
    };

    const s = getSocket();
    if (!s) return;
    s.on('EPHEMERAL_PODS_UPDATE', handlePodUpdate);
    return () => {
      s.off('EPHEMERAL_PODS_UPDATE', handlePodUpdate);
    };
  }, [guildId]);

  const createPod = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    try {
      const name = newPodName.trim() || `Chat ${pods.length + 1}`;
      const res = await api.ephemeralPods.create(guildId, name);
      if (res?.channelId) {
        onJoinPod(res.channelId);
      }
      setNewPodName('');
      setShowCreate(false);
      fetchPods();
    } catch {
      // Ignore
    } finally {
      setCreating(false);
    }
  }, [creating, newPodName, pods.length, guildId, onJoinPod, fetchPods]);

  const formatAge = (createdAt: string): string => {
    const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  return (
    <div style={{ padding: '8px 0' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            color: 'var(--text-muted)',
          }}
        >
          Active Pods
        </span>
        <button
          onClick={() => setShowCreate(v => !v)}
          title="Start a Chat"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 2,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden', padding: '0 12px' }}
          >
            <div
              style={{
                display: 'flex',
                gap: 6,
                marginBottom: 8,
              }}
            >
              <input
                value={newPodName}
                onChange={e => setNewPodName(e.target.value)}
                placeholder="Pod name (optional)"
                onKeyDown={e => e.key === 'Enter' && createPod()}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--stroke)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  outline: 'none',
                }}
              />
              <button
                onClick={createPod}
                disabled={creating}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'var(--accent-primary)',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: creating ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {creating ? <Loader2 size={12} /> : 'Start'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pod list */}
      {loading ? (
        <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
          Loading...
        </div>
      ) : pods.length === 0 ? (
        <div style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: 12 }}>
          No active pods. Start a quick chat!
        </div>
      ) : (
        <AnimatePresence>
          {pods.map(pod => (
            <motion.div
              key={pod.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                cursor: 'pointer',
                borderRadius: 4,
                margin: '0 4px',
              }}
              onClick={() => onJoinPod(pod.channelId)}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Headphones size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--text-primary)',
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {pod.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {formatAge(pod.createdAt)}
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  color: 'var(--text-muted)',
                  fontSize: 12,
                }}
              >
                <Users size={12} />
                {pod.participantCount}
              </div>
              <LogIn size={14} style={{ color: 'var(--text-muted)' }} />
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}
