import { useEffect, useRef, useState } from 'react';
import { RoomEvent, Track, type RemoteTrack, ConnectionQuality, type RemoteParticipant, type Participant } from 'livekit-client';
import { useCallStore } from '@/stores/call.store';
import { endDmCall, toggleMute, toggleVideo, toggleScreenShare } from '@/lib/dmCall';

export function DmCallOverlay() {
  const { status, channelId, muted, videoEnabled, screenShareEnabled, error, localVideoTrack, room, outgoingCall } = useCallStore();
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
    const videoEl = document.querySelector('.dm-call-video.is-live video') as HTMLVideoElement | null;
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

  return (
    <div className="dm-call-overlay">
      <div className="dm-call-card">
        <div className="dm-call-header">
          <div>
            <div className="dm-call-title">Direct Message Call</div>
            <div className="dm-call-subtitle">
              {status === 'connecting' && 'Connecting…'}
              {status === 'connected' && 'Live'}
              {status === 'error' && (error ?? 'Call failed')}
              {outgoingCall?.status === 'ringing' && 'Ringing…'}
              {outgoingCall?.status === 'declined' && 'Declined'}
              {outgoingCall?.status === 'timeout' && 'No answer'}
            </div>
          </div>
          <button className="dm-call-end" onClick={endDmCall}>End</button>
        </div>

        <div className="dm-call-body">
          <div className="dm-call-grid">
            <div className={`dm-call-video ${videoEnabled ? 'is-live' : ''}`}>
              {videoEnabled ? (
                <video ref={videoRef} autoPlay muted playsInline />
              ) : (
                <div className="dm-call-placeholder">Video off</div>
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

        <div className="dm-call-controls">
          <button className={`dm-call-btn ${muted ? 'is-active' : ''}`} onClick={toggleMute}>
            {muted ? 'Unmute' : 'Mute'}
          </button>
          <button className={`dm-call-btn ${videoEnabled ? 'is-active' : ''}`} onClick={toggleVideo}>
            {videoEnabled ? 'Stop Video' : 'Start Video'}
          </button>
          <button className={`dm-call-btn ${screenShareEnabled ? 'is-active' : ''}`} onClick={toggleScreenShare}>
            {screenShareEnabled ? 'Stop Share' : 'Share Screen'}
          </button>
          <button className="dm-call-btn" onClick={handlePiP} title="Picture-in-Picture">
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
    <div className="dm-call-video is-live">
      <video ref={ref} autoPlay playsInline />
      {identity && (
        <div className="video-nameplate">
          <span className="quality-dot" style={{ backgroundColor: qualityColor }} />
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
