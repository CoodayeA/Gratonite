import { memo } from 'react';

interface AnimatedGuildIconProps {
    src: string;
    alt: string;
}

/**
 * Guild icon rendered as orbital system: central glowing orb with orbiting satellite.
 * Creates dynamic sci-fi aesthetic with continuous orbital motion.
 * Satellites represent active guild members or ongoing activity.
 */
const AnimatedGuildIcon = memo(({ src, alt }: AnimatedGuildIconProps) => {
    // Extract a deterministic color from src URL for satellite color variation
    const getColorFromSrc = (url: string): string => {
        let hash = 0;
        for (let i = 0; i < url.length; i++) {
            const char = url.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        // Map hash to magenta, cyan, yellow, lime range
        const colors = ['#ff00ff', '#00ffff', '#ffff00', '#00ff88', '#ff0088', '#00d4ff'];
        return colors[Math.abs(hash) % colors.length];
    };

    const satelliteColor = getColorFromSrc(src);

    return (
        <div className="guild-icon-orbital" title={alt}>
            {/* Central glowing orb */}
            <div className="orb-center" />
            
            {/* Orbiting satellite */}
            <div
                className="orb-satellite"
                style={{ background: satelliteColor, boxShadow: `0 0 8px ${satelliteColor}` }}
            />
        </div>
    );
});

AnimatedGuildIcon.displayName = 'AnimatedGuildIcon';

export default AnimatedGuildIcon;
