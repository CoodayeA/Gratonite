import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, Headphones, HeadphoneOff, PhoneOff, Settings, Users } from 'lucide-react';
import { useVoice } from '../../contexts/VoiceContext';
import { leaveVoiceSession } from '../../lib/voiceSession';

export default function VoiceBar() {
  const { connected, channelName, guildName, guildId, channelId, muted, deafened, toggleMute, toggleDeafen, leaveVoice, participantCount } = useVoice();
  const navigate = useNavigate();
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
  const [connectionQuality] = useState<'good' | 'fair' | 'poor'>('good');

  if (!connected) return null;

  const handleNavigate = () => {
    if (guildId && channelId) {
      navigate(`/guild/${guildId}/voice/${channelId}`);
    }
  };

  const handleDisconnect = async () => {
    await leaveVoiceSession({ clearVoiceState: leaveVoice });
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const btnBase: React.CSSProperties = {
    width: isMobile ? '48px' : '40px',
    height: isMobile ? '48px' : '40px',
    borderRadius: '50%',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s, transform 0.15s, box-shadow 0.15s',
    minWidth: '48px', // Ensure minimum touch target
    minHeight: '48px',
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: '52px',
      background: 'linear-gradient(180deg, rgba(var(--bg-elevated-rgb, 30, 31, 34), 0.95), rgba(var(--bg-elevated-rgb, 30, 31, 34), 0.85))',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderTop: '1px solid rgba(255, 255, 255, 0.12)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      zIndex: 100,
      boxShadow: '0 -2px 12px rgba(0, 0, 0, 0.15)',
    }}>
      {/* Left: connection status + channel info */}
      <div
        onClick={handleNavigate}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          flex: 1,
          minWidth: 0,
          padding: '6px 10px',
          borderRadius: '8px',
          marginLeft: '-10px',
          transition: 'background 0.15s',
        }}
      >
        {/* Pulsing signal indicator */}
        <div style={{ position: 'relative', width: '18px', height: '18px', flexShrink: 0 }}>
          <div style={{
            position: 'absolute',
            inset: '3px',
            borderRadius: '50%',
            background: '#43b581',
          }} />
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '2px solid #43b581',
            animation: 'voiceBarPulse 2s ease-in-out infinite',
            opacity: 0.6,
          }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 }}>
          <span style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#43b581',
            lineHeight: '1.2',
          }}>
            Voice Connected
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
            <span style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              lineHeight: '1.2',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {channelName} &middot; {guildName}
            </span>
            {/* Participant count badge (I6) */}
            {participantCount > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '3px',
                background: 'rgba(255, 255, 255, 0.08)', borderRadius: '10px',
                padding: '1px 6px', fontSize: '10px', fontWeight: 600,
                color: 'var(--text-secondary)', flexShrink: 0,
              }}>
                <Users size={10} />
                {participantCount}
              </span>
            )}
            {/* Connection quality dot (I6) */}
            <div style={{
              width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
              background: connectionQuality === 'good' ? '#43b581' : connectionQuality === 'fair' ? '#faa61a' : '#ed4245',
              boxShadow: `0 0 4px ${connectionQuality === 'good' ? '#43b581' : connectionQuality === 'fair' ? '#faa61a' : '#ed4245'}`,
            }} />
          </div>
        </div>
      </div>

      {/* Right: controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {/* Mute toggle */}
        <button
          onClick={toggleMute}
          onMouseEnter={() => setHoveredBtn('mute')}
          onMouseLeave={() => setHoveredBtn(null)}
          title={muted ? 'Unmute' : 'Mute'}
          style={{
            ...btnBase,
            background: muted
              ? 'rgba(237, 66, 69, 0.15)'
              : hoveredBtn === 'mute' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
            color: muted ? '#ed4245' : 'var(--text-secondary)',
            transform: hoveredBtn === 'mute' ? 'scale(1.08)' : 'scale(1)',
          }}
        >
          {muted ? <MicOff size={19} /> : <Mic size={19} />}
        </button>

        {/* Deafen toggle */}
        <button
          onClick={toggleDeafen}
          onMouseEnter={() => setHoveredBtn('deafen')}
          onMouseLeave={() => setHoveredBtn(null)}
          title={deafened ? 'Undeafen' : 'Deafen'}
          style={{
            ...btnBase,
            background: deafened
              ? 'rgba(237, 66, 69, 0.15)'
              : hoveredBtn === 'deafen' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
            color: deafened ? '#ed4245' : 'var(--text-secondary)',
            transform: hoveredBtn === 'deafen' ? 'scale(1.08)' : 'scale(1)',
          }}
        >
          {deafened ? <HeadphoneOff size={19} /> : <Headphones size={19} />}
        </button>

        {/* Divider */}
        <div style={{
          width: '1px',
          height: '24px',
          background: 'rgba(255, 255, 255, 0.08)',
          margin: '0 2px',
        }} />

        {/* Disconnect */}
        <button
          onClick={handleDisconnect}
          onMouseEnter={() => setHoveredBtn('disconnect')}
          onMouseLeave={() => setHoveredBtn(null)}
          title="Disconnect"
          style={{
            height: '36px',
            padding: '0 14px',
            borderRadius: '18px',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            cursor: 'pointer',
            background: hoveredBtn === 'disconnect' ? '#d83c3e' : '#ed4245',
            color: '#fff',
            transition: 'background 0.15s, transform 0.15s, box-shadow 0.15s',
            transform: hoveredBtn === 'disconnect' ? 'scale(1.04)' : 'scale(1)',
            boxShadow: hoveredBtn === 'disconnect'
              ? '0 4px 16px rgba(237, 66, 69, 0.5)'
              : '0 2px 8px rgba(237, 66, 69, 0.3)',
            fontWeight: 600,
            fontSize: '13px',
          }}
        >
          <PhoneOff size={16} />
        </button>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes voiceBarPulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
