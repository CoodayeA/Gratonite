import { useTheme } from './ThemeProvider';

export type MediaType = 'image' | 'video';

const mediaStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    zIndex: 0,
    pointerEvents: 'none',
};

const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'rgba(0, 0, 0, 0.2)',
    backdropFilter: 'blur(4px)',
    zIndex: 1,
    pointerEvents: 'none',
};

export const BackgroundMedia = ({ media }: { media: { url: string, type: MediaType } | null }) => {
    const { showChannelBackgrounds, playMovingBackgrounds } = useTheme();

    if (!media || !showChannelBackgrounds) return null;

    return (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0, pointerEvents: 'none' }}>
            {media.type === 'video' ? (
                <video
                    src={media.url}
                    autoPlay={playMovingBackgrounds}
                    loop
                    muted
                    playsInline
                    style={mediaStyle}
                />
            ) : (
                <img src={media.url} alt="Background" style={mediaStyle} />
            )}
            <div style={overlayStyle} />
        </div>
    );
};
