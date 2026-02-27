import React, { useState, useEffect, useMemo, useRef } from 'react';
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

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 1050,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.6)',
    animation: 'full-profile-fade-in 0.15s ease',
  } as React.CSSProperties,
  overlay: {
    position: 'relative',
    width: '100%',
    maxWidth: 600,
    maxHeight: '90vh',
    overflowY: 'auto',
    background: 'var(--bg-elevated, #1e1f22)',
    borderRadius: 'var(--radius-lg, 12px)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
    animation: 'full-profile-slide-up 0.2s ease',
  } as React.CSSProperties,
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 2,
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.4)',
    border: 'none',
    borderRadius: '50%',
    color: '#fff',
    fontSize: 20,
    lineHeight: 1,
    cursor: 'pointer',
    transition: 'background 0.15s ease',
  } as React.CSSProperties,
  closeBtnHover: {
    background: 'rgba(0, 0, 0, 0.6)',
  } as React.CSSProperties,
  banner: {
    width: '100%',
    height: 180,
    background: 'linear-gradient(135deg, var(--gratonite-purple, #5a4a7a) 0%, var(--gratonite-gold, #d4af37) 100%)',
    borderRadius: 'var(--radius-lg, 12px) var(--radius-lg, 12px) 0 0',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  } as React.CSSProperties,
  body: {
    padding: '0 24px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  } as React.CSSProperties,
  header: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 16,
    marginTop: -40,
  } as React.CSSProperties,
  avatarWrap: {
    flexShrink: 0,
    borderRadius: '50%',
    border: '4px solid var(--bg-elevated, #1e1f22)',
    background: 'var(--bg-elevated, #1e1f22)',
    lineHeight: 0,
  } as React.CSSProperties,
  names: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    paddingBottom: 4,
    minWidth: 0,
  } as React.CSSProperties,
  displayName: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--text-primary, #f2f3f5)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as React.CSSProperties,
  username: {
    fontSize: 14,
    color: 'var(--text-muted, #949ba4)',
  } as React.CSSProperties,
  pronouns: {
    fontSize: 13,
    color: 'var(--text-muted, #949ba4)',
  } as React.CSSProperties,
  bio: {
    fontSize: 14,
    lineHeight: 1.5,
    color: 'var(--text-primary, #f2f3f5)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  } as React.CSSProperties,
  bioP: {
    margin: 0,
  } as React.CSSProperties,
  statsRow: {
    display: 'flex',
    gap: 24,
    flexWrap: 'wrap',
  } as React.CSSProperties,
  stat: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  } as React.CSSProperties,
  statLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
    color: 'var(--text-muted, #949ba4)',
  } as React.CSSProperties,
  statValue: {
    fontSize: 14,
    color: 'var(--text-primary, #f2f3f5)',
  } as React.CSSProperties,
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  } as React.CSSProperties,
  actionBtn: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: 'var(--radius-md, 8px)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s ease, opacity 0.15s ease',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  actionMessage: {
    background: 'var(--gratonite-gold, #d4af37)',
    color: 'var(--text-on-gold, #1a1a2e)',
  } as React.CSSProperties,
  actionMessageHover: {
    background: 'var(--gratonite-gold-bright, #e8c547)',
  } as React.CSSProperties,
  actionAddFriend: {
    background: 'rgba(255, 255, 255, 0.08)',
    color: 'var(--text-primary, #f2f3f5)',
  } as React.CSSProperties,
  actionAddFriendHover: {
    background: 'rgba(255, 255, 255, 0.14)',
  } as React.CSSProperties,
  actionRemoveFriend: {
    background: 'rgba(255, 255, 255, 0.08)',
    color: 'var(--text-primary, #f2f3f5)',
  } as React.CSSProperties,
  actionRemoveFriendHover: {
    background: 'rgba(255, 255, 255, 0.14)',
  } as React.CSSProperties,
  actionMore: {
    width: 36,
    height: 36,
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255, 255, 255, 0.08)',
    color: 'var(--text-primary, #f2f3f5)',
    fontSize: 20,
    borderRadius: 'var(--radius-md, 8px)',
  } as React.CSSProperties,
  actionMoreHover: {
    background: 'rgba(255, 255, 255, 0.14)',
  } as React.CSSProperties,
  moreWrap: {
    position: 'relative',
  } as React.CSSProperties,
  moreMenu: {
    position: 'absolute',
    bottom: 'calc(100% + 6px)',
    right: 0,
    minWidth: 160,
    padding: 6,
    background: 'var(--bg-secondary, #111214)',
    borderRadius: 'var(--radius-md, 8px)',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  } as React.CSSProperties,
  moreItem: {
    width: '100%',
    padding: '8px 10px',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: 'var(--text-primary, #f2f3f5)',
    fontSize: 14,
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'background 0.1s ease',
  } as React.CSSProperties,
  moreItemHover: {
    background: 'rgba(255, 255, 255, 0.06)',
  } as React.CSSProperties,
  moreDanger: {
    color: 'var(--danger, #f23f43)',
  } as React.CSSProperties,
  moreDangerHover: {
    background: 'rgba(242, 63, 67, 0.12)',
  } as React.CSSProperties,
};

export function FullProfileOverlay() {
  const modalData = useUiStore((s) => s.modalData);
  const closeModal = useUiStore((s) => s.closeModal);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const userId = (modalData?.['userId'] as string) ?? '';
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Hover states
  const [closeHover, setCloseHover] = useState(false);
  const [messageHover, setMessageHover] = useState(false);
  const [friendHover, setFriendHover] = useState(false);
  const [moreHover, setMoreHover] = useState(false);
  const [blockHover, setBlockHover] = useState(false);
  const [copyIdHover, setCopyIdHover] = useState(false);

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

  const bannerExtraStyle: React.CSSProperties = profile?.bannerHash
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

  const friendBaseStyle =
    relationshipStatus === 'friend' ? styles.actionRemoveFriend : styles.actionAddFriend;
  const friendHoverStyle =
    relationshipStatus === 'friend' ? styles.actionRemoveFriendHover : styles.actionAddFriendHover;

  return createPortal(
    <div style={styles.backdrop} onClick={closeModal}>
      <div
        style={styles.overlay}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Full profile"
      >
        {/* Close button */}
        <button
          type="button"
          style={{
            ...styles.closeBtn,
            ...(closeHover ? styles.closeBtnHover : {}),
          }}
          onClick={closeModal}
          onMouseEnter={() => setCloseHover(true)}
          onMouseLeave={() => setCloseHover(false)}
          aria-label="Close"
        >
          &times;
        </button>

        {/* Banner */}
        <div style={{ ...styles.banner, ...bannerExtraStyle }} />

        {/* Avatar + Names */}
        <div style={styles.body}>
          <div style={styles.header}>
            <div style={styles.avatarWrap}>
              <Avatar
                name={profile?.displayName ?? 'User'}
                hash={profile?.avatarHash}
                userId={userId}
                size={96}
                presenceStatus={status}
              />
            </div>
            <div style={styles.names}>
              <h2 style={styles.displayName}>
                {profile?.displayName ?? 'User'}
              </h2>
              <span style={styles.username}>
                @{profile?.username ?? 'unknown'}
              </span>
              {profile?.pronouns && (
                <span style={styles.pronouns}>{profile.pronouns}</span>
              )}
            </div>
          </div>

          {/* Bio */}
          {profile?.bio && (
            <div style={styles.bio}>
              <p style={styles.bioP}>{profile.bio}</p>
            </div>
          )}

          {/* Stats */}
          <div style={styles.statsRow}>
            <div style={styles.stat}>
              <span style={styles.statLabel}>Member Since</span>
              <span style={styles.statValue}>{formatDate(profile?.createdAt)}</span>
            </div>
            <div style={styles.stat}>
              <span style={styles.statLabel}>Mutual Friends</span>
              <span style={styles.statValue}>{mutualFriendCount}</span>
            </div>
            <div style={styles.stat}>
              <span style={styles.statLabel}>Mutual Servers</span>
              <span style={styles.statValue}>{mutualServerCount}</span>
            </div>
          </div>

          {/* Actions */}
          {!isSelf && (
            <div style={styles.actions}>
              <button
                type="button"
                style={{
                  ...styles.actionBtn,
                  ...styles.actionMessage,
                  ...(messageHover ? styles.actionMessageHover : {}),
                }}
                onClick={handleMessage}
                onMouseEnter={() => setMessageHover(true)}
                onMouseLeave={() => setMessageHover(false)}
                disabled={openDmMutation.isPending}
              >
                {openDmMutation.isPending ? 'Opening...' : 'Message'}
              </button>

              <button
                type="button"
                style={{
                  ...styles.actionBtn,
                  ...friendBaseStyle,
                  ...(friendHover ? friendHoverStyle : {}),
                }}
                onClick={handleFriendAction}
                onMouseEnter={() => setFriendHover(true)}
                onMouseLeave={() => setFriendHover(false)}
                disabled={friendButtonDisabled}
              >
                {friendButtonLabel}
              </button>

              <div style={styles.moreWrap} ref={moreMenuRef}>
                <button
                  type="button"
                  style={{
                    ...styles.actionBtn,
                    ...styles.actionMore,
                    ...(moreHover ? styles.actionMoreHover : {}),
                  }}
                  onClick={() => setMoreMenuOpen((v) => !v)}
                  onMouseEnter={() => setMoreHover(true)}
                  onMouseLeave={() => setMoreHover(false)}
                  aria-label="More actions"
                >
                  &#x22EF;
                </button>
                {moreMenuOpen && (
                  <div style={styles.moreMenu}>
                    <button
                      type="button"
                      style={{
                        ...styles.moreItem,
                        ...styles.moreDanger,
                        ...(blockHover ? styles.moreDangerHover : {}),
                      }}
                      onClick={handleBlock}
                      onMouseEnter={() => setBlockHover(true)}
                      onMouseLeave={() => setBlockHover(false)}
                      disabled={blockMutation.isPending}
                    >
                      {blockMutation.isPending ? 'Blocking...' : 'Block'}
                    </button>
                    <button
                      type="button"
                      style={{
                        ...styles.moreItem,
                        ...(copyIdHover ? styles.moreItemHover : {}),
                      }}
                      onClick={handleCopyUserId}
                      onMouseEnter={() => setCopyIdHover(true)}
                      onMouseLeave={() => setCopyIdHover(false)}
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
