import { useState, CSSProperties } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

const S = {
  page: {
    display: 'flex',
    height: '100%',
    background: 'var(--bg)',
    color: 'var(--text)',
    overflow: 'hidden',
  },
  sidebar: {
    width: 260,
    minWidth: 260,
    background: 'var(--bg-elevated)',
    borderRight: '1px solid var(--stroke)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  sidebarHeader: {
    padding: '16px 16px 12px',
    borderBottom: '1px solid var(--stroke)',
  },
  sidebarTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text)',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  sidebarSection: {
    padding: '8px 16px 4px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
  },
  activeChannel: {
    margin: '6px 8px',
    padding: '8px 12px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-soft)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  activeChannelName: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--text)',
    flex: 1,
  },
  activeChannelIcon: {
    color: 'var(--accent)',
    fontSize: 16,
  },
  screensBadge: {
    background: 'var(--gold-subtle)',
    color: 'var(--accent)',
    borderRadius: 'var(--radius-pill)',
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 700,
  },
  participantList: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '4px 8px',
  },
  participantRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '6px 10px',
    borderRadius: 'var(--radius-md)',
    marginBottom: 2,
    background: 'var(--bg-soft)',
    cursor: 'pointer',
  },
  participantAvatar: {
    width: 28,
    height: 28,
    borderRadius: 'var(--radius-pill)',
    background: 'var(--bg-soft)',
    border: '1.5px solid var(--stroke)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
  },
  participantName: {
    fontSize: 13,
    color: 'var(--text)',
    flex: 1,
  },
  watchBadge: {
    background: 'var(--accent)',
    color: 'var(--text-on-gold)',
    borderRadius: 'var(--radius-pill)',
    padding: '2px 8px',
    fontSize: 10,
    fontWeight: 700,
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: '#0f1624',
    overflow: 'hidden',
  },
  topBar: {
    height: 52,
    padding: '0 20px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    flexShrink: 0,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--text)',
  },
  topBarBadge: {
    background: 'var(--gold-subtle)',
    border: '1px solid var(--border-gold)',
    color: 'var(--accent)',
    borderRadius: 'var(--radius-pill)',
    padding: '3px 10px',
    fontSize: 11,
    fontWeight: 700,
  },
  topBarSpacer: { flex: 1 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--stroke)',
    color: 'var(--text)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
  },
  viewerArea: {
    flex: 1,
    position: 'relative' as const,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainVideo: {
    width: '100%',
    height: '100%',
    background: '#1e1e2e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as const,
  },
  emptyScreen: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    color: 'var(--text-muted)',
  },
  userBadge: {
    position: 'absolute' as const,
    top: 16,
    left: 20,
    background: 'rgba(0,0,0,0.7)',
    color: 'var(--text)',
    borderRadius: 'var(--radius-pill)',
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  hdBadge: {
    position: 'absolute' as const,
    top: 16,
    right: 20,
    background: 'var(--gold-subtle)',
    color: 'var(--accent)',
    border: '1px solid var(--border-gold)',
    borderRadius: 'var(--radius-pill)',
    padding: '3px 8px',
    fontSize: 11,
    fontWeight: 700,
  },
  controlBar: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '0 20px',
  },
  controlBtn: {
    height: 36,
    padding: '0 16px',
    borderRadius: 'var(--radius-md)',
    background: 'rgba(255,255,255,0.12)',
    border: '1px solid rgba(255,255,255,0.15)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  controlBtnDanger: {
    height: 36,
    padding: '0 16px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--danger)',
    border: 'none',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  thumbnailRail: {
    height: 100,
    borderTop: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '0 16px',
    flexShrink: 0,
    overflowX: 'auto' as const,
  },
  thumbnailLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flexShrink: 0,
    paddingRight: 8,
  },
  thumbnailLabelTitle: {
    fontSize: 12,
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  thumbnailLabelHint: {
    fontSize: 11,
    color: 'var(--text-faint)',
  },
  thumbnail: {
    width: 140,
    height: 78,
    borderRadius: 'var(--radius-sm)',
    background: '#0d0d1a',
    flexShrink: 0,
    cursor: 'pointer',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-muted)',
    fontSize: 11,
    border: '1.5px solid transparent',
    transition: 'border-color 0.15s',
  },
  thumbnailActive: {
    width: 140,
    height: 78,
    borderRadius: 'var(--radius-sm)',
    background: '#0d0d1a',
    flexShrink: 0,
    cursor: 'pointer',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--accent)',
    fontSize: 11,
    border: '1.5px solid var(--accent)',
  },
};

const MOCK_PARTICIPANTS = [
  { id: '1', name: 'Sarah K.', isSharing: true, isWatching: false },
  { id: '2', name: 'Alex C.', isSharing: false, isWatching: true },
  { id: '3', name: 'Maya P.', isSharing: true, isWatching: false },
  { id: '4', name: 'Jordan L.', isSharing: false, isWatching: false },
  { id: '5', name: 'Quinn R.', isSharing: true, isWatching: false },
  { id: '6', name: 'Morgan T.', isSharing: false, isWatching: true },
];

export function MultiScreenSharePage() {
  const { guildId, channelId } = useParams<{ guildId: string; channelId: string }>();
  const navigate = useNavigate();
  const [activeScreen, setActiveScreen] = useState(0);
  const [isSharing, setIsSharing] = useState(false);

  const { data: channel } = useQuery({
    queryKey: ['channel', channelId],
    queryFn: () => api.channels.get(channelId!),
    enabled: !!channelId,
  });

  const sharingParticipants = MOCK_PARTICIPANTS.filter((p) => p.isSharing);

  async function startScreenShare() {
    try {
      await navigator.mediaDevices.getDisplayMedia({ video: true });
      setIsSharing(true);
    } catch {
      // User cancelled or not supported
    }
  }

  function stopScreenShare() {
    setIsSharing(false);
  }

  return (
    <div style={S.page}>
      {/* Sidebar */}
      <aside style={S.sidebar}>
        <div style={S.sidebarHeader}>
          <div style={S.sidebarTitle}>
            {channel?.name ?? 'Screen Share'} <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>›</span>
          </div>
        </div>

        <div style={S.sidebarSection}>Voice Channels</div>
        <div style={S.activeChannel}>
          <span style={S.activeChannelIcon}>🖥</span>
          <span style={S.activeChannelName}>{channel?.name ?? 'Design Review'}</span>
          <span style={S.screensBadge}>LIVE</span>
        </div>

        <div style={{ ...S.sidebarSection, marginTop: 8 }}>
          Sharing Screens ({sharingParticipants.length})
        </div>

        <div style={S.participantList}>
          {MOCK_PARTICIPANTS.map((p, i) => (
            <div
              key={p.id}
              style={S.participantRow}
              onClick={() => p.isSharing && setActiveScreen(sharingParticipants.findIndex((s) => s.id === p.id))}
            >
              <div style={S.participantAvatar}>{p.name[0]}</div>
              <span style={S.participantName}>{p.name}</span>
              {p.isWatching && <span style={S.watchBadge}>WATCH</span>}
              {p.isSharing && <span style={{ color: 'var(--accent)', fontSize: 14 }}>🖥</span>}
              {!p.isSharing && !p.isWatching && (
                <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>🎙</span>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* Main */}
      <div style={S.main}>
        {/* Top Bar */}
        <div style={S.topBar}>
          <span style={{ color: 'var(--accent)', fontSize: 18 }}>🖥</span>
          <span style={S.topBarTitle}>Screen Share Viewer</span>
          <span style={S.topBarBadge}>{sharingParticipants.length} Sharing</span>
          <div style={S.topBarSpacer} />
          <button style={S.iconBtn} title="Grid view" aria-label="Grid view">⊞</button>
          <button style={S.iconBtn} title="Picture-in-picture" aria-label="PiP">⧉</button>
        </div>

        {/* Viewer area */}
        <div style={S.viewerArea}>
          <div style={S.mainVideo}>
            {sharingParticipants.length === 0 ? (
              <div style={S.emptyScreen}>
                <span style={{ fontSize: 40 }}>🖥</span>
                <span style={{ fontSize: 16, fontWeight: 600 }}>No screens being shared</span>
                <button
                  style={{ ...S.controlBtn, background: 'var(--accent)', color: 'var(--text-on-gold)', border: 'none' }}
                  onClick={startScreenShare}
                >
                  Share Your Screen
                </button>
              </div>
            ) : (
              <>
                <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                  Viewing: {sharingParticipants[activeScreen]?.name ?? 'Unknown'}
                </div>
                <div style={S.userBadge}>
                  🔴 {sharingParticipants[activeScreen]?.name ?? 'User'}
                </div>
                <div style={S.hdBadge}>HD</div>
              </>
            )}

            {/* Control bar */}
            <div style={S.controlBar}>
              {isSharing ? (
                <button style={S.controlBtnDanger} onClick={stopScreenShare}>
                  ⏹ Stop Sharing
                </button>
              ) : (
                <button style={S.controlBtn} onClick={startScreenShare}>
                  🖥 Share Screen
                </button>
              )}
              <button style={S.controlBtn}>
                🎙 Mute
              </button>
              <div style={{ flex: 1 }} />
              <button
                style={S.controlBtnDanger}
                onClick={() => navigate(`/guild/${guildId}`)}
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>

        {/* Thumbnail Rail */}
        {sharingParticipants.length > 0 && (
          <div style={S.thumbnailRail}>
            <div style={S.thumbnailLabel}>
              <div style={S.thumbnailLabelTitle}>
                <span>🖥</span> Other Screens
              </div>
              <div style={S.thumbnailLabelHint}>Click to switch view</div>
              <div style={{ ...S.thumbnailLabelHint, marginTop: 4 }}>Sort: Recent</div>
            </div>
            {sharingParticipants.map((p, i) => (
              <div
                key={p.id}
                style={i === activeScreen ? S.thumbnailActive : S.thumbnail}
                onClick={() => setActiveScreen(i)}
                title={p.name}
              >
                {p.name[0]}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
