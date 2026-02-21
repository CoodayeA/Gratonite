import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useGuildsStore } from '@/stores/guilds.store';
import { useChannelsStore } from '@/stores/channels.store';
import { useUnreadStore } from '@/stores/unread.store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/utils';
import type { Channel } from '@gratonite/types';

type Relationship = { userId: string; targetId: string; type: string };
type DmChannel = { id: string; type: 'dm' | 'group_dm'; name: string | null; lastMessageId: string | null };

export function HomePage() {
  const guildCount = useGuildsStore((s) => s.guildOrder.length);
  const addChannel = useChannelsStore((s) => s.addChannel);
  const channels = useChannelsStore((s) => s.channels);
  const unreadByChannel = useUnreadStore((s) => s.unreadByChannel);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [friendId, setFriendId] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const { data: relationships = [], isLoading: relLoading } = useQuery({
    queryKey: ['relationships'],
    queryFn: () => api.relationships.getAll() as Promise<Relationship[]>,
  });

  const { data: dmChannels = [], isLoading: dmLoading } = useQuery({
    queryKey: ['relationships', 'dms'],
    queryFn: () => api.relationships.getDmChannels() as Promise<DmChannel[]>,
  });

  const relByType = useMemo(() => {
    const buckets: Record<string, Relationship[]> = {
      friend: [],
      pending_incoming: [],
      pending_outgoing: [],
      blocked: [],
    };
    for (const rel of relationships) {
      const bucket = buckets[rel.type] ?? (buckets[rel.type] = []);
      bucket.push(rel);
    }
    return buckets;
  }, [relationships]);

  useEffect(() => {
    let added = false;
    dmChannels.forEach((dm) => {
      if (channels.has(dm.id)) return;
      const channel: Channel = {
        id: dm.id,
        guildId: null,
        type: dm.type === 'group_dm' ? 'GROUP_DM' : 'DM',
        name: dm.name ?? 'Direct Message',
        topic: null,
        position: 0,
        parentId: null,
        nsfw: false,
        lastMessageId: dm.lastMessageId ?? null,
        rateLimitPerUser: 0,
        defaultAutoArchiveDuration: null,
        defaultThreadRateLimitPerUser: null,
        defaultSortOrder: null,
        defaultForumLayout: null,
        availableTags: null,
        defaultReactionEmoji: null,
        createdAt: new Date().toISOString(),
      };
      added = true;
      addChannel(channel);
    });
    if (!added) return;
  }, [dmChannels, addChannel, channels]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    dmChannels.forEach((dm) => {
      socket.emit('CHANNEL_SUBSCRIBE', { channelId: dm.id });
    });
  }, [dmChannels]);

  async function handleSendRequest() {
    if (!friendId.trim()) return;
    setActionError('');
    setActionLoading(true);
    try {
      await api.relationships.sendFriendRequest(friendId.trim());
      setFriendId('');
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAccept(userId: string) {
    setActionError('');
    try {
      await api.relationships.acceptFriendRequest(userId);
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  }

  async function handleRemove(userId: string) {
    setActionError('');
    try {
      await api.relationships.removeFriend(userId);
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  }

  async function handleUnblock(userId: string) {
    setActionError('');
    try {
      await api.relationships.unblock(userId);
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  }

  async function handleOpenDm(userId: string) {
    setActionError('');
    try {
      const dm = await api.relationships.openDm(userId);
      const channel: Channel = {
        id: dm.id,
        guildId: null,
        type: 'DM',
        name: 'Direct Message',
        topic: null,
        position: 0,
        parentId: null,
        nsfw: false,
        lastMessageId: dm.lastMessageId ?? null,
        rateLimitPerUser: 0,
        defaultAutoArchiveDuration: null,
        defaultThreadRateLimitPerUser: null,
        defaultSortOrder: null,
        defaultForumLayout: null,
        availableTags: null,
        defaultReactionEmoji: null,
        createdAt: new Date().toISOString(),
      };
      addChannel(channel);
      navigate(`/dm/${dm.id}`);
      queryClient.invalidateQueries({ queryKey: ['relationships', 'dms'] });
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  }

  return (
    <div className="home-page">
      <div className="home-content">
        <div className="home-hero">
          <img
            src="/gratonite-mascot.png"
            alt="Gratonite"
            className="home-mascot"
            width={140}
            height={140}
          />
          <div>
            <h1 className="home-title">Friends & DMs</h1>
            <p className="home-subtitle">
              {guildCount > 0
                ? 'Keep your crew close — start a DM or manage requests.'
                : 'Join or create a server, and start a direct message from here.'}
            </p>
          </div>
        </div>

        <div className="friends-grid">
          <section className="friends-panel">
            <h2>Start a Friend Request</h2>
            <p>Enter a user ID to send a request.</p>
            <div className="friends-form">
              <Input
                label="User ID"
                type="text"
                value={friendId}
                onChange={(e) => setFriendId(e.target.value)}
                placeholder="1234567890"
              />
              <Button onClick={handleSendRequest} loading={actionLoading} disabled={!friendId.trim()}>
                Send Request
              </Button>
            </div>
            {actionError && <div className="home-error">{actionError}</div>}
          </section>

          <section className="friends-panel">
            <h2>Direct Messages</h2>
            <p>{dmLoading ? 'Loading DMs...' : 'Jump into a DM channel.'}</p>
            <div className="friends-list">
              {dmChannels.length === 0 && !dmLoading && (
                <div className="friends-empty">No DM channels yet.</div>
              )}
              {dmChannels.map((dm) => (
                <div key={dm.id} className="friends-item">
                  <div>
                    <span className="friends-name">{dm.name ?? 'Direct Message'}</span>
                    <span className="friends-meta">Channel ID: {dm.id}</span>
                  </div>
                  <div className="friends-actions">
                    {unreadByChannel.has(dm.id) && <span className="friends-unread-dot" />}
                    <Button size="sm" onClick={() => navigate(`/dm/${dm.id}`)}>Open</Button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="friends-panel">
            <h2>Friends</h2>
            <p>{relLoading ? 'Loading friends...' : 'Your current friends list.'}</p>
            <div className="friends-list">
              {(relByType['friend'] ?? []).length === 0 && !relLoading && (
                <div className="friends-empty">No friends yet.</div>
              )}
              {(relByType['friend'] ?? []).map((rel) => (
                <div key={`${rel.userId}-${rel.targetId}`} className="friends-item">
                  <div>
                    <span className="friends-name">User {rel.targetId}</span>
                    <span className="friends-meta">Friend</span>
                  </div>
                  <div className="friends-actions">
                    <Button size="sm" variant="ghost" onClick={() => handleOpenDm(rel.targetId)}>DM</Button>
                    <Button size="sm" variant="danger" onClick={() => handleRemove(rel.targetId)}>Remove</Button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="friends-panel">
            <h2>Requests</h2>
            <p>Incoming and outgoing requests.</p>
            <div className="friends-list">
              {(relByType['pending_incoming'] ?? []).map((rel) => (
                <div key={`incoming-${rel.targetId}`} className="friends-item">
                  <div>
                    <span className="friends-name">User {rel.targetId}</span>
                    <span className="friends-meta">Incoming request</span>
                  </div>
                  <div className="friends-actions">
                    <Button size="sm" onClick={() => handleAccept(rel.targetId)}>Accept</Button>
                    <Button size="sm" variant="ghost" onClick={() => handleRemove(rel.targetId)}>Decline</Button>
                  </div>
                </div>
              ))}
              {(relByType['pending_outgoing'] ?? []).map((rel) => (
                <div key={`outgoing-${rel.targetId}`} className="friends-item">
                  <div>
                    <span className="friends-name">User {rel.targetId}</span>
                    <span className="friends-meta">Outgoing request</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleRemove(rel.targetId)}>Cancel</Button>
                </div>
              ))}
              {(relByType['pending_incoming'] ?? []).length === 0
                && (relByType['pending_outgoing'] ?? []).length === 0
                && !relLoading && (
                <div className="friends-empty">No pending requests.</div>
              )}
            </div>
          </section>

          <section className="friends-panel">
            <h2>Blocked</h2>
            <p>Users you blocked.</p>
            <div className="friends-list">
              {(relByType['blocked'] ?? []).length === 0 && !relLoading && (
                <div className="friends-empty">No blocked users.</div>
              )}
              {(relByType['blocked'] ?? []).map((rel) => (
                <div key={`blocked-${rel.targetId}`} className="friends-item">
                  <div>
                    <span className="friends-name">User {rel.targetId}</span>
                    <span className="friends-meta">Blocked</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleUnblock(rel.targetId)}>Unblock</Button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
