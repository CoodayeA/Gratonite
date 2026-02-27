import React, { useEffect, useRef, useState } from 'react';
import { RoomEvent, Track, type RemoteTrack, ConnectionQuality, type RemoteParticipant, type Participant } from 'livekit-client';
import { useCallStore } from '@/stores/call.store';
import { useChannelsStore } from '@/stores/channels.store';
import { endDmCall, toggleMute, toggleVideo, toggleScreenShare } from '@/lib/dmCall';

const styles = {
  overlay: {
    position: 'fixed',
    right: 16,
    bottom: 16,
    width: 320,
    zIndex: 220,
  } as React.CSSProperties,

  card: {
    background: 'rgba(14, 21, 34, 0.95)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-lg)',
    padding: 14,
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  } as React.CSSProperties,

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  } as React.CSSProperties,

  title: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)',
  } as React.CSSProperties,

  subtitle: {
    fontSize: 11,
    color: 'var(--text-muted)',
    marginTop: 4,
  } as React.CSSProperties,

  endBtn: {
    background: 'rgba(255, 107, 107, 0.15)',
    border: '1px solid rgba(255, 107, 107, 0.35)',
    color: 'var(--danger)',
    borderRadius: 'var(--radius-pill)',
    padding: '6px 12px',
    fontSize: 12,
    cursor: 'pointer',
  } as React.CSSProperties,

  body: {
    display: 'grid',
    gap: 8,
  } as React.CSSProperties,

  grid: {
    display: 'grid',
    gap: 8,
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  } as React.CSSProperties,

  video: {
    position: 'relative',
    height: 160,
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    background: 'rgba(0, 0, 0, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'grid',
    placeItems: 'center',
    color: 'var(--text-faint)',
    fontSize: 12,
  } as React.CSSProperties,

  videoElement: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  } as React.CSSProperties,

  placeholder: {
    color: 'var(--text-faint)',
    fontSize: 12,
  } as React.CSSProperties,

  controls: {
    display: 'flex',
    gap: 10,
  } as React.CSSProperties,

  btn: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: 10,
    border: '1px solid rgba(255, 255, 255, 0.1)',
    background: 'rgba(255, 255, 255, 0.04)',
    color: 'var(--text)',
    fontSize: 12,
    cursor: 'pointer',
  } as React.CSSProperties,

  btnActive: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: 10,
    background: 'rgba(255, 255, 255, 0.04)',
    color: 'var(--text)',
    fontSize: 12,
    cursor: 'pointer',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(212, 175, 55, 0.5)',
    boxShadow: '0 0 10px rgba(212, 175, 55, 0.2)',
  } as React.CSSProperties,

  nameplate: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
    background: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 13,
    color: '#fff',
  } as React.CSSProperties,

  qualityDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  } as React.CSSProperties,
};

export function DmCallOverlay() {
  const { status, channelId, muted, videoEnabled, screenShareEnabled, error, localVideoTrack, room, outgoingCall } = useCallStore();
  const channel = useChannelsStore((s) => (channelId ? s.channels.get(channelId) : undefined));
  const videoRef = useRef<HTMLVideoElement>(null);
  const [remoteTracks, setRemoteTracks] = useState<Array<{ id: string; track: RemoteTrack; kind: 'video' | 'audio'; identity?: string }>>([]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !localVideoTrack) return;
    localVideoTrack.attach(el);
    return () => {
      localVideoTrack.detach(el);
    };
  }, [localVideoTrack]);

  useEffect(() => {
    if (!room) return;
    function handleSubscribed(track: RemoteTrack, _pub: any, participant: RemoteParticipant) {
      if (!track.sid) return;
      const trackId = track.sid;
      const kind = track.kind === Track.Kind.Video ? 'video' : 'audio';
      setRemoteTracks((prev) => {
        if (prev.some((item) => item.id === trackId)) return prev;
        return [...prev, { id: trackId, track, kind, identity: participant.identity }];
      });
    }

    function handleUnsubscribed(track: RemoteTrack) {
      if (!track.sid) return;
      setRemoteTracks((prev) => prev.filter((item) => item.id !== track.sid));
    }

    room.on(RoomEvent.TrackSubscribed, handleSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, handleUnsubscribed);

    return () => {
      room.off(RoomEvent.TrackSubscribed, handleSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, handleUnsubscribed);
      setRemoteTracks([]);
    };
  }, [room]);

  // Track connection quality
  const [qualities, setQualities] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!room) return;
    const onQuality = (quality: ConnectionQuality, participant: Participant) => {
      const label =
        quality === ConnectionQuality.Excellent ? 'excellent'
        : quality === ConnectionQuality.Good ? 'good'
        : quality === ConnectionQuality.Poor ? 'poor'
        : 'unknown';
      setQualities((prev) => ({ ...prev, [participant.identity]: label }));
    };
    room.on(RoomEvent.ConnectionQualityChanged, onQuality);
    return () => {
      room.off(RoomEvent.ConnectionQualityChanged, onQuality);
    };
  }, [room]);

  const handlePiP = async () => {
    const videoEl = document.querySelector('[data-dm-call-live] video') as HTMLVideoElement | null;
    if (!videoEl) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoEl.requestPictureInPicture();
      }
    } catch {
      // PiP not supported or denied
    }
  };

  if (status === 'idle' || !channelId) return null;
  if (channel?.type === 'GUILD_VOICE' || channel?.type === 'GUILD_STAGE_VOICE') return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>Direct Message Call</div>
            <div style={styles.subtitle}>
              {status === 'connecting' && 'Connecting\u2026'}
              {status === 'connected' && 'Live'}
              {status === 'error' && (error ?? 'Call failed')}
              {outgoingCall?.status === 'ringing' && 'Ringing\u2026'}
              {outgoingCall?.status === 'declined' && 'Declined'}
              {outgoingCall?.status === 'timeout' && 'No answer'}
            </div>
          </div>
          <button style={styles.endBtn} onClick={endDmCall}>End</button>
        </div>

        <div style={styles.body}>
          <div style={styles.grid}>
            <div style={styles.video} {...(videoEnabled ? { 'data-dm-call-live': true } : {})}>
              {videoEnabled ? (
                <video ref={videoRef} autoPlay muted playsInline style={styles.videoElement} />
              ) : (
                <div style={styles.placeholder}>Video off</div>
              )}
            </div>
            {remoteTracks.filter((t) => t.kind === 'video').map((item) => (
              <RemoteVideoTile key={item.id} track={item.track} identity={item.identity} quality={qualities[item.identity ?? '']} />
            ))}
            {remoteTracks.filter((t) => t.kind === 'audio').map((item) => (
              <RemoteAudioTile key={item.id} track={item.track} />
            ))}
          </div>
        </div>

        <div style={styles.controls}>
          <button style={muted ? styles.btnActive : styles.btn} onClick={toggleMute}>
            {muted ? 'Unmute' : 'Mute'}
          </button>
          <button style={videoEnabled ? styles.btnActive : styles.btn} onClick={toggleVideo}>
            {videoEnabled ? 'Stop Video' : 'Start Video'}
          </button>
          <button style={screenShareEnabled ? styles.btnActive : styles.btn} onClick={toggleScreenShare}>
            {screenShareEnabled ? 'Stop Share' : 'Share Screen'}
          </button>
          <button style={styles.btn} onClick={handlePiP} title="Picture-in-Picture">
            PiP
          </button>
        </div>
      </div>
    </div>
  );
}

function RemoteVideoTile({ track, identity, quality }: { track: RemoteTrack; identity?: string; quality?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);

  const qualityColor =
    quality === 'excellent' ? '#4ade80'
    : quality === 'good' ? '#facc15'
    : quality === 'poor' ? '#ef4444'
    : '#888';

  return (
    <div style={styles.video} data-dm-call-live>
      <video ref={ref} autoPlay playsInline style={styles.videoElement} />
      {identity && (
        <div style={styles.nameplate}>
          <span style={{ ...styles.qualityDot, backgroundColor: qualityColor }} />
          <span>{identity}</span>
        </div>
      )}
    </div>
  );
}

function RemoteAudioTile({ track }: { track: RemoteTrack }) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);

  return <audio ref={ref} autoPlay />;
}
