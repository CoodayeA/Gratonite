import React, { useState } from 'react';
import { useCallStore } from '@/stores/call.store';
import { acceptIncomingCall, declineIncomingCall } from '@/lib/dmCall';

const styles = {
  overlay: {
    position: 'fixed',
    left: 16,
    bottom: 16,
    zIndex: 230,
  } as React.CSSProperties,

  card: {
    background: 'rgba(14, 21, 34, 0.95)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-lg)',
    padding: '14px 16px',
    boxShadow: '0 16px 32px rgba(0, 0, 0, 0.4)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    width: 280,
  } as React.CSSProperties,

  title: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text)',
  } as React.CSSProperties,

  from: {
    fontSize: 12,
    color: 'var(--text-muted)',
  } as React.CSSProperties,

  actions: {
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

  btnAccept: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: 10,
    border: '1px solid rgba(212, 175, 55, 0.4)',
    background: 'rgba(212, 175, 55, 0.12)',
    color: 'var(--text)',
    fontSize: 12,
    cursor: 'pointer',
  } as React.CSSProperties,

  btnDecline: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: 10,
    border: '1px solid rgba(255, 107, 107, 0.35)',
    background: 'rgba(255, 107, 107, 0.12)',
    color: 'var(--text)',
    fontSize: 12,
    cursor: 'pointer',
  } as React.CSSProperties,
};

export function DmIncomingCallModal() {
  const incoming = useCallStore((s) => s.incomingCall);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  if (!incoming) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <div style={styles.title}>Incoming {incoming.type === 'video' ? 'video' : 'voice'} call</div>
        <div style={styles.from}>From {incoming.fromDisplayName}</div>
        <div style={styles.actions}>
          <button
            style={styles.btnAccept}
            onClick={() => acceptIncomingCall(incoming.channelId, incoming.type, incoming.fromUserId)}
          >
            Accept
          </button>
          <button
            style={styles.btnDecline}
            onClick={() => declineIncomingCall(incoming.channelId, incoming.fromUserId)}
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
