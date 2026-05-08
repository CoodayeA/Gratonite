import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, MonitorUp, Maximize, Minimize, Loader2, Monitor, AppWindow, Search } from 'lucide-react';
import { useToast } from '../ui/ToastManager';

type DesktopSource = {
    id: string;
    name: string;
    thumbnailDataUrl: string;
    displayId: string;
    appIconDataUrl: string | null;
    type?: 'screen' | 'window';
    appName?: string;
};

interface ScreenShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Optional — pass from active call context to start LiveKit screen share */
    onStartScreenShare?: (sourceId?: string) => Promise<void>;
    /** Optional — pass from parent's useLiveKit hook to stop screen share */
    onStopScreenShare?: () => Promise<void>;
    /** Whether the LiveKit connection is actively screen sharing */
    isLiveKitScreenSharing?: boolean;
    /** Live MediaStreamTrack of the currently shared screen, for in-modal preview */
    localScreenTrack?: MediaStreamTrack | null;
}

type PickerTab = 'screen' | 'window';

const ScreenShareModal = ({
    isOpen,
    onClose,
    onStartScreenShare,
    onStopScreenShare,
    isLiveKitScreenSharing,
    localScreenTrack,
}: ScreenShareModalProps) => {
    const { addToast } = useToast();
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

    const [isSharing, setIsSharing] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [shareError, setShareError] = useState<string | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Electron desktop source picker state
    const isDesktop = !!window.gratoniteDesktop?.isDesktop;
    const [desktopSources, setDesktopSources] = useState<DesktopSource[]>([]);
    const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
    const [loadingSources, setLoadingSources] = useState(false);
    const [pickerTab, setPickerTab] = useState<PickerTab>('screen');
    const [searchQuery, setSearchQuery] = useState('');

    const previewVideoRef = useRef<HTMLVideoElement>(null);

    // Load Electron desktop sources when modal opens; refresh every 3s for fresh thumbs.
    useEffect(() => {
        if (!isOpen || !isDesktop || isSharing) return;
        let cancelled = false;
        const loadSources = async () => {
            setLoadingSources(true);
            try {
                const sources = await window.gratoniteDesktop!.getScreenSources!();
                if (cancelled) return;
                // Older builds may omit `type`; infer from id prefix as fallback.
                const normalized: DesktopSource[] = sources.map((s) => ({
                    ...s,
                    type: s.type ?? (s.id.startsWith('screen:') ? 'screen' : 'window'),
                }));
                setDesktopSources(normalized);
                setSelectedSourceId((prev) => {
                    if (prev && normalized.some((s) => s.id === prev)) return prev;
                    const firstOfTab = normalized.find((s) => s.type === pickerTab);
                    return firstOfTab?.id ?? normalized[0]?.id ?? null;
                });
            } catch {
                if (!cancelled) {
                    setDesktopSources([]);
                    setSelectedSourceId(null);
                }
            } finally {
                if (!cancelled) setLoadingSources(false);
            }
        };
        loadSources();
        const refresh = setInterval(loadSources, 3000);
        return () => {
            cancelled = true;
            clearInterval(refresh);
        };
    }, [isOpen, isDesktop, isSharing, pickerTab]);

    // Elapsed timer
    useEffect(() => {
        if (isSharing) {
            setElapsedTime(0);
            timerRef.current = setInterval(() => setElapsedTime((prev) => prev + 1), 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isSharing]);

    // Attach the live shared track to the preview <video> when sharing starts.
    useEffect(() => {
        const el = previewVideoRef.current;
        if (!el) return;
        if (isSharing && localScreenTrack) {
            const stream = new MediaStream([localScreenTrack]);
            el.srcObject = stream;
            el.play().catch(() => { /* autoplay restrictions: user can click to play */ });
        } else {
            el.srcObject = null;
        }
        return () => {
            if (el) el.srcObject = null;
        };
    }, [isSharing, localScreenTrack]);

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

    const handleStop = useCallback(async () => {
        if (onStopScreenShare) {
            try { await onStopScreenShare(); } catch { /* noop */ }
        }
        setIsSharing(false);
        setShareError(null);
        if (timerRef.current) clearInterval(timerRef.current);
        onClose();
    }, [onStopScreenShare, onClose]);

    // Esc closes modal
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

    const [hoveredSourceId, setHoveredSourceId] = useState<string | null>(null);

    // Filter sources by tab + search query, and group windows by app.
    const visibleSources = useMemo(() => {
        const ofTab = desktopSources.filter((s) => (s.type ?? 'screen') === pickerTab);
        if (!searchQuery.trim()) return ofTab;
        const q = searchQuery.toLowerCase();
        return ofTab.filter((s) =>
            s.name.toLowerCase().includes(q) || (s.appName ?? '').toLowerCase().includes(q),
        );
    }, [desktopSources, pickerTab, searchQuery]);

    const groupedWindows = useMemo(() => {
        if (pickerTab !== 'window') return null;
        const groups = new Map<string, DesktopSource[]>();
        visibleSources.forEach((s) => {
            const key = s.appName?.trim() || 'Other';
            const list = groups.get(key) ?? [];
            list.push(s);
            groups.set(key, list);
        });
        // Sort: groups with more windows first, then alphabetically.
        return Array.from(groups.entries()).sort((a, b) => {
            if (b[1].length !== a[1].length) return b[1].length - a[1].length;
            return a[0].localeCompare(b[0]);
        });
    }, [pickerTab, visibleSources]);

    const counts = useMemo(() => ({
        screen: desktopSources.filter((s) => (s.type ?? (s.id.startsWith('screen:') ? 'screen' : 'window')) === 'screen').length,
        window: desktopSources.filter((s) => (s.type ?? (s.id.startsWith('screen:') ? 'screen' : 'window')) === 'window').length,
    }), [desktopSources]);

    if (!isOpen) return null;

    const tabBtnStyle = (active: boolean): React.CSSProperties => ({
        padding: '8px 14px',
        borderRadius: 999,
        border: active ? '1px solid var(--accent-primary)' : '1px solid var(--stroke)',
        background: active ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontSize: 13,
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
    });

    const renderSourceCard = (source: DesktopSource) => (
        <div
            key={source.id}
            onClick={() => setSelectedSourceId(source.id)}
            onDoubleClick={() => { setSelectedSourceId(source.id); void handleStart(); }}
            onMouseEnter={() => setHoveredSourceId(source.id)}
            onMouseLeave={() => setHoveredSourceId((cur) => (cur === source.id ? null : cur))}
            style={{
                cursor: 'pointer',
                borderRadius: 8,
                border: selectedSourceId === source.id ? '2px solid var(--accent-primary)' : '2px solid var(--stroke)',
                overflow: 'hidden',
                background: 'var(--bg-tertiary)',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                boxShadow: selectedSourceId === source.id ? '0 0 0 2px rgba(99, 102, 241, 0.3)' : 'none',
            }}
        >
            <img
                src={source.thumbnailDataUrl}
                alt={source.name}
                style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block', background: '#000' }}
            />
            <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                {source.appIconDataUrl && (
                    <img src={source.appIconDataUrl} alt="" style={{ width: 16, height: 16, flexShrink: 0 }} />
                )}
                <span style={{
                    fontSize: 12,
                    color: selectedSourceId === source.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: selectedSourceId === source.id ? 600 : 400,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {source.name}
                </span>
            </div>
        </div>
    );

    return (
        <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isFullScreen ? '0px' : '24px' }}>
            <div role="dialog" aria-modal="true" aria-labelledby="screen-share-modal-title" style={{
                width: '100%',
                maxWidth: isFullScreen ? '100vw' : '960px',
                height: isFullScreen ? '100dvh' : '82vh',
                maxHeight: isFullScreen ? '100dvh' : '760px',
                borderRadius: isFullScreen ? '0' : 'var(--radius-xl)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                background: 'rgba(15, 15, 20, 0.85)',
                backdropFilter: 'blur(30px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 24px 64px rgba(0, 0, 0, 0.6)'
            }}>
                {/* Header */}
                <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--stroke)', background: 'rgba(0,0,0,0.4)', zIndex: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {isSharing && (
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse 2s infinite' }} />
                        )}
                        <h2 id="screen-share-modal-title" style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'white' }}>
                            {isSharing ? 'Your Screen' : 'Share Your Screen'}
                        </h2>
                        {isSharing && (
                            <>
                                <span style={{ background: 'var(--accent-primary)', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'white' }}>Live</span>
                                <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8, fontVariantNumeric: 'tabular-nums' }}>{formatTime(elapsedTime)}</span>
                            </>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 16, color: 'var(--text-secondary)' }}>
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

                {/* Body */}
                <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}>
                    <div style={{
                        flex: 1,
                        background: 'linear-gradient(135deg, #1e1e2d, #14141c)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--stroke)',
                        position: 'relative',
                        overflow: 'hidden',
                        display: 'flex',
                    }}>
                        {/* Live preview when sharing */}
                        {isSharing && (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                {localScreenTrack ? (
                                    <video
                                        ref={previewVideoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
                                    />
                                ) : (
                                    <div style={{ textAlign: 'center', padding: 40 }}>
                                        <Loader2 size={36} style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite', marginBottom: 12 }} />
                                        <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Acquiring your screen…</div>
                                    </div>
                                )}
                                <div style={{
                                    position: 'absolute', top: 12, left: 12,
                                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)',
                                    padding: '6px 12px', borderRadius: 9999, fontSize: 12,
                                    display: 'flex', gap: 12, color: 'white', alignItems: 'center',
                                }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                                        Sharing · {formatTime(elapsedTime)}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Picker (pre-share) — B5 hero preview layout */}
                        {!isSharing && !isStarting && (() => {
                            const heroSource = (hoveredSourceId
                                ? desktopSources.find((s) => s.id === hoveredSourceId)
                                : null) ?? (selectedSourceId
                                ? desktopSources.find((s) => s.id === selectedSourceId)
                                : null);
                            const showSplit = isDesktop && desktopSources.length > 0;
                            return (
                            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                                {/* LEFT — picker list */}
                                <div style={{ flex: showSplit ? '0 0 58%' : 1, padding: 24, overflowY: 'auto', borderRight: showSplit ? '1px solid var(--stroke)' : 'none' }}>
                                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                                    <MonitorUp size={40} style={{ color: 'rgba(255,255,255,0.2)', marginBottom: 12 }} />
                                    <h3 style={{ fontSize: 18, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', marginBottom: 6 }}>
                                        Share Your Screen
                                    </h3>
                                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto' }}>
                                        {isDesktop
                                            ? 'Pick a screen or specific application window. Hover any source to preview it on the right.'
                                            : 'Your browser will prompt you to choose what to share.'}
                                    </p>
                                </div>

                                {shareError && (
                                    <p style={{ fontSize: 13, color: 'var(--error)', marginBottom: 12, textAlign: 'center' }}>{shareError}</p>
                                )}

                                {isDesktop && (
                                    <>
                                        {/* Tabs */}
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                                            <button type="button" onClick={() => setPickerTab('screen')} style={tabBtnStyle(pickerTab === 'screen')}>
                                                <Monitor size={14} /> Entire Screen
                                                {counts.screen > 0 && (
                                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>{counts.screen}</span>
                                                )}
                                            </button>
                                            <button type="button" onClick={() => setPickerTab('window')} style={tabBtnStyle(pickerTab === 'window')}>
                                                <AppWindow size={14} /> Application Window
                                                {counts.window > 0 && (
                                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>{counts.window}</span>
                                                )}
                                            </button>
                                        </div>

                                        {/* Search (only when many) */}
                                        {desktopSources.length > 8 && (
                                            <div style={{ maxWidth: 360, margin: '0 auto 14px', position: 'relative' }}>
                                                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                                <input
                                                    type="text"
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    placeholder="Search screens or apps…"
                                                    style={{
                                                        width: '100%',
                                                        padding: '8px 10px 8px 30px',
                                                        borderRadius: 8,
                                                        border: '1px solid var(--stroke)',
                                                        background: 'var(--bg-tertiary)',
                                                        color: 'var(--text-primary)',
                                                        fontSize: 13,
                                                    }}
                                                />
                                            </div>
                                        )}

                                        {/* Loading */}
                                        {loadingSources && desktopSources.length === 0 && (
                                            <div style={{ textAlign: 'center', padding: 24 }}>
                                                <Loader2 size={24} style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
                                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>Loading screens and windows…</p>
                                            </div>
                                        )}

                                        {/* Screen tab grid */}
                                        {pickerTab === 'screen' && visibleSources.length > 0 && (
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                                                gap: 12,
                                                maxWidth: 760,
                                                margin: '0 auto 18px',
                                            }}>
                                                {visibleSources.map(renderSourceCard)}
                                            </div>
                                        )}

                                        {/* Window tab grouped grid */}
                                        {pickerTab === 'window' && groupedWindows && groupedWindows.length > 0 && (
                                            <div style={{ maxWidth: 760, margin: '0 auto 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                                                {groupedWindows.map(([app, items]) => (
                                                    <div key={app}>
                                                        <div style={{
                                                            fontSize: 11,
                                                            textTransform: 'uppercase',
                                                            letterSpacing: 0.5,
                                                            color: 'var(--text-muted)',
                                                            marginBottom: 8,
                                                            fontWeight: 600,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 6,
                                                        }}>
                                                            {items[0]?.appIconDataUrl && (
                                                                <img src={items[0].appIconDataUrl} alt="" style={{ width: 14, height: 14 }} />
                                                            )}
                                                            {app} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {items.length}</span>
                                                        </div>
                                                        <div style={{
                                                            display: 'grid',
                                                            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                                            gap: 10,
                                                        }}>
                                                            {items.map(renderSourceCard)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Empty state */}
                                        {!loadingSources && visibleSources.length === 0 && (
                                            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
                                                {pickerTab === 'screen'
                                                    ? 'No screens detected. Try plugging in a display or restarting the app.'
                                                    : searchQuery
                                                        ? 'No matching application windows.'
                                                        : 'No application windows detected. Open an app and try again.'}
                                            </div>
                                        )}
                                    </>
                                )}

                                {!showSplit && (
                                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                                        <button
                                            onClick={handleStart}
                                            disabled={isDesktop && !selectedSourceId}
                                            style={{
                                                padding: '12px 32px',
                                                borderRadius: 8,
                                                border: 'none',
                                                background: (isDesktop && !selectedSourceId) ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
                                                color: (isDesktop && !selectedSourceId) ? 'var(--text-muted)' : 'white',
                                                fontSize: 15,
                                                fontWeight: 600,
                                                cursor: (isDesktop && !selectedSourceId) ? 'not-allowed' : 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 8,
                                            }}
                                            className={(!isDesktop || selectedSourceId) ? 'hover-opacity-dim' : ''}
                                        >
                                            <MonitorUp size={18} />
                                            Start Sharing
                                        </button>
                                    </div>
                                )}

                                </div>
                                {/* RIGHT — hero preview pane */}
                                {showSplit && (
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 20, gap: 14, minWidth: 0, background: 'rgba(0,0,0,0.25)' }}>
                                        <div style={{ flex: 1, minHeight: 0, position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {heroSource ? (
                                                <>
                                                    <img
                                                        src={heroSource.thumbnailDataUrl}
                                                        alt={heroSource.name}
                                                        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                                                    />
                                                    <div style={{ position: 'absolute', top: 10, left: 10, padding: '4px 8px', background: 'rgba(0,0,0,0.65)', borderRadius: 6, fontSize: 11, color: 'white', display: 'inline-flex', alignItems: 'center', gap: 6, backdropFilter: 'blur(8px)' }}>
                                                        {heroSource.type === 'window' ? <AppWindow size={11} /> : <Monitor size={11} />}
                                                        {heroSource.type === 'window' ? 'Window' : 'Screen'}
                                                        {hoveredSourceId && hoveredSourceId !== selectedSourceId && (
                                                            <span style={{ marginLeft: 6, opacity: 0.7 }}>· hovering</span>
                                                        )}
                                                    </div>
                                                </>
                                            ) : (
                                                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 20 }}>
                                                    <MonitorUp size={32} style={{ opacity: 0.3, marginBottom: 10 }} />
                                                    <div>Hover or select a source to preview</div>
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 28 }}>
                                            {heroSource?.appIconDataUrl && (
                                                <img src={heroSource.appIconDataUrl} alt="" style={{ width: 18, height: 18, flexShrink: 0 }} />
                                            )}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {heroSource?.name ?? 'No source selected'}
                                                </div>
                                                {heroSource?.appName && (
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {heroSource.appName}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleStart}
                                            disabled={isDesktop && !selectedSourceId}
                                            style={{
                                                padding: '12px 24px',
                                                borderRadius: 8,
                                                border: 'none',
                                                background: (isDesktop && !selectedSourceId) ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
                                                color: (isDesktop && !selectedSourceId) ? 'var(--text-muted)' : 'white',
                                                fontSize: 15,
                                                fontWeight: 600,
                                                cursor: (isDesktop && !selectedSourceId) ? 'not-allowed' : 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 8,
                                                transition: 'all 0.2s',
                                            }}
                                            className={(!isDesktop || selectedSourceId) ? 'hover-opacity-dim' : ''}
                                        >
                                            <MonitorUp size={18} />
                                            Start sharing{heroSource?.name ? ` “${heroSource.name.length > 20 ? heroSource.name.slice(0, 20) + '…' : heroSource.name}”` : ''}
                                        </button>
                                    </div>
                                )}
                            </div>
                            );
                        })()}

                        {/* Loading state */}
                        {isStarting && (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                                <Loader2 size={40} style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite', marginBottom: 16 }} />
                                <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Starting screen share…</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom controls */}
                {isSharing && (
                    <div style={{ padding: 20, display: 'flex', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', borderTop: '1px solid var(--stroke)' }}>
                        <button
                            style={{
                                height: 48, padding: '0 24px', borderRadius: 24,
                                background: '#ef4444', border: 'none', color: 'white', fontWeight: 600,
                                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'background 0.2s'
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
