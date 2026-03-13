import { useState, useEffect } from 'react';
import { getConnectionState, onConnectionStateChange, type ConnectionState } from '../lib/socket';

/**
 * React hook that tracks the WebSocket connection state.
 * Returns one of: 'connected' | 'connecting' | 'disconnected' | 'reconnecting'
 */
export function useConnectionState(): ConnectionState {
  const [state, setState] = useState<ConnectionState>(getConnectionState);

  useEffect(() => {
    return onConnectionStateChange(setState);
  }, []);

  return state;
}
