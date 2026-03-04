import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, Headphones, Volume2, PhoneOff } from 'lucide-react';
import { useVoice } from '../../contexts/VoiceContext';
import { leaveVoiceSession } from '../../lib/voiceSession';

export default function VoiceBar() {
  const { connected, channelName, guildName, guildId, channelId, muted, deafened, toggleMute, toggleDeafen, leaveVoice } = useVoice();
  const navigate = useNavigate();

  if (!connected) return null;

  const handleNavigate = () => {
    if (guildId && channelId) {
      navigate(`/guild/${guildId}/voice/${channelId}`);
    }
  };

  const handleDisconnect = async () => {
    await leaveVoiceSession({ clearVoiceState: leaveVoice });
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: '48px',
      background: 'var(--bg-elevated, var(--bg-secondary))',
      borderTop: '1px solid var(--stroke, var(--border-color, rgba(255,255,255,0.08)))',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      zIndex: 100,
      gap: '12px',
    }}>
      {/* Left: connection status + channel info */}
      <div
        onClick={handleNavigate}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          flex: 1,
          minWidth: 0,
        }}
      >
        {/* Green dot indicator */}
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#43b581',
          flexShrink: 0,
        }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 }}>
          <span style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#43b581',
            lineHeight: '1.2',
          }}>
            Voice Connected
          </span>
          <span style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            lineHeight: '1.2',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {channelName} / {guildName}
          </span>
        </div>
      </div>

      {/* Right: controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
        {/* Mute toggle */}
        <button
          onClick={toggleMute}
          title={muted ? 'Unmute' : 'Mute'}
          style={{
            background: muted ? 'rgba(255,255,255,0.1)' : 'transparent',
            border: 'none',
            borderRadius: '6px',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: muted ? 'var(--accent-red, #ed4245)' : 'var(--text-secondary)',
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          {muted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        {/* Deafen toggle */}
        <button
          onClick={toggleDeafen}
          title={deafened ? 'Undeafen' : 'Deafen'}
          style={{
            background: deafened ? 'rgba(255,255,255,0.1)' : 'transparent',
            border: 'none',
            borderRadius: '6px',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: deafened ? 'var(--accent-red, #ed4245)' : 'var(--text-secondary)',
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          {deafened ? <Volume2 size={18} /> : <Headphones size={18} />}
        </button>

        {/* Disconnect */}
        <button
          onClick={handleDisconnect}
          title="Disconnect"
          style={{
            background: 'var(--accent-red, #ed4245)',
            border: 'none',
            borderRadius: '6px',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#fff',
            transition: 'opacity 0.15s',
          }}
        >
          <PhoneOff size={18} />
        </button>
      </div>
    </div>
  );
}
