import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { socket } from '../../lib/socket';

interface PresenceUser {
  id: string;
  username: string;
  displayName: string;
  avatarHash: string | null;
}

interface ChannelPresenceProps {
  channelId: string;
}

const MAX_VISIBLE = 5;
const AVATAR_SIZE = 28;

function getInitials(name: string): string {
  return name.charAt(0).toUpperCase();
}

export function ChannelPresence({ channelId }: ChannelPresenceProps) {
  const [viewers, setViewers] = useState<PresenceUser[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    socket.emit('CHANNEL_PRESENCE_JOIN', { channelId });

    const handleUpdate = (data: { channelId: string; viewers: PresenceUser[] }) => {
      if (data.channelId === channelId) {
        setViewers(data.viewers);
      }
    };

    socket.on('CHANNEL_PRESENCE_UPDATE', handleUpdate);
    return () => {
      socket.emit('CHANNEL_PRESENCE_LEAVE', { channelId });
      socket.off('CHANNEL_PRESENCE_UPDATE', handleUpdate);
    };
  }, [channelId]);

  const visible = useMemo(() => viewers.slice(0, MAX_VISIBLE), [viewers]);
  const overflow = viewers.length - MAX_VISIBLE;

  if (viewers.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 8,
        borderLeft: '1px solid var(--stroke)',
        marginLeft: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <AnimatePresence>
          {visible.map((user, i) => (
            <motion.div
              key={user.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                position: 'relative',
                marginLeft: i === 0 ? 0 : -8,
                zIndex: MAX_VISIBLE - i,
              }}
              onMouseEnter={() => setHoveredId(user.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div
                style={{
                  width: AVATAR_SIZE,
                  height: AVATAR_SIZE,
                  borderRadius: '50%',
                  border: '2px solid var(--bg-primary)',
                  background: user.avatarHash
                    ? `url(/avatars/${user.id}/${user.avatarHash}.webp) center/cover`
                    : 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'default',
                }}
              >
                {!user.avatarHash && getInitials(user.displayName || user.username)}
              </div>

              {/* Tooltip */}
              {hoveredId === user.id && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: AVATAR_SIZE + 6,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                    padding: '4px 8px',
                    borderRadius: 4,
                    fontSize: 12,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    zIndex: 100,
                    pointerEvents: 'none',
                  }}
                >
                  {user.displayName || user.username}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {overflow > 0 && (
          <div
            style={{
              marginLeft: -8,
              width: AVATAR_SIZE,
              height: AVATAR_SIZE,
              borderRadius: '50%',
              border: '2px solid var(--bg-primary)',
              background: 'var(--bg-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            +{overflow}
          </div>
        )}
      </div>
    </div>
  );
}
