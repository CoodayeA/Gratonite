import { useState, useEffect, useRef, useCallback } from 'react';
import { X, MonitorUp, Maximize, Minimize, Loader2 } from 'lucide-react';
import { useToast } from '../ui/ToastManager';

interface ScreenShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Optional — pass from active call context to start LiveKit screen share */
    onStartScreenShare?: (sourceId?: string) => Promise<void>;
    /** Optional — pass from parent's useLiveKit hook to stop screen share */
    onStopScreenShare?: () => Promise<void>;
    /** Whether the LiveKit connection is actively screen sharing */
    isLiveKitScreenSharing?: boolean;
}

const ScreenShareModal = ({
    isOpen,
    onClose,
    onStartScreenShare,
    onStopScreenShare,
    isLiveKitScreenSharing,
}: ScreenShareModalProps) => {
    const { addToast } = useToast();
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

    // Screen share state
    const [isSharing, setIsSharing] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [shareError, setShareError] = useState<string | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Electron desktop source picker state
    const isDesktop = !!window.gratoniteDesktop?.isDesktop;
    const [desktopSources, setDesktopSources] = useState<Array<{
        id: string;
        name: string;
        thumbnailDataUrl: string;
        displayId: string;
        appIconDataUrl: string | null;
    }>>([]);
    const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
    const [loadingSources, setLoadingSources] = useState(false);

    // Load Electron desktop sources when modal opens
    useEffect(() => {
        if (!isOpen || !isDesktop || isSharing) return;
        const loadSources = async () => {
            setLoadingSources(true);
            try {
                const sources = await window.gratoniteDesktop!.getScreenSources!();
                setDesktopSources(sources);
                if (sources.length === 0) {
                    setSelectedSourceId(null);
                } else if (!selectedSourceId || !sources.some((source) => source.id === selectedSourceId)) {
                    setSelectedSourceId(sources[0].id);
                }
            } catch {
                setDesktopSources([]);
                setSelectedSourceId(null);
            } finally {
                setLoadingSources(false);
            }
        };
        loadSources();
    }, [isOpen, isDesktop, isSharing]);

    // Elapsed timer
    useEffect(() => {
        if (isSharing) {
            setElapsedTime(0);
            timerRef.current = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isSharing]);

    // Format elapsed time
    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const handleStart = useCallback(async () => {
        if (!onStartScreenShare) {
            setShareError('Screen share is only available while connected to an active call.');
            return;
        }

        if (isDesktop && !selectedSourceId) {
            setShareError('Choose a screen or window to share.');
            return;
        }

        setIsStarting(true);
        setShareError(null);
        try {
            await onStartScreenShare(selectedSourceId ?? undefined);
            setIsSharing(true);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to start screen share';
            if (msg.includes('Permission denied') || msg.includes('NotAllowedError')) {
                setShareError('Screen share was cancelled.');
            } else {
                setShareError(msg);
                addToast({ title: 'Screen Share Failed', description: msg, variant: 'error' });
            }
        } finally {
            setIsStarting(false);
        }
    }, [addToast, isDesktop, onStartScreenShare, selectedSourceId]);

    // Stop screen share
    const handleStop = useCallback(async () => {
        if (onStopScreenShare) {
            try { await onStopScreenShare(); } catch { /* noop */ }
        }

        setIsSharing(false);
        setShareError(null);
        if (timerRef.current) clearInterval(timerRef.current);
        onClose();
    }, [onStopScreenShare, onClose]);

    // Esc closes modal (after handleStop exists)
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') void handleStop();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, handleStop]);

    // Sync with LiveKit external state
    useEffect(() => {
        if (isLiveKitScreenSharing !== undefined) {
            setIsSharing(isLiveKitScreenSharing);
        }
    }, [isLiveKitScreenSharing]);

    if (!isOpen) return null;

    return (
        <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isFullScreen ? '0px' : '24px' }}>
            <div role="dialog" aria-modal="true" aria-labelledby="screen-share-modal-title" style={{
                width: '100%',
                maxWidth: isFullScreen ? '100vw' : '900px',
                height: isFullScreen ? '100dvh' : '80vh',
                maxHeight: isFullScreen ? '100dvh' : '700px',
                borderRadius: isFullScreen ? '0' : 'var(--radius-xl)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                background: 'rgba(15, 15, 20, 0.8)',
                backdropFilter: 'blur(30px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 24px 64px rgba(0, 0, 0, 0.6)'
            }}>
                {/* Header */}
                <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--stroke)', background: 'rgba(0,0,0,0.4)', zIndex: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {isSharing && (
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 2s infinite' }} />
                        )}
                        <h2 id="screen-share-modal-title" style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'white' }}>
                            {isSharing ? 'Your Screen' : 'Screen Share'}
                        </h2>
                        {isSharing && (
                            <>
                                <span style={{ background: 'var(--accent-primary)', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'white' }}>Live</span>
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '8px', fontVariantNumeric: 'tabular-nums' }}>{formatTime(elapsedTime)}</span>
                            </>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '16px', color: 'var(--text-secondary)' }}>
                        {isSharing && (
                            <div
                                onClick={() => setIsFullScreen(!isFullScreen)}
                                onMouseEnter={() => setHoveredBtn('fullscreen')}
                                onMouseLeave={() => setHoveredBtn(null)}
                                style={{ cursor: 'pointer', transition: 'color 0.2s', color: hoveredBtn === 'fullscreen' ? 'white' : 'var(--text-secondary)' }}
                            >
                                {isFullScreen ? <Minimize size={18} /> : <Maximize size={18} />}
                            </div>
                        )}
                        <button
                            type="button"
                            aria-label="Close screen share"
                            onClick={() => void handleStop()}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', display: 'flex', alignItems: 'center' }}
                        >
                            <X size={20} className="hover-color-error" style={{ transition: 'color 0.2s' }} />
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>

                    {/* Screen Share Viewport */}
                    <div style={{
                        flex: 1,
                        background: 'linear-gradient(135deg, #1e1e2d, #14141c)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--stroke)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        {/* Pre-share prompt */}
                        {!isSharing && !isStarting && (
                            <div style={{ textAlign: 'center', zIndex: 1, padding: '40px', width: '100%', maxHeight: '100%', overflowY: 'auto' }}>
                                <MonitorUp size={64} style={{ color: 'rgba(255,255,255,0.15)', marginBottom: '24px' }} />
                                <h3 style={{ fontSize: '20px', color: 'var(--text-primary)', fontFamily: 'var(--font-display)', marginBottom: '12px' }}>
                                    Share Your Screen
                                </h3>
                                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '32px', maxWidth: '360px', lineHeight: '1.5', margin: '0 auto 32px' }}>
                                    {isDesktop ? 'Select a screen or window to share with others in this call.' : 'Choose what to share with others in this call.'}
                                </p>

                                {shareError && (
                                    <p style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '16px' }}>{shareError}</p>
                                )}

                                {/* Electron source picker grid */}
                                {isDesktop && desktopSources.length > 0 && (
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                        gap: '12px',
                                        marginBottom: '24px',
                                        maxWidth: '700px',
                                        margin: '0 auto 24px',
                                    }}>
                                        {desktopSources.map(source => (
                                            <div
                                                key={source.id}
                                                onClick={() => setSelectedSourceId(source.id)}
                                                style={{
                                                    cursor: 'pointer',
                                                    borderRadius: '8px',
                                                    border: selectedSourceId === source.id
                                                        ? '2px solid var(--accent-primary)'
                                                        : '2px solid var(--stroke)',
                                                    overflow: 'hidden',
                                                    background: 'var(--bg-tertiary)',
                                                    transition: 'border-color 0.2s, box-shadow 0.2s',
                                                    boxShadow: selectedSourceId === source.id
                                                        ? '0 0 0 2px rgba(99, 102, 241, 0.3)'
                                                        : 'none',
                                                }}
                                            >
                                                <img
                                                    src={source.thumbnailDataUrl}
                                                    alt={source.name}
                                                    style={{
                                                        width: '100%',
                                                        aspectRatio: '16/9',
                                                        objectFit: 'cover',
                                                        display: 'block',
                                                        background: '#000',
                                                    }}
                                                />
                                                <div style={{
                                                    padding: '8px 10px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                }}>
                                                    {source.appIconDataUrl && (
                                                        <img
                                                            src={source.appIconDataUrl}
                                                            alt=""
                                                            style={{ width: '16px', height: '16px', flexShrink: 0 }}
                                                        />
                                                    )}
                                                    <span style={{
                                                        fontSize: '12px',
                                                        color: selectedSourceId === source.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                                                        fontWeight: selectedSourceId === source.id ? 600 : 400,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                    }}>
                                                        {source.name}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Loading state for desktop sources */}
                                {isDesktop && loadingSources && (
                                    <div style={{ marginBottom: '24px' }}>
                                        <Loader2 size={24} style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
                                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>Loading screens and windows...</p>
                                    </div>
                                )}

                                <button
                                    onClick={handleStart}
                                    disabled={isDesktop && !selectedSourceId}
                                    style={{
                                        padding: '12px 32px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: (isDesktop && !selectedSourceId) ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
                                        color: (isDesktop && !selectedSourceId) ? 'var(--text-muted)' : 'white',
                                        fontSize: '15px',
                                        fontWeight: 600,
                                        cursor: (isDesktop && !selectedSourceId) ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        margin: '0 auto',
                                        transition: 'all 0.2s',
                                    }}
                                    className={(!isDesktop || selectedSourceId) ? 'hover-opacity-dim' : ''}
                                >
                                    <MonitorUp size={18} />
                                    Start Sharing
                                </button>
                            </div>
                        )}

                        {/* Loading state */}
                        {isStarting && (
                            <div style={{ textAlign: 'center', zIndex: 1 }}>
                                <Loader2 size={40} style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
                                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Waiting for screen selection...</p>
                            </div>
                        )}

                        {/* Sharing state */}
                        {isSharing && (
                            <div style={{ textAlign: 'center', zIndex: 1, padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                <MonitorUp size={56} style={{ color: 'var(--accent-primary)' }} />
                                <div style={{ fontSize: '18px', color: 'var(--text-primary)', fontWeight: 600 }}>Screen share is live</div>
                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Others in the call can now see your shared screen.</div>
                                <div style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', padding: '6px 12px', borderRadius: '9999px', fontSize: '12px', display: 'flex', gap: '12px', color: 'white', alignItems: 'center' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
                                        {formatTime(elapsedTime)}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Controls — only show when sharing */}
                {isSharing && (
                    <div style={{ padding: '20px', display: 'flex', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', borderTop: '1px solid var(--stroke)' }}>
                        <button
                            style={{
                                height: '48px', padding: '0 24px', borderRadius: '24px',
                                background: '#ef4444', border: 'none', color: 'white', fontWeight: 600,
                                cursor: 'pointer', marginLeft: '16px', display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.2s'
                            }}
                            className="hover-stop-red"
                            onClick={handleStop}
                        >
                            <MonitorUp size={18} />
                            Stop Sharing
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ScreenShareModal;
