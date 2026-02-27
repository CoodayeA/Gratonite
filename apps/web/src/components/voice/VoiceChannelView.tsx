import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RoomEvent, Track, type RemoteTrack, type Track as LiveKitTrack, type TrackPublication, type RemoteParticipant } from 'livekit-client';
import { useCallStore } from '@/stores/call.store';
import { useVoiceStore } from '@/stores/voice.store';
import { useChannelsStore } from '@/stores/channels.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { joinVoiceChannel, leaveVoiceChannel, toggleMute, toggleVideo, toggleScreenShare, setAudioInputDevice, setVideoInputDevice } from '@/lib/dmCall';
import { api } from '@/lib/api';
import { getUserMediaWithFallback, mapMediaError } from '@/lib/media';
import { cacheSoundboardSounds, playSoundboardClip, resolveEntranceSoundIdForGuild } from '@/lib/soundboard';
import { readSoundboardPrefs, subscribeSoundboardPrefs, updateSoundboardPrefs } from '@/lib/soundboardPrefs';
import { MessageList } from '@/components/messages/MessageList';
import { MessageComposer } from '@/components/messages/MessageComposer';
import { TypingIndicator } from '@/components/messages/TypingIndicator';
import type { VoiceState } from '@gratonite/types';
import { useAuthStore } from '@/stores/auth.store';
import { SoundTrimmer } from '@/components/shop/SoundTrimmer';

const s = {
  view: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    padding: '18px 20px 24px',
    color: 'var(--text)',
  } as React.CSSProperties,

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  } as React.CSSProperties,

  headerPanel: {
    display: 'grid',
    gap: 2,
    padding: '10px 12px',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid color-mix(in srgb, var(--stroke) 88%, transparent)',
    background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent), rgba(10, 15, 26, 0.5)',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.02)',
  } as React.CSSProperties,

  titleRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  } as React.CSSProperties,

  title: {
    fontSize: 18,
    fontWeight: 700,
  } as React.CSSProperties,

  headerBadges: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  } as React.CSSProperties,

  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-pill)',
    border: '1px solid rgba(255,255,255,0.09)',
    background: 'rgba(255,255,255,0.03)',
    color: 'var(--text-faint)',
    padding: '3px 8px',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  } as React.CSSProperties,

  badgeLive: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-pill)',
    padding: '3px 8px',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--text)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(121, 223, 255, 0.22)',
    background: 'linear-gradient(135deg, rgba(121,223,255,0.12), rgba(138,123,255,0.1))',
  } as React.CSSProperties,

  subtitle: {
    fontSize: 12,
    color: 'var(--text-faint)',
  } as React.CSSProperties,

  subtleStatus: {
    fontSize: 11,
    color: 'var(--text-muted)',
    marginTop: 2,
  } as React.CSSProperties,

  chatToggle: {
    border: '1px solid color-mix(in srgb, var(--stroke) 88%, transparent)',
    background: 'rgba(8, 12, 20, 0.62)',
    color: 'var(--text)',
    padding: '8px 12px',
    borderRadius: 'var(--radius-lg)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  } as React.CSSProperties,

  body: {
    flex: 1,
    display: 'flex',
    gap: 14,
    minHeight: 0,
  } as React.CSSProperties,

  empty: {
    flex: 1,
    border: '1px solid rgba(163, 191, 239, 0.1)',
    borderRadius: 'var(--radius-xl)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    minHeight: 280,
    background: 'radial-gradient(circle at 78% 12%, rgba(138, 123, 255, 0.08), transparent 38%), radial-gradient(circle at 18% 8%, rgba(121, 223, 255, 0.06), transparent 34%), rgba(8, 12, 20, 0.56)',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.02), 0 14px 32px rgba(0, 0, 0, 0.14)',
  } as React.CSSProperties,

  participantsRail: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 7,
    width: 'min(560px, 100%)',
  } as React.CSSProperties,

  participantPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    borderRadius: 'var(--radius-pill)',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    color: 'var(--text)',
    padding: '5px 10px',
    maxWidth: '100%',
  } as React.CSSProperties,

  participantName: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text)',
    maxWidth: 180,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as React.CSSProperties,

  participantState: {
    fontSize: 11,
    color: 'var(--text-faint)',
  } as React.CSSProperties,

  participantPillMore: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    borderRadius: 'var(--radius-pill)',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    color: 'var(--text-muted)',
    padding: '5px 10px',
    maxWidth: '100%',
  } as React.CSSProperties,

  channelStatus: {
    color: 'var(--text-faint)',
    fontSize: 13,
  } as React.CSSProperties,

  presenceFeed: {
    display: 'grid',
    gap: 6,
    width: 'min(360px, 100%)',
  } as React.CSSProperties,

  presenceItem: {
    fontSize: 12,
    color: 'var(--text-muted)',
    border: '1px solid color-mix(in srgb, var(--stroke) 88%, transparent)',
    background: 'rgba(8, 12, 20, 0.52)',
    borderRadius: 'var(--radius-pill)',
    padding: '4px 10px',
  } as React.CSSProperties,

  error: {
    color: 'var(--danger)',
    fontSize: 12,
  } as React.CSSProperties,

  preflight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    maxWidth: 320,
    textAlign: 'center',
    padding: '10px 12px',
    borderRadius: 'var(--radius-lg)',
    background: 'rgba(6, 10, 18, 0.42)',
    border: '1px solid rgba(163, 191, 239, 0.08)',
  } as React.CSSProperties,

  preflightTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text)',
  } as React.CSSProperties,

  preflightSubtitle: {
    fontSize: 12,
    color: 'var(--text-faint)',
  } as React.CSSProperties,

  preflightError: {
    fontSize: 12,
    color: 'var(--danger)',
  } as React.CSSProperties,

  preflightBtn: {
    padding: '6px 12px',
    borderRadius: 'var(--radius-pill)',
    border: '1px solid rgba(212, 175, 55, 0.5)',
    background: 'rgba(212, 175, 55, 0.2)',
    color: 'var(--text)',
    fontSize: 12,
    cursor: 'pointer',
  } as React.CSSProperties,

  preflightSelects: {
    display: 'grid',
    gap: 8,
    width: '100%',
  } as React.CSSProperties,

  preflightLabel: {
    display: 'grid',
    gap: 4,
    fontSize: 11,
    color: 'var(--text-faint)',
    textAlign: 'left',
  } as React.CSSProperties,

  preflightSelect: {
    background: 'rgba(6, 10, 18, 0.6)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text)',
    fontSize: 12,
    padding: '6px 8px',
  } as React.CSSProperties,

  joinBtn: {
    padding: '9px 16px',
    background: 'linear-gradient(135deg, rgba(121, 223, 255, 0.18), rgba(138, 123, 255, 0.14))',
    border: '1px solid rgba(121, 223, 255, 0.4)',
    borderRadius: 'var(--radius-lg)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    boxShadow: '0 6px 20px rgba(212, 175, 55, 0.08)',
  } as React.CSSProperties,

  leaveBtn: {
    padding: '9px 16px',
    background: 'rgba(255, 99, 99, 0.2)',
    border: '1px solid rgba(255, 99, 99, 0.5)',
    borderRadius: 'var(--radius-lg)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  } as React.CSSProperties,

  chatPanel: {
    width: 360,
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid color-mix(in srgb, var(--stroke) 88%, transparent)',
    borderRadius: 'var(--radius-xl)',
    background: 'rgba(10, 15, 26, 0.48)',
    overflow: 'hidden',
    minHeight: 0,
  } as React.CSSProperties,

  controlDock: {
    position: 'absolute',
    left: '50%',
    bottom: 24,
    transform: 'translateX(-50%)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)), rgba(8, 12, 20, 0.84)',
    border: '1px solid color-mix(in srgb, var(--stroke) 88%, transparent)',
    borderRadius: 'var(--radius-xl)',
    boxShadow: '0 14px 36px rgba(0, 0, 0, 0.34)',
    backdropFilter: 'blur(16px) saturate(118%)',
    zIndex: 8,
  } as React.CSSProperties,

  controlGroup: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  } as React.CSSProperties,

  controlGroupTools: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 8,
    marginLeft: 2,
    borderLeft: '1px solid rgba(255,255,255,0.08)',
  } as React.CSSProperties,

  controlBtn: {
    border: '1px solid rgba(163, 191, 239, 0.1)',
    background: 'rgba(255, 255, 255, 0.04)',
    color: 'var(--text-muted)',
    padding: '7px 11px',
    borderRadius: 'var(--radius-lg)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as React.CSSProperties,

  controlBtnActive: {
    border: '1px solid rgba(212, 175, 55, 0.28)',
    background: 'rgba(212, 175, 55, 0.12)',
    color: 'var(--text)',
    padding: '7px 11px',
    borderRadius: 'var(--radius-lg)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as React.CSSProperties,

  controlBtnShareActive: {
    border: '1px solid rgba(121, 223, 255, 0.34)',
    background: 'linear-gradient(135deg, rgba(121, 223, 255, 0.14), rgba(138, 123, 255, 0.14))',
    color: 'var(--text)',
    padding: '7px 11px',
    borderRadius: 'var(--radius-lg)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as React.CSSProperties,

  controlBtnDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
  } as React.CSSProperties,

  devicesPopover: {
    position: 'absolute',
    bottom: 58,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(8, 12, 20, 0.96)',
    border: '1px solid color-mix(in srgb, var(--stroke) 88%, transparent)',
    borderRadius: 'var(--radius-lg)',
    padding: 10,
    display: 'grid',
    gap: 8,
    minWidth: 240,
    zIndex: 12,
  } as React.CSSProperties,

  devicesLabel: {
    display: 'grid',
    gap: 4,
    fontSize: 11,
    color: 'var(--text-faint)',
  } as React.CSSProperties,

  devicesSelect: {
    background: 'rgba(6, 10, 18, 0.6)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text)',
    fontSize: 12,
    padding: '6px 8px',
  } as React.CSSProperties,

  morePopover: {
    position: 'absolute',
    bottom: 58,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(8, 12, 20, 0.95)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-lg)',
    padding: '10px 12px',
    minWidth: 160,
    display: 'grid',
    gap: 6,
    zIndex: 12,
  } as React.CSSProperties,

  soundboardPopover: {
    position: 'absolute',
    bottom: 58,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(8, 12, 20, 0.97)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-lg)',
    padding: 10,
    minWidth: 280,
    maxWidth: 340,
    display: 'grid',
    gap: 8,
    zIndex: 12,
  } as React.CSSProperties,

  soundboardHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    fontSize: 12,
    color: 'var(--text)',
  } as React.CSSProperties,

  soundboardRefresh: {
    border: '1px solid var(--stroke)',
    background: 'rgba(255, 255, 255, 0.04)',
    color: 'var(--text-muted)',
    padding: '4px 8px',
    borderRadius: 'var(--radius-pill)',
    fontSize: 11,
    cursor: 'pointer',
  } as React.CSSProperties,

  soundboardList: {
    display: 'grid',
    gap: 6,
    maxHeight: 260,
    overflowY: 'auto',
  } as React.CSSProperties,

  soundboardItemWrap: {
    display: 'grid',
    gap: 5,
  } as React.CSSProperties,

  soundboardItem: {
    border: '1px solid var(--stroke)',
    background: 'rgba(255, 255, 255, 0.03)',
    color: 'var(--text)',
    borderRadius: 10,
    padding: '8px 10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    cursor: 'pointer',
  } as React.CSSProperties,

  soundboardItemFavorite: {
    border: '1px solid color-mix(in srgb, var(--accent) 36%, var(--stroke))',
    background: 'linear-gradient(135deg, rgba(121, 223, 255, 0.05), rgba(138, 123, 255, 0.04)), rgba(255,255,255,0.03)',
    color: 'var(--text)',
    borderRadius: 10,
    padding: '8px 10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    cursor: 'pointer',
  } as React.CSSProperties,

  soundboardItemName: {
    fontSize: 12,
    fontWeight: 600,
    textAlign: 'left',
  } as React.CSSProperties,

  soundboardItemMeta: {
    fontSize: 11,
    color: 'var(--text-faint)',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,

  soundboardActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  } as React.CSSProperties,

  soundboardMini: {
    border: '1px solid var(--stroke)',
    background: 'rgba(255, 255, 255, 0.03)',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-pill)',
    padding: '4px 8px',
    fontSize: 11,
    cursor: 'pointer',
  } as React.CSSProperties,

  soundboardMiniFav: {
    border: '1px solid var(--stroke)',
    background: 'rgba(255, 255, 255, 0.03)',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-pill)',
    padding: '4px 8px',
    fontSize: 11,
    cursor: 'pointer',
    minWidth: '2rem',
    textAlign: 'center',
  } as React.CSSProperties,

  soundboardMiniActive: {
    border: '1px solid color-mix(in srgb, var(--accent) 40%, var(--stroke))',
    background: 'rgba(212, 175, 55, 0.08)',
    color: 'var(--text)',
    borderRadius: 'var(--radius-pill)',
    padding: '4px 8px',
    fontSize: 11,
    cursor: 'pointer',
  } as React.CSSProperties,

  soundboardMiniActiveFav: {
    border: '1px solid color-mix(in srgb, var(--accent) 40%, var(--stroke))',
    background: 'rgba(212, 175, 55, 0.08)',
    color: 'var(--text)',
    borderRadius: 'var(--radius-pill)',
    padding: '4px 8px',
    fontSize: 11,
    cursor: 'pointer',
    minWidth: '2rem',
    textAlign: 'center',
  } as React.CSSProperties,

  soundboardMiniDanger: {
    border: '1px solid var(--stroke)',
    background: 'rgba(255, 255, 255, 0.03)',
    color: '#ffb4b4',
    borderRadius: 'var(--radius-pill)',
    padding: '4px 8px',
    fontSize: 11,
    cursor: 'pointer',
  } as React.CSSProperties,

  soundboardUpload: {
    borderTop: '1px solid var(--stroke)',
    paddingTop: 8,
    display: 'grid',
    gap: 6,
  } as React.CSSProperties,

  soundboardUploadRow: {
    display: 'flex',
    gap: 6,
  } as React.CSSProperties,

  soundboardNameInput: {
    flex: 1,
    minWidth: 0,
    border: '1px solid var(--stroke)',
    background: 'rgba(255,255,255,0.03)',
    color: 'var(--text)',
    borderRadius: 10,
    padding: '6px 8px',
    fontSize: 12,
  } as React.CSSProperties,

  soundboardEmpty: {
    fontSize: 12,
    color: 'var(--text-faint)',
    padding: '4px 2px',
  } as React.CSSProperties,

  soundboardError: {
    border: '1px solid rgba(255, 107, 107, 0.25)',
    background: 'rgba(255, 107, 107, 0.08)',
    color: '#ffd2d2',
    borderRadius: 'var(--radius-md)',
    padding: 8,
    fontSize: 12,
  } as React.CSSProperties,

  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    color: 'var(--text)',
  } as React.CSSProperties,

  mediaLayer: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
  } as React.CSSProperties,

  grid: {
    position: 'absolute',
    top: 80,
    left: 24,
    right: 24,
    bottom: 120,
    display: 'grid',
    gap: 12,
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    pointerEvents: 'none',
  } as React.CSSProperties,

  videoTile: {
    position: 'relative',
    background: 'radial-gradient(circle at 78% 14%, rgba(138, 123, 255, 0.08), transparent 42%), rgba(6, 10, 18, 0.72)',
    border: '1px solid rgba(163, 191, 239, 0.1)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    aspectRatio: '16 / 9',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
  } as React.CSSProperties,

  videoTileSelf: {
    position: 'relative',
    background: 'radial-gradient(circle at 78% 14%, rgba(138, 123, 255, 0.08), transparent 42%), rgba(6, 10, 18, 0.72)',
    border: '1px solid rgba(121, 223, 255, 0.18)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    aspectRatio: '16 / 9',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
  } as React.CSSProperties,

  videoTileScreen: {
    position: 'relative',
    background: 'radial-gradient(circle at 78% 14%, rgba(138, 123, 255, 0.08), transparent 42%), rgba(6, 10, 18, 0.72)',
    border: '1px solid rgba(121, 223, 255, 0.28)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    aspectRatio: '16 / 9',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 0 0 1px rgba(121, 223, 255, 0.06), 0 0 0 4px rgba(121, 223, 255, 0.03)',
  } as React.CSSProperties,

  videoTilePending: {
    position: 'relative',
    background: 'linear-gradient(135deg, rgba(121, 223, 255, 0.05), rgba(138, 123, 255, 0.05)), rgba(6, 10, 18, 0.72)',
    border: '1px dashed rgba(163, 191, 239, 0.1)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    aspectRatio: '16 / 9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,

  videoElement: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  } as React.CSSProperties,

  videoLabel: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    fontSize: 11,
    color: 'var(--text)',
    background: 'rgba(3, 6, 12, 0.58)',
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '4px 8px',
    borderRadius: 'var(--radius-pill)',
    backdropFilter: 'blur(8px)',
  } as React.CSSProperties,

  videoLabelScreen: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    fontSize: 11,
    color: 'var(--text)',
    background: 'linear-gradient(135deg, rgba(121, 223, 255, 0.18), rgba(138, 123, 255, 0.18)), rgba(3,6,12,0.58)',
    border: '1px solid rgba(121,223,255,0.22)',
    padding: '4px 8px',
    borderRadius: 'var(--radius-pill)',
    backdropFilter: 'blur(8px)',
  } as React.CSSProperties,
};

interface VoiceChannelViewProps {
  channelId: string;
  channelName: string;
}

const EMPTY_STATES: VoiceState[] = [];

export function VoiceChannelView({ channelId, channelName }: VoiceChannelViewProps) {
  const callStatus = useCallStore((s) => s.status);
  const callChannelId = useCallStore((s) => s.channelId);
  const callError = useCallStore((s) => s.error);
  const muted = useCallStore((s) => s.muted);
  const videoEnabled = useCallStore((s) => s.videoEnabled);
  const screenShareEnabled = useCallStore((s) => s.screenShareEnabled);
  const room = useCallStore((s) => s.room);
  const localVideoTrack = useCallStore((s) => s.localVideoTrack);
  const localScreenTrack = useCallStore((s) => s.localScreenTrack);
  const states = useVoiceStore((s) => s.statesByChannel.get(channelId) ?? EMPTY_STATES);
  const updateVoiceState = useVoiceStore((s) => s.updateVoiceState);
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const channel = useChannelsStore((s) => s.channels.get(channelId));
  const guildId = channel?.guildId ?? null;
  const guild = useGuildsStore((s) => (guildId ? s.guilds.get(guildId) : undefined));

  const [showChat, setShowChat] = useState(false);
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [gridView, setGridView] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const [soundboardOpen, setSoundboardOpen] = useState(false);
  const [soundboardLoading, setSoundboardLoading] = useState(false);
  const [soundboardError, setSoundboardError] = useState('');
  const [playingSoundId, setPlayingSoundId] = useState<string | null>(null);
  const [soundboardSounds, setSoundboardSounds] = useState<Array<{
    id: string;
    name: string;
    soundHash: string;
    volume: number;
    emojiName?: string | null;
    uploaderId?: string;
  }>>([]);
  const [uploadingSound, setUploadingSound] = useState(false);
  const [newSoundName, setNewSoundName] = useState('');
  const [trimPendingFile, setTrimPendingFile] = useState<File | null>(null);
  const [trimAudioUrl, setTrimAudioUrl] = useState('');
  const [trimDuration, setTrimDuration] = useState(0);
  const [soundboardFavorites, setSoundboardFavorites] = useState<string[]>(() => readSoundboardPrefs().favorites);
  const [purchasedSounds, setPurchasedSounds] = useState<Array<{
    itemId: string;
    name: string;
    assetHash: string | null;
    metadata?: Record<string, any>;
  }>>([]);
  const soundUploadInputRef = useRef<HTMLInputElement>(null);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState('');
  const [selectedCamera, setSelectedCamera] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState('');
  const [preflightError, setPreflightError] = useState('');
  const [preflightStatus, setPreflightStatus] = useState<'unknown' | 'ready' | 'blocked'>('unknown');
  const [remoteTracks, setRemoteTracks] = useState<
    Array<{ id: string; track: RemoteTrack; kind: 'video' | 'audio'; source: string; participantLabel: string }>
  >([]);
  const [presenceEvents, setPresenceEvents] = useState<Array<{ id: string; text: string; ts: number }>>([]);
  const previousIdsRef = useRef<Set<string>>(new Set());
  const attemptedAutoJoinRef = useRef<string | null>(null);

  const isConnected = callStatus === 'connected' && callChannelId === channelId;
  const isConnecting = callStatus === 'connecting' && callChannelId === channelId;
  const hasActiveRoom = Boolean(room);
  const voiceCount = states.length;
  const hasAudioInput = audioInputs.length > 0;
  const hasDevices = hasAudioInput || videoInputs.length > 0;
  const entranceSoundId = resolveEntranceSoundIdForGuild(guildId);
  const voiceUserIds = useMemo(() => Array.from(new Set(states.map((state) => String(state.userId)))), [states]);

  const { data: voiceUserSummaries = [] } = useQuery({
    queryKey: ['voice-channel-users', channelId, voiceUserIds],
    queryFn: () => api.users.getSummaries(voiceUserIds),
    enabled: voiceUserIds.length > 0,
    staleTime: 15_000,
  });

  const voiceUserLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    voiceUserSummaries.forEach((u) => {
      map.set(String(u.id), u.displayName || u.username);
    });
    return map;
  }, [voiceUserSummaries]);

  useEffect(() => {
    api.voice.getChannelStates(channelId)
      .then((list) => {
        list.forEach((state: VoiceState) => updateVoiceState(state));
      })
      .catch(() => undefined);
  }, [channelId, updateVoiceState]);

  useEffect(() => {
    if (!room) return;
    function handleSubscribed(track: RemoteTrack, publication: TrackPublication, participant: RemoteParticipant) {
      const trackId = track.sid;
      if (!trackId) return;
      const kind = track.kind === Track.Kind.Video ? 'video' : 'audio';
      const source = String((publication as any).source ?? 'unknown');
      const rawIdentity = participant.identity || 'User';
      const participantLabel = rawIdentity.length > 18 ? `${rawIdentity.slice(0, 18)}\u2026` : rawIdentity;
      setRemoteTracks((prev) => {
        if (prev.some((t) => t.id === trackId)) return prev;
        return [...prev, { id: trackId, track, kind, source, participantLabel }];
      });
    }

    function handleUnsubscribed(track: RemoteTrack) {
      const trackId = track.sid;
      if (!trackId) return;
      setRemoteTracks((prev) => prev.filter((t) => t.id !== trackId));
    }

    room.on(RoomEvent.TrackSubscribed, handleSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, handleUnsubscribed);
    return () => {
      room.off(RoomEvent.TrackSubscribed, handleSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, handleUnsubscribed);
      setRemoteTracks([]);
    };
  }, [room]);

  const loadDevices = useCallback(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const nextAudioInputs = devices.filter((d) => d.kind === 'audioinput');
    const nextVideoInputs = devices.filter((d) => d.kind === 'videoinput');
    const nextAudioOutputs = devices.filter((d) => d.kind === 'audiooutput');
    setAudioInputs(nextAudioInputs);
    setVideoInputs(nextVideoInputs);
    setAudioOutputs(nextAudioOutputs);
    if (nextAudioInputs.length > 0 || nextVideoInputs.length > 0) {
      setPreflightStatus('ready');
    }
    return { nextAudioInputs, nextVideoInputs, nextAudioOutputs };
  }, []);

  useEffect(() => {
    loadDevices();
    navigator.mediaDevices.addEventListener('devicechange', loadDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
  }, [loadDevices]);

  const requestDeviceAccess = useCallback(async () => {
    setPreflightError('');
    let audioGranted = false;
    try {
      const audioStream = await getUserMediaWithFallback([
        { audio: true, video: false },
      ]);
      audioStream.getTracks().forEach((track) => track.stop());
      audioGranted = true;

      // Camera is optional for voice-channel join; best-effort prompt so labels populate.
      try {
        const videoStream = await getUserMediaWithFallback([
          { audio: false, video: true },
        ]);
        videoStream.getTracks().forEach((track) => track.stop());
      } catch {
        // Non-blocking: microphone readiness is sufficient for voice join.
      }
    } catch (err: any) {
      setPreflightError(mapMediaError(err));
    }

    const { nextAudioInputs } = await loadDevices();
    if (audioGranted || nextAudioInputs.length > 0) {
      setPreflightStatus('ready');
      return true;
    }
    setPreflightStatus('blocked');
    return false;
  }, [loadDevices]);

  useEffect(() => {
    if (!selectedMic && audioInputs.length > 0) {
      setSelectedMic(audioInputs[0]!.deviceId);
    }
    if (!selectedCamera && videoInputs.length > 0) {
      setSelectedCamera(videoInputs[0]!.deviceId);
    }
    if (!selectedSpeaker && audioOutputs.length > 0) {
      setSelectedSpeaker(audioOutputs[0]!.deviceId);
    }
  }, [audioInputs, videoInputs, audioOutputs, selectedMic, selectedCamera, selectedSpeaker]);

  const handleJoin = useCallback(async () => {
    if (isConnected || isConnecting) return;
    await joinVoiceChannel(channelId);
    if (!hasAudioInput || preflightStatus !== 'ready') {
      requestDeviceAccess().catch(() => undefined);
    }
  }, [channelId, hasAudioInput, preflightStatus, requestDeviceAccess, isConnected, isConnecting]);

  useEffect(() => {
    if (attemptedAutoJoinRef.current === channelId) return;
    attemptedAutoJoinRef.current = channelId;
    handleJoin().catch(() => undefined);
  }, [channelId, handleJoin]);

  useEffect(() => {
    if (!isConnected) {
      setDevicesOpen(false);
      setMoreOpen(false);
      setSoundboardOpen(false);
    }
  }, [isConnected]);

  useEffect(() => {
    if (!isConnected || (!devicesOpen && !moreOpen && !soundboardOpen)) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-voice-popover]') || target.closest('[data-voice-control-btn]')) return;
      setDevicesOpen(false);
      setMoreOpen(false);
      setSoundboardOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [devicesOpen, isConnected, moreOpen, soundboardOpen]);

  const loadSoundboard = useCallback(async () => {
    if (!guildId) return;
    setSoundboardLoading(true);
    setSoundboardError('');
    try {
      const sounds = await api.voice.getSoundboard(guildId);
      const normalized = sounds
        .filter((sound) => sound.available !== false)
        .map((sound) => ({
          id: sound.id,
          name: sound.name,
          soundHash: sound.soundHash,
          volume: sound.volume,
          emojiName: sound.emojiName ?? null,
          uploaderId: sound.uploaderId,
        }));
      setSoundboardSounds(normalized);
      cacheSoundboardSounds(guildId, normalized.map((sound) => ({ ...sound, guildId })));
    } catch (err) {
      setSoundboardError(err instanceof Error ? err.message : 'Failed to load soundboard');
    } finally {
      setSoundboardLoading(false);
    }
  }, [guildId]);

  const loadPurchasedSounds = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/shop/inventory', { credentials: 'include' });
      if (!res.ok) return;
      const raw = await res.json();
      const data = Array.isArray(raw) ? raw : [];
      const sounds = data
        .filter((entry: any) => entry.item?.type === 'soundboard_sound' && entry.item?.assetHash)
        .map((entry: any) => ({
          itemId: entry.itemId,
          name: entry.item.name,
          assetHash: entry.item.assetHash,
          metadata: entry.metadata,
        }));
      setPurchasedSounds(sounds);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    if (!soundboardOpen) return;
    loadSoundboard().catch(() => undefined);
    loadPurchasedSounds().catch(() => undefined);
  }, [soundboardOpen, loadSoundboard, loadPurchasedSounds]);

  useEffect(() => subscribeSoundboardPrefs((prefs) => setSoundboardFavorites(prefs.favorites)), []);

  async function handleUploadSound(file: File) {
    if (!guildId) return;
    setUploadingSound(true);
    setSoundboardError('');
    try {
      const upload = await api.files.upload(file, 'upload');
      const soundHash = (() => {
        try {
          const url = new URL(upload.url, window.location.origin);
          return decodeURIComponent(url.pathname.split('/').pop() ?? '');
        } catch {
          return '';
        }
      })();
      if (!soundHash) throw new Error('Unable to resolve sound hash from upload');
      const fallbackName = file.name.replace(/\.[^.]+$/, '').slice(0, 32) || 'Sound';
      await api.voice.createSoundboard(guildId, {
        name: (newSoundName.trim() || fallbackName).slice(0, 32),
        soundHash,
        volume: 1,
      });
      setNewSoundName('');
      await loadSoundboard();
    } catch (err) {
      setSoundboardError(err instanceof Error ? err.message : 'Failed to upload sound');
    } finally {
      setUploadingSound(false);
      if (soundUploadInputRef.current) soundUploadInputRef.current.value = '';
    }
  }

  useEffect(() => {
    if (!isConnected || !guildId || !entranceSoundId) return;
    const sound = soundboardSounds.find((sb) => sb.id === entranceSoundId);
    if (!sound) return;
    const timer = window.setTimeout(() => {
      api.voice.playSoundboard(guildId, entranceSoundId).catch(() => undefined);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [isConnected, guildId, entranceSoundId, soundboardSounds]);

  const voiceStatesLabel = useMemo(() => {
    if (voiceCount === 0) return 'No one is currently in voice.';
    if (voiceCount === 1) return '1 person in voice.';
    return `${voiceCount} people in voice.`;
  }, [voiceCount]);

  const orderedSoundboardSounds = useMemo(() => {
    const favoriteSet = new Set(soundboardFavorites);
    return [...soundboardSounds].sort((a, b) => {
      const aFav = favoriteSet.has(a.id) ? 1 : 0;
      const bFav = favoriteSet.has(b.id) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
      return String(a.name).localeCompare(String(b.name));
    });
  }, [soundboardFavorites, soundboardSounds]);

  const voiceParticipants = useMemo(
    () => states.map((state) => ({
      userId: String(state.userId),
      label: voiceUserLabelMap.get(String(state.userId)) ?? `User ${String(state.userId).slice(-4)}`,
      muted: Boolean((state as any).mute ?? (state as any).selfMute),
      deafened: Boolean((state as any).deaf ?? (state as any).selfDeaf),
      camera: Boolean((state as any).selfVideo),
      streaming: Boolean((state as any).selfStream),
    })),
    [states, voiceUserLabelMap],
  );

  const roomStatusLabel = useMemo(() => {
    if (isConnected) return 'Connected silently';
    if (isConnecting) return 'Joining room...';
    if (callError && callChannelId === channelId) return 'Connection failed';
    return 'Not connected';
  }, [isConnected, isConnecting, callError, callChannelId, channelId]);

  // Detect join/leave events
  useEffect(() => {
    const nextIds = new Set(states.map((state) => String(state.userId)));
    const prevIds = previousIdsRef.current;
    if (prevIds.size > 0) {
      const now = Date.now();
      const newEntries: Array<{ userId: string; id: string; text: string; ts: number }> = [];
      nextIds.forEach((id) => {
        if (!prevIds.has(id)) {
          newEntries.push({
            userId: id,
            id: `join-${id}`,
            text: id === currentUserId ? 'You entered the room' : `${voiceUserLabelMap.get(id) ?? `User ${id.slice(-4)}`} joined`,
            ts: now,
          });
        }
      });
      prevIds.forEach((id) => {
        if (!nextIds.has(id)) {
          newEntries.push({
            userId: id,
            id: `left-${id}`,
            text: id === currentUserId ? 'You left the room' : `${voiceUserLabelMap.get(id) ?? `User ${id.slice(-4)}`} left`,
            ts: now,
          });
        }
      });

      if (newEntries.length > 0) {
        setPresenceEvents((prev) => {
          const byUser = new Map(prev.map((e) => [e.id.replace(/^(join|left)-/, ''), e]));
          newEntries.forEach((e) => byUser.set(e.userId, { id: e.id, text: e.text, ts: e.ts }));
          return Array.from(byUser.values()).slice(0, 3);
        });
      }
    }
    previousIdsRef.current = nextIds;
  }, [states, currentUserId, voiceUserLabelMap]);

  // Prune expired presence events every second
  useEffect(() => {
    const interval = window.setInterval(() => {
      setPresenceEvents((prev) => {
        const now = Date.now();
        const alive = prev.filter((e) => now - e.ts < 4000);
        return alive.length === prev.length ? prev : alive;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div style={s.view}>
      <div style={s.header}>
        <div style={s.headerPanel}>
          <div style={s.titleRow}>
            <div style={s.title}>Chat Room</div>
            <div style={s.headerBadges}>
              <span style={s.badgeLive}>Live</span>
              <span style={s.badge}>{voiceCount} in room</span>
            </div>
          </div>
          <div style={s.subtitle}>{channelName}</div>
          <div style={s.subtleStatus}>{roomStatusLabel}</div>
        </div>
        <button style={s.chatToggle} onClick={() => setShowChat((prev) => !prev)}>
          {showChat ? 'Hide Chat' : 'Open Chat'}
        </button>
      </div>

      <div style={s.body}>
        <div style={s.empty}>
          {voiceParticipants.length > 0 && (
            <div style={s.participantsRail} aria-label="People in this room">
              {voiceParticipants.slice(0, 8).map((participant) => (
                <div key={participant.userId} style={s.participantPill}>
                  <span style={s.participantName}>{participant.label}</span>
                  <span style={s.participantState} aria-hidden="true">
                    {participant.streaming ? '\uD83D\uDDA5' : participant.camera ? '\uD83D\uDCF7' : participant.deafened ? '\uD83D\uDD07' : participant.muted ? '\uD83C\uDF99' : '\u2022'}
                  </span>
                </div>
              ))}
              {voiceParticipants.length > 8 && (
                <div style={s.participantPillMore}>
                  +{voiceParticipants.length - 8} more
                </div>
              )}
            </div>
          )}
          <div style={s.channelStatus}>{voiceStatesLabel}</div>
          {presenceEvents.length > 0 && (
            <div style={s.presenceFeed} aria-live="polite">
              {presenceEvents.map((entry) => (
                <div key={entry.id} style={s.presenceItem}>{entry.text}</div>
              ))}
            </div>
          )}
          {callError && callChannelId === channelId && (
            <div style={s.error}>{callError}</div>
          )}
          {!isConnected && (preflightStatus !== 'ready' || !hasDevices) && (
            <div style={s.preflight}>
              <div style={s.preflightTitle}>Microphone optional</div>
              <div style={s.preflightSubtitle}>
                {preflightStatus === 'blocked'
                  ? 'Join works in listen-only mode. Allow microphone permission when you want to speak.'
                  : 'You can join now and enable mic/camera after entering the room.'}
              </div>
              {preflightError && <div style={s.preflightError}>{preflightError}</div>}
              <button style={s.preflightBtn} onClick={requestDeviceAccess}>
                Enable Mic/Camera
              </button>
              {preflightStatus === 'ready' && hasDevices && (
                <div style={s.preflightSelects}>
                  <label style={s.preflightLabel}>
                    Mic
                    <select
                      style={s.preflightSelect}
                      value={selectedMic}
                      onChange={(e) => {
                        setSelectedMic(e.target.value);
                        setAudioInputDevice(e.target.value);
                      }}
                    >
                      <option value="">Default</option>
                      {audioInputs.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>{device.label || 'Microphone'}</option>
                      ))}
                    </select>
                  </label>
                  <label style={s.preflightLabel}>
                    Camera
                    <select
                      style={s.preflightSelect}
                      value={selectedCamera}
                      onChange={(e) => {
                        setSelectedCamera(e.target.value);
                        setVideoInputDevice(e.target.value);
                      }}
                    >
                      <option value="">Default</option>
                      {videoInputs.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>{device.label || 'Camera'}</option>
                      ))}
                    </select>
                  </label>
                  <label style={s.preflightLabel}>
                    Speaker
                    <select
                      style={s.preflightSelect}
                      value={selectedSpeaker}
                      onChange={(e) => setSelectedSpeaker(e.target.value)}
                    >
                      <option value="">Default</option>
                      {audioOutputs.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>{device.label || 'Speaker'}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>
          )}
          {!isConnected ? (
            <button style={s.joinBtn} onClick={handleJoin} disabled={isConnecting}>
              {isConnecting ? 'Connecting\u2026' : 'Join Room Silently'}
            </button>
          ) : (
            <button style={s.leaveBtn} onClick={() => leaveVoiceChannel()}>
              Leave Call
            </button>
          )}
        </div>

        {showChat && (
          <div style={s.chatPanel}>
            <MessageList
              channelId={channelId}
              emptyTitle="No messages in this voice chat"
              emptySubtitle="Say hello while you wait."
              onReply={() => undefined}
              onOpenEmojiPicker={() => undefined}
              hideIntroEmpty
            />
            <TypingIndicator channelId={channelId} />
            <MessageComposer
              channelId={channelId}
              placeholder={`Message #${channelName}`}
            />
          </div>
        )}
      </div>

      {isConnected && (
        <div style={s.controlDock}>
          <div style={s.controlGroup}>
            <button
              data-voice-control-btn
              style={{
                ...(muted ? s.controlBtnActive : s.controlBtn),
                ...((!hasActiveRoom) ? s.controlBtnDisabled : {}),
              }}
              onClick={() => toggleMute()}
              aria-pressed={muted}
              disabled={!hasActiveRoom}
              title={!hasActiveRoom ? 'Connecting voice room...' : muted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {muted ? 'Unmute' : 'Mute'}
            </button>
            <button
              data-voice-control-btn
              style={{
                ...(videoEnabled ? s.controlBtnActive : s.controlBtn),
                ...((!hasActiveRoom) ? s.controlBtnDisabled : {}),
              }}
              onClick={() => toggleVideo()}
              aria-pressed={videoEnabled}
              disabled={!hasActiveRoom}
              title={!hasActiveRoom ? 'Join must complete before enabling camera' : videoEnabled ? 'Turn camera off' : 'Turn camera on'}
            >
              {videoEnabled ? 'Stop Video' : 'Camera'}
            </button>
            <button
              data-voice-control-btn
              style={{
                ...(screenShareEnabled ? s.controlBtnShareActive : s.controlBtn),
                ...((!hasActiveRoom) ? s.controlBtnDisabled : {}),
              }}
              onClick={() => toggleScreenShare()}
              aria-pressed={screenShareEnabled}
              disabled={!hasActiveRoom}
              title={!hasActiveRoom ? 'Join must complete before screen sharing' : screenShareEnabled ? 'Stop sharing your screen' : 'Start sharing your screen'}
            >
              {screenShareEnabled ? 'Stop Share' : 'Share Screen'}
            </button>
          </div>
          <div style={s.controlGroupTools}>
            <button
              data-voice-control-btn
              style={{
                ...s.controlBtn,
                ...((!hasActiveRoom || !guildId) ? s.controlBtnDisabled : {}),
              }}
              onClick={() => {
                setSoundboardOpen((prev) => !prev);
                setDevicesOpen(false);
                setMoreOpen(false);
              }}
              aria-expanded={soundboardOpen}
              disabled={!hasActiveRoom || !guildId}
              title={!guildId ? 'Soundboard is available in server voice channels' : 'Open soundboard'}
            >
              Soundboard &#9662;
            </button>
            <button
              data-voice-control-btn
              style={{
                ...s.controlBtn,
                ...((!hasActiveRoom) ? s.controlBtnDisabled : {}),
              }}
              onClick={() => setDevicesOpen((prev) => !prev)}
              aria-expanded={devicesOpen}
              disabled={!hasActiveRoom}
            >
              Devices &#9662;
            </button>
            <button
              data-voice-control-btn
              style={{
                ...s.controlBtn,
                ...((!hasActiveRoom) ? s.controlBtnDisabled : {}),
              }}
              onClick={() => setMoreOpen((prev) => !prev)}
              aria-expanded={moreOpen}
              disabled={!hasActiveRoom}
            >
              More &#9662;
            </button>
          </div>

          {devicesOpen && (
            <div data-voice-popover style={s.devicesPopover}>
              <label style={s.devicesLabel}>
                Mic
                <select
                  style={s.devicesSelect}
                  value={selectedMic}
                  onChange={(e) => {
                    setSelectedMic(e.target.value);
                    setAudioInputDevice(e.target.value);
                  }}
                >
                  <option value="">Default</option>
                  {audioInputs.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>{device.label || 'Microphone'}</option>
                  ))}
                </select>
              </label>
              <label style={s.devicesLabel}>
                Speaker
                <select
                  style={s.devicesSelect}
                  value={selectedSpeaker}
                  onChange={(e) => setSelectedSpeaker(e.target.value)}
                >
                  <option value="">Default</option>
                  {audioOutputs.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>{device.label || 'Speaker'}</option>
                  ))}
                </select>
              </label>
              <label style={s.devicesLabel}>
                Camera
                <select
                  style={s.devicesSelect}
                  value={selectedCamera}
                  onChange={(e) => {
                    setSelectedCamera(e.target.value);
                    setVideoInputDevice(e.target.value);
                  }}
                >
                  <option value="">Default</option>
                  {videoInputs.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>{device.label || 'Camera'}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {soundboardOpen && (
            <div data-voice-popover style={s.soundboardPopover}>
              <div style={s.soundboardHead}>
                <strong>Soundboard</strong>
                <button type="button" style={s.soundboardRefresh} onClick={() => loadSoundboard().catch(() => undefined)}>
                  Refresh
                </button>
              </div>
              {soundboardLoading ? (
                <div style={s.soundboardEmpty}>Loading sounds...</div>
              ) : soundboardError ? (
                <div style={s.soundboardError}>{soundboardError}</div>
              ) : soundboardSounds.length === 0 ? (
                <div style={s.soundboardEmpty}>No sounds configured for this server yet.</div>
              ) : (
                <div style={s.soundboardList}>
                  {orderedSoundboardSounds.slice(0, 24).map((sound) => {
                    const isFav = soundboardFavorites.includes(sound.id);
                    return (
                      <div key={sound.id} style={s.soundboardItemWrap}>
                        <button
                          type="button"
                          style={isFav ? s.soundboardItemFavorite : s.soundboardItem}
                          disabled={playingSoundId === sound.id}
                          onClick={async () => {
                            if (!guildId) return;
                            setPlayingSoundId(sound.id);
                            setSoundboardError('');
                            try {
                              await api.voice.playSoundboard(guildId, sound.id);
                            } catch (err) {
                              setSoundboardError(err instanceof Error ? err.message : 'Failed to play sound');
                            } finally {
                              setPlayingSoundId(null);
                            }
                          }}
                        >
                          <span style={s.soundboardItemName as React.CSSProperties}>
                            {sound.emojiName ? `${sound.emojiName} ` : ''}{sound.name}
                          </span>
                          <span style={s.soundboardItemMeta as React.CSSProperties}>
                            {playingSoundId === sound.id ? 'Playing...' : `${Math.round((sound.volume ?? 1) * 100)}%`}
                          </span>
                        </button>
                        <div style={s.soundboardActions}>
                          <button
                            type="button"
                            style={isFav ? s.soundboardMiniActiveFav : s.soundboardMiniFav}
                            onClick={() =>
                              updateSoundboardPrefs((current) => {
                                const exists = current.favorites.includes(sound.id);
                                return {
                                  ...current,
                                  favorites: exists
                                    ? current.favorites.filter((id) => id !== sound.id)
                                    : [sound.id, ...current.favorites].slice(0, 100),
                                };
                              })
                            }
                            title={isFav ? 'Remove favorite' : 'Favorite sound'}
                          >
                            {isFav ? '\u2605' : '\u2606'}
                          </button>
                          <button
                            type="button"
                            style={s.soundboardMini}
                            onClick={() => playSoundboardClip(sound)}
                          >
                            Preview
                          </button>
                          <button
                            type="button"
                            style={entranceSoundId === sound.id ? s.soundboardMiniActive : s.soundboardMini}
                            onClick={() => {
                              if (!guildId) return;
                              updateSoundboardPrefs((current) => ({
                                ...current,
                                entranceByGuild: {
                                  ...current.entranceByGuild,
                                  [guildId]: current.entranceByGuild[guildId] === sound.id ? null : sound.id,
                                },
                              }));
                            }}
                          >
                            {entranceSoundId === sound.id ? 'Entrance \u2713' : 'Entrance'}
                          </button>
                          {currentUserId && (sound.uploaderId === currentUserId || guild?.ownerId === currentUserId) && (
                            <button
                              type="button"
                              style={s.soundboardMiniDanger}
                              onClick={async () => {
                                if (!guildId) return;
                                try {
                                  await api.voice.deleteSoundboard(guildId, sound.id);
                                  await loadSoundboard();
                                } catch (err) {
                                  setSoundboardError(err instanceof Error ? err.message : 'Failed to delete sound');
                                }
                              }}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {purchasedSounds.length > 0 && (
                <>
                  <div style={{ ...s.soundboardHead, marginTop: 8 }}>
                    <strong>My Sounds</strong>
                  </div>
                  <div style={s.soundboardList}>
                    {purchasedSounds.map((ps) => (
                      <div key={ps.itemId} style={s.soundboardItemWrap}>
                        <button
                          type="button"
                          style={s.soundboardItem}
                          onClick={() => {
                            if (!ps.assetHash) return;
                            const trimStart = ps.metadata?.['trimStartMs'] ?? 0;
                            const trimEnd = ps.metadata?.['trimEndMs'];
                            playSoundboardClip({ soundHash: ps.assetHash, volume: 1 });
                            if (trimEnd) {
                              const duration = trimEnd - trimStart;
                              setTimeout(() => {
                                import('@/lib/soundboard').then(({ stopSoundboardPlayback }) => stopSoundboardPlayback());
                              }, duration);
                            }
                          }}
                        >
                          <span style={s.soundboardItemName as React.CSSProperties}>{ps.name}</span>
                          <span style={s.soundboardItemMeta as React.CSSProperties}>Shop</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div style={s.soundboardUpload}>
                <div style={s.soundboardUploadRow}>
                  <input
                    style={s.soundboardNameInput}
                    type="text"
                    value={newSoundName}
                    onChange={(e) => setNewSoundName(e.target.value)}
                    placeholder="Optional sound name"
                    maxLength={32}
                  />
                  <button
                    type="button"
                    style={s.soundboardRefresh}
                    disabled={uploadingSound}
                    onClick={() => soundUploadInputRef.current?.click()}
                  >
                    {uploadingSound ? 'Uploading...' : 'Add Sound'}
                  </button>
                </div>
                <input
                  ref={soundUploadInputRef}
                  type="file"
                  accept="audio/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const url = URL.createObjectURL(file);
                    const audio = new Audio(url);
                    audio.addEventListener('loadedmetadata', () => {
                      const durMs = Math.round(audio.duration * 1000);
                      if (durMs <= 5000) {
                        handleUploadSound(file).catch(() => undefined);
                        URL.revokeObjectURL(url);
                      } else {
                        setTrimPendingFile(file);
                        setTrimAudioUrl(url);
                        setTrimDuration(durMs);
                      }
                    }, { once: true });
                    audio.addEventListener('error', () => {
                      URL.revokeObjectURL(url);
                      handleUploadSound(file).catch(() => undefined);
                    }, { once: true });
                    if (soundUploadInputRef.current) soundUploadInputRef.current.value = '';
                  }}
                />
              </div>
              {trimPendingFile && trimAudioUrl && (
                <SoundTrimmer
                  audioUrl={trimAudioUrl}
                  durationMs={trimDuration}
                  onSave={() => {
                    handleUploadSound(trimPendingFile).catch(() => undefined);
                    URL.revokeObjectURL(trimAudioUrl);
                    setTrimPendingFile(null);
                    setTrimAudioUrl('');
                    setTrimDuration(0);
                  }}
                  onCancel={() => {
                    URL.revokeObjectURL(trimAudioUrl);
                    setTrimPendingFile(null);
                    setTrimAudioUrl('');
                    setTrimDuration(0);
                  }}
                />
              )}
            </div>
          )}

          {moreOpen && (
            <div data-voice-popover style={s.morePopover}>
              <label style={s.checkbox}>
                <input
                  type="checkbox"
                  checked={gridView}
                  onChange={(e) => setGridView(e.target.checked)}
                />
                <span>Grid view</span>
              </label>
            </div>
          )}
        </div>
      )}

      {isConnected && (
        <div style={s.mediaLayer}>
          {gridView && (
            <div style={s.grid}>
              {localVideoTrack && videoEnabled && (
                <VideoTile track={localVideoTrack} label="You" variant="self" />
              )}
              {localScreenTrack && screenShareEnabled && (
                <VideoTile track={localScreenTrack} label="You (Screen)" variant="screen" />
              )}
              {screenShareEnabled && !localScreenTrack && (
                <div style={s.videoTilePending}>
                  <span style={s.videoLabel}>Screen share is starting...</span>
                </div>
              )}
              {remoteTracks.filter((t) => t.kind === 'video').map((t) => (
                <VideoTile
                  key={t.id}
                  track={t.track}
                  label={t.source.toLowerCase().includes('screen') ? `${t.participantLabel} (Screen)` : t.participantLabel}
                  variant={t.source.toLowerCase().includes('screen') ? 'screen' : 'remote'}
                />
              ))}
            </div>
          )}
          {remoteTracks.filter((t) => t.kind === 'audio').map((t) => (
            <AudioTile key={t.id} track={t.track} outputDeviceId={selectedSpeaker} />
          ))}
        </div>
      )}
    </div>
  );
}

function VideoTile({ track, label, variant = 'remote' }: { track: LiveKitTrack; label: string; variant?: 'self' | 'remote' | 'screen' }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);

  const tileStyle = variant === 'self' ? s.videoTileSelf : variant === 'screen' ? s.videoTileScreen : s.videoTile;
  const labelStyle = variant === 'screen' ? s.videoLabelScreen : s.videoLabel;

  return (
    <div style={tileStyle}>
      <video ref={ref} autoPlay playsInline muted={label === 'You'} style={s.videoElement} />
      <span style={labelStyle}>{label}</span>
    </div>
  );
}

function AudioTile({ track, outputDeviceId }: { track: RemoteTrack; outputDeviceId: string }) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);

  useEffect(() => {
    const el = ref.current as HTMLMediaElement | null;
    if (!el || !outputDeviceId) return;
    if (typeof (el as any).setSinkId === 'function') {
      (el as any).setSinkId(outputDeviceId).catch(() => undefined);
    }
  }, [outputDeviceId]);

  return <audio ref={ref} autoPlay />;
}
