import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Mic, Video, MonitorUp, Settings, Maximize, Minimize, MicOff, VideoOff, Loader2 } from 'lucide-react';
import { useToast } from '../ui/ToastManager';

interface ScreenShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Optional — pass from parent's useLiveKit hook to use LiveKit screen share */
    onStartScreenShare?: () => Promise<void>;
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
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOn, setIsVideoOn] = useState(false);
    const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [streamQuality, setStreamQuality] = useState<'720p' | '1080p'>('1080p');
    const [frameRate, setFrameRate] = useState(30);

    // Screen share state
    const [isSharing, setIsSharing] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [shareError, setShareError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
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
                if (sources.length > 0 && !selectedSourceId) {
                    setSelectedSourceId(sources[0].id);
                }
            } catch {
                setDesktopSources([]);
            } finally {
                setLoadingSources(false);
            }
        };
        loadSources();
    }, [isOpen, isDesktop, isSharing]);

    // Esc key handler
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleStop(); };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

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

    // Start screen share — native getDisplayMedia or Electron desktopCapturer
    const startNativeScreenShare = useCallback(async () => {
        setIsStarting(true);
        setShareError(null);
        try {
            const res = streamQuality === '1080p'
                ? { width: 1920, height: 1080 }
                : { width: 1280, height: 720 };

            let stream: MediaStream;

            // Electron desktop path: use selected source from desktopCapturer
            if (isDesktop && selectedSourceId) {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: {
                        mandatory: {
                            chromeMediaSource: 'desktop',
                            chromeMediaSourceId: selectedSourceId,
                            maxWidth: res.width,
                            maxHeight: res.height,
                            maxFrameRate: frameRate,
                        },
                    } as any,
                });

                // Try to get system audio separately
                try {
                    const audioStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            mandatory: {
                                chromeMediaSource: 'desktop',
                            },
                        } as any,
                        video: false,
                    });
                    audioStream.getAudioTracks().forEach(track => stream.addTrack(track));
                } catch {
                    // Audio capture not available on all platforms
                }
            } else {
                // Standard browser path
                stream = await navigator.mediaDevices.getDisplayMedia({
                    video: { ...res, frameRate: { ideal: frameRate } },
                    audio: true,
                });
            }

            streamRef.current = stream;

            // Attach the video to the preview element
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }

            // Listen for the user stopping share via the browser chrome
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.addEventListener('ended', () => {
                    handleStop();
                });
            }

            setIsSharing(true);
            setDesktopSources([]); // Clear source picker
            addToast({ title: 'Screen Share Started', description: 'You are now sharing your screen.', variant: 'success' });
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
    }, [streamQuality, frameRate, addToast, isDesktop, selectedSourceId]);

    // Start screen share (LiveKit path or native fallback)
    const handleStart = useCallback(async () => {
        if (onStartScreenShare) {
            setIsStarting(true);
            try {
                await onStartScreenShare();
                setIsSharing(true);
                addToast({ title: 'Screen Share Started', description: 'You are now sharing your screen via LiveKit.', variant: 'success' });
            } catch {
                // Fall back to native share
                await startNativeScreenShare();
            } finally {
                setIsStarting(false);
            }
        } else {
            await startNativeScreenShare();
        }
    }, [onStartScreenShare, startNativeScreenShare, addToast]);

    // Stop screen share
    const handleStop = useCallback(async () => {
        // Stop native stream
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }

        // Stop LiveKit screen share
        if (onStopScreenShare) {
            try { await onStopScreenShare(); } catch { /* noop */ }
        }

        setIsSharing(false);
        setShareError(null);
        if (timerRef.current) clearInterval(timerRef.current);
        onClose();
    }, [onStopScreenShare, onClose]);

    // Sync with LiveKit external state
    useEffect(() => {
        if (isLiveKitScreenSharing !== undefined) {
            setIsSharing(isLiveKitScreenSharing);
        }
    }, [isLiveKitScreenSharing]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }
        };
    }, []);

    if (!isOpen) return null;

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isFullScreen ? '0px' : '24px', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}>
            <div style={{
                width: '100%',
                maxWidth: isFullScreen ? '100vw' : '900px',
                height: isFullScreen ? '100vh' : '80vh',
                maxHeight: isFullScreen ? '100vh' : '700px',
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
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'white' }}>
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
                        <X size={20} style={{ cursor: 'pointer', transition: 'color 0.2s' }} onClick={handleStop} onMouseOver={e => e.currentTarget.style.color = '#ef4444'} onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'} />
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
                        {/* Live video preview of the shared screen */}
                        {isSharing && (
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain',
                                    background: '#000',
                                }}
                            />
                        )}

                        {/* Pre-share prompt */}
                        {!isSharing && !isStarting && (
                            <div style={{ textAlign: 'center', zIndex: 1, padding: '40px', width: '100%', maxHeight: '100%', overflowY: 'auto' }}>
                                <MonitorUp size={64} style={{ color: 'rgba(255,255,255,0.15)', marginBottom: '24px' }} />
                                <h3 style={{ fontSize: '20px', color: 'var(--text-primary)', fontFamily: 'var(--font-display)', marginBottom: '12px' }}>
                                    Share Your Screen
                                </h3>
                                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '32px', maxWidth: '360px', lineHeight: '1.5', margin: '0 auto 32px' }}>
                                    {isDesktop ? 'Select a screen or window to share with others in this call.' : 'Choose a screen, window, or tab to share with others in this call.'}
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

                                {/* Quality presets */}
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '20px' }}>
                                    {(['720p', '1080p'] as const).map(q => (
                                        <button
                                            key={q}
                                            onClick={() => setStreamQuality(q)}
                                            style={{
                                                padding: '6px 16px',
                                                borderRadius: '6px',
                                                border: streamQuality === q ? '1px solid var(--accent-primary)' : '1px solid var(--stroke)',
                                                background: streamQuality === q ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                                color: streamQuality === q ? 'white' : 'var(--text-secondary)',
                                                fontSize: '13px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                            }}
                                        >
                                            {q}
                                        </button>
                                    ))}
                                    <span style={{ display: 'flex', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>{frameRate} fps</span>
                                </div>

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
                                    onMouseOver={e => { if (!isDesktop || selectedSourceId) e.currentTarget.style.opacity = '0.9'; }}
                                    onMouseOut={e => e.currentTarget.style.opacity = '1'}
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

                        {/* Timer overlay when sharing */}
                        {isSharing && (
                            <div style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', padding: '6px 12px', borderRadius: '9999px', fontSize: '12px', display: 'flex', gap: '12px', color: 'white', alignItems: 'center' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
                                    {formatTime(elapsedTime)}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Controls — only show when sharing */}
                {isSharing && (
                    <div style={{ padding: '20px', display: 'flex', justifyContent: 'center', gap: '16px', background: 'rgba(0,0,0,0.6)', borderTop: '1px solid var(--stroke)' }}>
                        <button
                            onMouseEnter={() => setHoveredBtn('mic')}
                            onMouseLeave={() => setHoveredBtn(null)}
                            onClick={() => {
                                setIsMuted(!isMuted);
                                addToast({ title: isMuted ? 'Microphone Unmuted' : 'Microphone Muted', variant: 'info' });
                            }}
                            style={{
                                width: '48px', height: '48px', borderRadius: '50%',
                                background: isMuted ? 'var(--error)' : (hoveredBtn === 'mic' ? 'rgba(255,255,255,0.1)' : 'var(--bg-elevated)'),
                                border: '1px solid var(--stroke)', color: 'white',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s'
                            }}
                        >
                            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                        </button>
                        <button
                            onMouseEnter={() => setHoveredBtn('video')}
                            onMouseLeave={() => setHoveredBtn(null)}
                            onClick={() => {
                                setIsVideoOn(!isVideoOn);
                                addToast({ title: isVideoOn ? 'Camera Disabled' : 'Camera Enabled', variant: 'info' });
                            }}
                            style={{
                                width: '48px', height: '48px', borderRadius: '50%',
                                background: isVideoOn ? 'var(--accent-primary)' : (hoveredBtn === 'video' ? 'rgba(255,255,255,0.1)' : 'var(--bg-elevated)'),
                                border: '1px solid var(--stroke)', color: isVideoOn ? '#000' : 'white',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s'
                            }}
                        >
                            {isVideoOn ? <Video size={20} /> : <VideoOff size={20} />}
                        </button>
                        <div style={{ position: 'relative' }}>
                            <button
                                onMouseEnter={() => setHoveredBtn('settings')}
                                onMouseLeave={() => setHoveredBtn(null)}
                                onClick={() => setShowSettings(prev => !prev)}
                                style={{
                                    width: '48px', height: '48px', borderRadius: '50%',
                                    background: showSettings ? 'var(--accent-primary)' : (hoveredBtn === 'settings' ? 'rgba(255,255,255,0.1)' : 'var(--bg-elevated)'),
                                    border: '1px solid var(--stroke)', color: 'white',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s'
                                }}
                            >
                                <Settings size={20} />
                            </button>

                            {showSettings && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: '60px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    width: '260px',
                                    background: 'var(--bg-elevated)',
                                    border: '1px solid var(--stroke)',
                                    borderRadius: '12px',
                                    padding: '16px',
                                    boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                                    zIndex: 30,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '16px',
                                }}>
                                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Stream Settings
                                    </div>

                                    {/* Frame Rate */}
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Frame Rate</span>
                                            <span style={{ fontSize: '12px', color: 'var(--accent-primary)', fontWeight: 700 }}>{frameRate} fps</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={15}
                                            max={60}
                                            step={5}
                                            value={frameRate}
                                            onChange={e => setFrameRate(Number(e.target.value))}
                                            style={{
                                                width: '100%',
                                                accentColor: 'var(--accent-primary)',
                                                cursor: 'pointer',
                                            }}
                                        />
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                            <span>15</span>
                                            <span>30</span>
                                            <span>60</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => {
                                            addToast({ title: `Settings applied: ${streamQuality} at ${frameRate}fps.`, variant: 'success' });
                                            setShowSettings(false);
                                        }}
                                        style={{
                                            padding: '8px 0',
                                            borderRadius: '6px',
                                            border: 'none',
                                            background: 'var(--accent-primary)',
                                            color: 'white',
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        Apply
                                    </button>
                                </div>
                            )}
                        </div>
                        <button
                            style={{
                                height: '48px', padding: '0 24px', borderRadius: '24px',
                                background: '#ef4444', border: 'none', color: 'white', fontWeight: 600,
                                cursor: 'pointer', marginLeft: '16px', display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.2s'
                            }}
                            onMouseOver={e => e.currentTarget.style.background = '#dc2626'}
                            onMouseOut={e => e.currentTarget.style.background = '#ef4444'}
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
