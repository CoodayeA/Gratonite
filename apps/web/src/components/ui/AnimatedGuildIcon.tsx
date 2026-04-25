import { memo } from 'react';

interface AnimatedGuildIconProps {
    src?: string;
    alt: string;
    /** Single-letter fallback shown in the orbital center when no custom icon exists */
    letter?: string;
}

/**
 * Guild icon rendered as orbital system: central glowing orb with orbiting satellite.
 * Creates dynamic sci-fi aesthetic with continuous orbital motion.
 * Satellites represent active guild members or ongoing activity.
 */
const AnimatedGuildIcon = memo(({ src, alt, letter }: AnimatedGuildIconProps) => {
    // Deterministic color/orbit-radius/speed from src or alt so each guild looks distinct
    const seed = src || alt;
    const hashOf = (str: string): number => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash = hash & hash;
        }
        return Math.abs(hash);
    };
    const h = hashOf(seed);
    const colors = ['#ff00ff', '#00ffff', '#ffff00', '#00ff88', '#ff0088', '#00d4ff', '#ff8800', '#aaff00'];
    const satelliteColor = colors[h % colors.length];
    const orbitDuration = 3 + (h % 4); // 3s..6s
    const orbitRadius = 16 + (h % 4); // 16..19px
    const satelliteSize = 7 + (h % 3); // 7..9px

    return (
        <div className="guild-icon-orbital" title={alt} aria-label={alt}>
            <div className="orb-center">
                {!src && letter && <span className="orb-letter">{letter}</span>}
            </div>
            <div
                className="orb-satellite"
                style={{
                    background: satelliteColor,
                    boxShadow: `0 0 8px ${satelliteColor}`,
                    width: `${satelliteSize}px`,
                    height: `${satelliteSize}px`,
                    animationDuration: `${orbitDuration}s`,
                    ['--orbit-radius' as any]: `${orbitRadius}px`,
                }}
            />
        </div>
    );
});

AnimatedGuildIcon.displayName = 'AnimatedGuildIcon';

export default AnimatedGuildIcon;
