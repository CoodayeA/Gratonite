import { useState, useRef, useCallback, useEffect, Suspense, lazy } from 'react';
import { X, Columns } from 'lucide-react';

const LazyChannelChat = lazy(() => import('../pages/guilds/ChannelChat'));

const SPLIT_VIEW_KEY = 'gratonite-split-view';

interface SplitViewState {
    enabled: boolean;
    rightChannelId: string | null;
    rightGuildId: string | null;
    dividerPosition: number; // percentage
}

function getSplitState(): SplitViewState {
    try {
        const raw = localStorage.getItem(SPLIT_VIEW_KEY);
        return raw ? JSON.parse(raw) : { enabled: false, rightChannelId: null, rightGuildId: null, dividerPosition: 50 };
    } catch {
        return { enabled: false, rightChannelId: null, rightGuildId: null, dividerPosition: 50 };
    }
}

function saveSplitState(state: SplitViewState) {
    localStorage.setItem(SPLIT_VIEW_KEY, JSON.stringify(state));
}

export function useSplitView() {
    const [splitState, setSplitState] = useState<SplitViewState>(getSplitState);

    // Listen for split-view-update events dispatched from context menus
    useEffect(() => {
        const handler = () => setSplitState(getSplitState());
        window.addEventListener('split-view-update', handler);
        return () => window.removeEventListener('split-view-update', handler);
    }, []);

    const openSplitView = useCallback((channelId: string, guildId: string) => {
        const newState: SplitViewState = { enabled: true, rightChannelId: channelId, rightGuildId: guildId, dividerPosition: 50 };
        setSplitState(newState);
        saveSplitState(newState);
    }, []);

    const closeSplitView = useCallback(() => {
        const newState: SplitViewState = { enabled: false, rightChannelId: null, rightGuildId: null, dividerPosition: 50 };
        setSplitState(newState);
        saveSplitState(newState);
    }, []);

    const setDividerPosition = useCallback((pos: number) => {
        setSplitState(prev => {
            const newState = { ...prev, dividerPosition: Math.max(25, Math.min(75, pos)) };
            saveSplitState(newState);
            return newState;
        });
    }, []);

    return { splitState, openSplitView, closeSplitView, setDividerPosition };
}

interface SplitViewContainerProps {
    leftContent: React.ReactNode;
    rightContent: React.ReactNode;
    dividerPosition: number;
    onDividerChange: (pos: number) => void;
    onClose: () => void;
}

export const SplitViewContainer = ({
    leftContent, rightContent, dividerPosition, onDividerChange, onClose
}: SplitViewContainerProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isDraggingRef.current = true;
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDraggingRef.current || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const pos = ((e.clientX - rect.left) / rect.width) * 100;
            onDividerChange(pos);
        };
        const handleMouseUp = () => { isDraggingRef.current = false; };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [onDividerChange]);

    return (
        <div ref={containerRef} style={{ display: 'flex', width: '100%', height: '100%', position: 'relative' }}>
            {/* Left pane */}
            <div style={{ width: `${dividerPosition}%`, height: '100%', overflow: 'hidden', position: 'relative' }}>
                {leftContent}
            </div>

            {/* Divider */}
            <div
                onMouseDown={handleMouseDown}
                style={{
                    width: '4px', cursor: 'col-resize',
                    background: 'var(--stroke)', position: 'relative',
                    flexShrink: 0, zIndex: 10,
                    transition: isDraggingRef.current ? 'none' : 'background 0.15s',
                }}
                className="hover-accent-divider"
            />

            {/* Right pane */}
            <div style={{ width: `${100 - dividerPosition}%`, height: '100%', overflow: 'hidden', position: 'relative' }}>
                {/* Close button for split view */}
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute', top: '8px', right: '8px', zIndex: 20,
                        background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                        borderRadius: '6px', width: '28px', height: '28px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: 'var(--text-muted)',
                        transition: 'all 0.15s',
                    }}
                    className="hover-close-error"
                    title="Close split view"
                >
                    <X size={14} />
                </button>
                {rightContent}
            </div>
        </div>
    );
};

/** Button to trigger split view from context menu or toolbar */
export const SplitViewButton = ({ onClick }: { onClick: () => void }) => (
    <button
        onClick={onClick}
        style={{
            background: 'transparent', border: 'none',
            color: 'var(--text-muted)', cursor: 'pointer',
            padding: '4px', display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '13px', fontWeight: 500,
        }}
        title="Open in Split View"
    >
        <Columns size={16} /> Split View
    </button>
);

/**
 * Renders a ChannelChat instance directly with props for channelId/guildId
 * instead of relying on useParams from a nested router.
 */
export const SplitViewRightPane = ({
    channelId,
    guildId,
}: {
    channelId: string;
    guildId: string;
    outletContext?: Record<string, unknown>;
}) => (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>Loading...</div>}>
        <LazyChannelChat channelIdProp={channelId} guildIdProp={guildId} />
    </Suspense>
);
