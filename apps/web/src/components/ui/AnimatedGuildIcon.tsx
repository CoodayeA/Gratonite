import { useState, useRef, useEffect, memo } from 'react';

interface AnimatedGuildIconProps {
    src: string;
    alt: string;
}

/**
 * Guild icon that only animates GIF/APNG on hover.
 * Shows a frozen first frame by default.
 * Respects prefers-reduced-motion and the app's reduced-effects class.
 */
const AnimatedGuildIcon = memo(({ src, alt }: AnimatedGuildIconProps) => {
    const [hovered, setHovered] = useState(false);
    const [staticFrame, setStaticFrame] = useState<string | null>(null);
    const isAnimated = /\.(gif|apng)/i.test(src);

    // Check reduced motion preference
    const prefersReducedMotion = typeof window !== 'undefined' && (
        window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        document.documentElement.classList.contains('reduced-effects')
    );

    // Extract first frame for animated images
    useEffect(() => {
        if (!isAnimated) {
            setStaticFrame(null);
            return;
        }

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0);
                    setStaticFrame(canvas.toDataURL('image/png'));
                }
            } catch {
                setStaticFrame(null);
            }
        };
        img.src = src;
    }, [src, isAnimated]);

    // Non-animated or reduced motion with no hover: just show image
    if (!isAnimated || (prefersReducedMotion && !hovered)) {
        return (
            <img
                src={prefersReducedMotion ? (staticFrame || src) : src}
                alt={alt}
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
                onMouseEnter={isAnimated ? () => setHovered(true) : undefined}
                onMouseLeave={isAnimated ? () => setHovered(false) : undefined}
            />
        );
    }

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{ width: '100%', height: '100%', borderRadius: 'inherit', overflow: 'hidden' }}
        >
            <img
                src={hovered || !staticFrame ? src : staticFrame}
                alt={alt}
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
            />
        </div>
    );
});

AnimatedGuildIcon.displayName = 'AnimatedGuildIcon';

export default AnimatedGuildIcon;
