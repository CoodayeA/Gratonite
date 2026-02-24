import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useUiStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { Avatar } from '@/components/ui/Avatar';
import type { PresenceStatus } from '@/stores/presence.store';

function formatDate(iso: string | undefined | null): string {
  if (!iso) return 'Unknown';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export function FullProfileOverlay() {
  const modalData = useUiStore((s) => s.modalData);
  const closeModal = useUiStore((s) => s.closeModal);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const userId = (modalData?.['userId'] as string) ?? '';
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [closeModal]);

  // Close more menu when clicking outside
  useEffect(() => {
    if (!moreMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [moreMenuOpen]);

  // ---------- Queries ----------

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['users', 'profile', userId],
    queryFn: () => api.users.getProfile(userId),
    enabled: !!userId,
  });

  const { data: mutuals } = useQuery({
    queryKey: ['users', 'mutuals', userId],
    queryFn: () => api.users.getMutuals(userId),
    enabled: !!userId,
  });

  const { data: presences } = useQuery({
    queryKey: ['users', 'presences', [userId]],
    queryFn: () => api.users.getPresences([userId]),
    enabled: !!userId,
  });

  const { data: relationships = [] } = useQuery({
    queryKey: ['relationships'],
    queryFn: () => api.relationships.getAll() as Promise<Array<{ targetId: string; type: string }>>,
    staleTime: 15_000,
  });

  // ---------- Derived state ----------

  const presence = presences?.[0];
  const status: PresenceStatus = (presence?.status as PresenceStatus) ?? 'offline';
  const mutualServerCount = mutuals?.mutualServers?.length ?? 0;
  const mutualFriendCount = mutuals?.mutualFriends?.length ?? 0;
  const isSelf = currentUserId === userId;

  const relationshipStatus = useMemo(() => {
    const rel = relationships.find((r) => r.targetId === userId);
    if (!rel) return 'none';
    return rel.type; // 'friend' | 'blocked' | 'pending_incoming' | 'pending_outgoing'
  }, [relationships, userId]);

  const bannerStyle: React.CSSProperties = profile?.bannerHash
    ? {
        backgroundImage: `url(/api/v1/files/banners/users/${userId}/${profile.bannerHash})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {};

  // ---------- Mutations ----------

  const openDmMutation = useMutation({
    mutationFn: () => api.relationships.openDm(userId),
    onSuccess: (channel) => {
      closeModal();
      navigate(`/dm/${channel.id}`);
    },
  });

  const addFriendMutation = useMutation({
    mutationFn: () => api.relationships.sendFriendRequest(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
    },
  });

  const removeFriendMutation = useMutation({
    mutationFn: () => api.relationships.removeFriend(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
    },
  });

  const blockMutation = useMutation({
    mutationFn: () => api.relationships.block(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
      queryClient.invalidateQueries({ queryKey: ['relationships', 'dms'] });
      setMoreMenuOpen(false);
    },
  });

  // ---------- Handlers ----------

  function handleMessage() {
    openDmMutation.mutate();
  }

  function handleFriendAction() {
    if (relationshipStatus === 'friend') {
      removeFriendMutation.mutate();
    } else {
      addFriendMutation.mutate();
    }
  }

  function handleBlock() {
    blockMutation.mutate();
  }

  function handleCopyUserId() {
    navigator.clipboard.writeText(userId);
    setMoreMenuOpen(false);
  }

  // ---------- Render ----------

  if (!userId) return null;

  const friendButtonLabel =
    relationshipStatus === 'friend'
      ? 'Remove Friend'
      : relationshipStatus === 'pending_incoming' || relationshipStatus === 'pending_outgoing'
        ? 'Pending'
        : 'Add Friend';

  const friendButtonDisabled =
    relationshipStatus === 'pending_incoming' ||
    relationshipStatus === 'pending_outgoing' ||
    addFriendMutation.isPending ||
    removeFriendMutation.isPending;

  return createPortal(
    <div className="full-profile-backdrop" onClick={closeModal}>
      <div
        className="full-profile-overlay"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Full profile"
      >
        {/* Close button */}
        <button
          type="button"
          className="full-profile-close"
          onClick={closeModal}
          aria-label="Close"
        >
          &times;
        </button>

        {/* Banner */}
        <div className="full-profile-banner" style={bannerStyle} />

        {/* Avatar + Names */}
        <div className="full-profile-body">
          <div className="full-profile-header">
            <div className="full-profile-avatar-wrap">
              <Avatar
                name={profile?.displayName ?? 'User'}
                hash={profile?.avatarHash}
                userId={userId}
                size={96}
                presenceStatus={status}
              />
            </div>
            <div className="full-profile-names">
              <h2 className="full-profile-display-name">
                {profile?.displayName ?? 'User'}
              </h2>
              <span className="full-profile-username">
                @{profile?.username ?? 'unknown'}
              </span>
              {profile?.pronouns && (
                <span className="full-profile-pronouns">{profile.pronouns}</span>
              )}
            </div>
          </div>

          {/* Bio */}
          {profile?.bio && (
            <div className="full-profile-bio">
              <p>{profile.bio}</p>
            </div>
          )}

          {/* Stats */}
          <div className="full-profile-stats">
            <div className="full-profile-stat">
              <span className="full-profile-stat-label">Member Since</span>
              <span className="full-profile-stat-value">{formatDate(profile?.createdAt)}</span>
            </div>
            <div className="full-profile-stat">
              <span className="full-profile-stat-label">Mutual Friends</span>
              <span className="full-profile-stat-value">{mutualFriendCount}</span>
            </div>
            <div className="full-profile-stat">
              <span className="full-profile-stat-label">Mutual Servers</span>
              <span className="full-profile-stat-value">{mutualServerCount}</span>
            </div>
          </div>

          {/* Actions */}
          {!isSelf && (
            <div className="full-profile-actions">
              <button
                type="button"
                className="full-profile-action-btn full-profile-action-message"
                onClick={handleMessage}
                disabled={openDmMutation.isPending}
              >
                {openDmMutation.isPending ? 'Opening...' : 'Message'}
              </button>

              <button
                type="button"
                className={`full-profile-action-btn ${
                  relationshipStatus === 'friend'
                    ? 'full-profile-action-remove-friend'
                    : 'full-profile-action-add-friend'
                }`}
                onClick={handleFriendAction}
                disabled={friendButtonDisabled}
              >
                {friendButtonLabel}
              </button>

              <div className="full-profile-more-wrap" ref={moreMenuRef}>
                <button
                  type="button"
                  className="full-profile-action-btn full-profile-action-more"
                  onClick={() => setMoreMenuOpen((v) => !v)}
                  aria-label="More actions"
                >
                  &#x22EF;
                </button>
                {moreMenuOpen && (
                  <div className="full-profile-more-menu">
                    <button
                      type="button"
                      className="full-profile-more-item full-profile-more-danger"
                      onClick={handleBlock}
                      disabled={blockMutation.isPending}
                    >
                      {blockMutation.isPending ? 'Blocking...' : 'Block'}
                    </button>
                    <button
                      type="button"
                      className="full-profile-more-item"
                      onClick={handleCopyUserId}
                    >
                      Copy User ID
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
