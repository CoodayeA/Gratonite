import { useState, useEffect, useRef, useCallback } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { onSocketDisconnect, onSocketReconnect, connectSocket } from '../../lib/socket';

type BannerState = 'hidden' | 'disconnected' | 'connected';

// ─── Offline Message Queue (Item 55) ────────────────────────────────
const QUEUE_KEY = 'gratonite_offline_queue';

export interface QueuedMessage {
    id: string;
    channelId: string;
    content: string;
    timestamp: number;
}

export function getQueuedMessages(): QueuedMessage[] {
    try {
        return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    } catch {
        return [];
    }
}

export function queueMessage(msg: Omit<QueuedMessage, 'id' | 'timestamp'>): void {
    const queue = getQueuedMessages();
    queue.push({ ...msg, id: crypto.randomUUID?.() || String(Date.now()), timestamp: Date.now() });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function removeQueuedMessage(id: string): void {
    const queue = getQueuedMessages().filter(m => m.id !== id);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function clearQueuedMessages(): void {
    localStorage.removeItem(QUEUE_KEY);
}

// ─── Connection Banner ──────────────────────────────────────────────
const ConnectionBanner = () => {
    const [state, setState] = useState<BannerState>('hidden');
    const [retrying, setRetrying] = useState(false);
    const [queueCount, setQueueCount] = useState(0);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hasDisconnectedRef = useRef(false);

    const updateQueueCount = useCallback(() => {
        setQueueCount(getQueuedMessages().length);
    }, []);

    // Desktop IPC: report network status to Electron main process
  const notifyDesktopNetworkStatus = useCallback((online: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).gratoniteDesktop?.setNetworkStatus?.(online);
  }, []);

    const [reconnectQueueCount, setReconnectQueueCount] = useState(0);

  useEffect(() => {
        const unsubDisconnect = onSocketDisconnect(() => {
            hasDisconnectedRef.current = true;
            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
                hideTimerRef.current = null;
            }
            setState('disconnected');
            updateQueueCount();
            notifyDesktopNetworkStatus(false);
        });

        const unsubReconnect = onSocketReconnect(() => {
            if (!hasDisconnectedRef.current) return;
            hasDisconnectedRef.current = false;
            setRetrying(false);
            setReconnectQueueCount(getQueuedMessages().length);
            setState('connected');
            notifyDesktopNetworkStatus(true);
            hideTimerRef.current = setTimeout(() => {
                setState('hidden');
                hideTimerRef.current = null;
            }, 3000);
        });

        // Listen for online/offline browser events
        const onOnline = () => {
            if (hasDisconnectedRef.current) {
                handleRetry();
            }
        };
        const onOffline = () => {
            hasDisconnectedRef.current = true;
            setState('disconnected');
            notifyDesktopNetworkStatus(false);
        };
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);

        return () => {
            unsubDisconnect();
            unsubReconnect();
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        };
    }, [updateQueueCount, notifyDesktopNetworkStatus]);

    const handleRetry = useCallback(() => {
        setRetrying(true);
        try {
            connectSocket();
        } catch {
            // socket lib handles reconnection internally
        }
        // Reset retrying state after 5s if still disconnected
        setTimeout(() => setRetrying(false), 5000);
    }, []);

    if (state === 'hidden') return null;

    const isDisconnected = state === 'disconnected';

    return (
        <div className={isDisconnected ? 'offline-banner' : ''} style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '6px 16px',
            paddingTop: 'calc(6px + env(safe-area-inset-top, 0px))',
            fontSize: '13px',
            fontWeight: 600,
            color: isDisconnected ? 'white' : 'var(--bg-primary)',
            background: isDisconnected
                ? 'linear-gradient(90deg, #dc2626, #b91c1c)'
                : 'linear-gradient(90deg, #22c55e, #10b981)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            animation: 'connectionBannerSlideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            transition: 'background 0.3s ease',
        }}>
            {isDisconnected ? (
                <>
                    <WifiOff size={14} />
                    <span>
                        {retrying ? 'Reconnecting...' : 'You’re offline or the server is unreachable — messages may not send until we reconnect.'}
                        {queueCount > 0 && ` (${queueCount} queued)`}
                    </span>
                    {retrying ? (
                        <div style={{
                            width: '14px',
                            height: '14px',
                            border: '2px solid rgba(255,255,255,0.3)',
                            borderTopColor: 'white',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite',
                        }} />
                    ) : (
                        <button
                            onClick={handleRetry}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 12px',
                                border: '1px solid rgba(255,255,255,0.4)',
                                borderRadius: '6px',
                                background: 'rgba(255,255,255,0.15)',
                                color: 'white',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                WebkitTapHighlightColor: 'transparent',
                            }}
                        >
                            <RefreshCw size={12} />
                            Retry
                        </button>
                    )}
                </>
            ) : (
                <>
                    <Wifi size={14} />
                    <span>{reconnectQueueCount > 0 ? `Back online — sending ${reconnectQueueCount} queued message${reconnectQueueCount === 1 ? '' : 's'}` : 'Back online — syncing in real time'}</span>
                </>
            )}
            <style>{`
                @keyframes connectionBannerSlideDown {
                    from { transform: translateY(-100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default ConnectionBanner;
