import { useState, useEffect } from 'react';

/**
 * Task #89: Compact floating mini-mode UI for gaming.
 * Rendered at /mini-mode route in the Electron mini window.
 * Shows voice controls and a compact chat view.
 */
export default function MiniMode() {
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [participants, setParticipants] = useState<Array<{ id: string; name: string; speaking: boolean }>>([]);

  const exitMiniMode = () => {
    window.gratoniteDesktop?.exitMiniMode?.();
  };

  // Drag support for frameless window
  const headerStyle = {
    WebkitAppRegion: 'drag',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    background: '#1a1a2e',
    borderBottom: '1px solid #2a2a4a',
    cursor: 'move',
  } as React.CSSProperties;

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#16162a',
    color: '#fff',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: 13,
    overflow: 'hidden',
    borderRadius: 8,
  };

  const controlBtnStyle: React.CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    transition: 'background 0.15s',
  };

  return (
    <div style={containerStyle}>
      {/* Draggable title bar */}
      <div style={headerStyle}>
        <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.7 }}>Gratonite Mini</span>
        <button
          onClick={exitMiniMode}
          style={{
            ...controlBtnStyle,
            width: 24, height: 24, fontSize: 12,
            background: 'transparent',
            color: '#999',
            WebkitAppRegion: 'no-drag',
          } as React.CSSProperties}
          title="Exit Mini Mode"
        >
          X
        </button>
      </div>

      {/* Voice controls */}
      <div style={{ display: 'flex', gap: 8, padding: '12px', justifyContent: 'center', borderBottom: '1px solid #2a2a4a' }}>
        <button
          onClick={() => setIsMuted(!isMuted)}
          style={{
            ...controlBtnStyle,
            background: isMuted ? '#ed4245' : '#3ba55d',
            color: '#fff',
          }}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? 'M' : 'U'}
        </button>
        <button
          onClick={() => setIsDeafened(!isDeafened)}
          style={{
            ...controlBtnStyle,
            background: isDeafened ? '#ed4245' : '#3ba55d',
            color: '#fff',
          }}
          title={isDeafened ? 'Undeafen' : 'Deafen'}
        >
          {isDeafened ? 'D' : 'H'}
        </button>
        <button
          onClick={exitMiniMode}
          style={{
            ...controlBtnStyle,
            background: '#ed4245',
            color: '#fff',
          }}
          title="Disconnect"
        >
          X
        </button>
      </div>

      {/* Participant list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
        {participants.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#666', padding: '20px 0', fontSize: 12 }}>
            Not in a voice channel
          </div>
        ) : (
          participants.map(p => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0',
              opacity: p.speaking ? 1 : 0.6,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: p.speaking ? '#3ba55d' : '#72767d',
              }} />
              <span style={{ fontSize: 12 }}>{p.name}</span>
            </div>
          ))
        )}
      </div>

      {/* Footer with expand button */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid #2a2a4a', textAlign: 'center' }}>
        <button
          onClick={exitMiniMode}
          style={{
            background: 'var(--accent-color, #5865f2)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '6px 16px',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            width: '100%',
          }}
        >
          Open Full App
        </button>
      </div>
    </div>
  );
}
