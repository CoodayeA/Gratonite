import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuthStore } from '../stores/auth.store';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface SocketStatus {
  /** Whether the socket is currently connected and identified. */
  connected: boolean;
  /** Whether the socket is currently attempting to reconnect. */
  reconnecting: boolean;
}

const SocketContext = createContext<SocketStatus>({
  connected: false,
  reconnecting: false,
});

/**
 * Read the current socket connection status.
 *
 * ```tsx
 * const { connected, reconnecting } = useSocketStatus();
 * ```
 */
export function useSocketStatus(): SocketStatus {
  return useContext(SocketContext);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * SocketProvider manages the Socket.IO connection lifecycle:
 *
 * - Connects when the user is authenticated (token is present).
 * - Disconnects when the user logs out.
 * - Reconnects when the app returns to the foreground.
 * - Exposes connection status via `useSocketStatus()`.
 *
 * Place this near the root of your component tree:
 *
 * ```tsx
 * <SocketProvider>
 *   <NavigationContainer>...</NavigationContainer>
 * </SocketProvider>
 * ```
 */
export function SocketProvider({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const token = useAuthStore((s) => s.token);

  const [status, setStatus] = useState<SocketStatus>({
    connected: false,
    reconnecting: false,
  });

  // Track whether we have connected at least once so we can distinguish
  // "reconnecting" from "first connection".
  const wasConnected = useRef(false);
  const connectedRef = useRef(false);

  // ------------------------------------------------------------------
  // Status sync helper — reads the socket instance and derives status.
  // ------------------------------------------------------------------
  const syncStatus = useCallback(() => {
    const sock = getSocket();
    const connected = sock?.connected ?? false;
    const reconnecting = !connected && wasConnected.current;

    setStatus((prev) => {
      if (prev.connected === connected && prev.reconnecting === reconnecting) {
        return prev; // avoid unnecessary re-renders
      }
      return { connected, reconnecting };
    });

    if (connected) {
      wasConnected.current = true;
    }
  }, []);

  // ------------------------------------------------------------------
  // Connect / disconnect based on auth state
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!isAuthenticated || !token) {
      // User logged out (or not yet logged in).
      if (connectedRef.current) {
        disconnectSocket();
        connectedRef.current = false;
        wasConnected.current = false;
        setStatus({ connected: false, reconnecting: false });
      }
      return;
    }

    // Connect and wire up status listeners.
    const sock = connectSocket(token);
    connectedRef.current = true;

    const onConnect = () => syncStatus();
    const onDisconnect = () => syncStatus();
    const onReconnectAttempt = () => {
      setStatus({ connected: false, reconnecting: true });
    };
    const onReconnectFailed = () => {
      setStatus({ connected: false, reconnecting: false });
    };

    sock.on('connect', onConnect);
    sock.on('disconnect', onDisconnect);
    sock.io.on('reconnect_attempt', onReconnectAttempt);
    sock.io.on('reconnect_failed', onReconnectFailed);
    sock.io.on('reconnect', onConnect);

    // Run an initial sync in case the socket connected synchronously.
    syncStatus();

    return () => {
      sock.off('connect', onConnect);
      sock.off('disconnect', onDisconnect);
      sock.io.off('reconnect_attempt', onReconnectAttempt);
      sock.io.off('reconnect_failed', onReconnectFailed);
      sock.io.off('reconnect', onConnect);

      disconnectSocket();
      connectedRef.current = false;
      wasConnected.current = false;
      setStatus({ connected: false, reconnecting: false });
    };
  }, [isAuthenticated, token, syncStatus]);

  // ------------------------------------------------------------------
  // AppState listener — reconnect when foregrounded
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        // App came to foreground — ensure the socket is connected.
        const sock = getSocket();
        if (sock && !sock.connected) {
          console.log('[SocketProvider] App foregrounded — reconnecting');
          sock.connect();
        }
        syncStatus();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, token, syncStatus]);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <SocketContext.Provider value={status}>
      {children}
    </SocketContext.Provider>
  );
}
