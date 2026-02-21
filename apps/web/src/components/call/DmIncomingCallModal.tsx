import { useCallStore } from '@/stores/call.store';
import { acceptIncomingCall, declineIncomingCall } from '@/lib/dmCall';

export function DmIncomingCallModal() {
  const incoming = useCallStore((s) => s.incomingCall);

  if (!incoming) return null;

  return (
    <div className="dm-call-incoming">
      <div className="dm-call-incoming-card">
        <div className="dm-call-incoming-title">Incoming {incoming.type === 'video' ? 'video' : 'voice'} call</div>
        <div className="dm-call-incoming-from">From {incoming.fromDisplayName}</div>
        <div className="dm-call-incoming-actions">
          <button
            className="dm-call-incoming-btn accept"
            onClick={() => acceptIncomingCall(incoming.channelId, incoming.type, incoming.fromUserId)}
          >
            Accept
          </button>
          <button
            className="dm-call-incoming-btn decline"
            onClick={() => declineIncomingCall(incoming.channelId, incoming.fromUserId)}
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
