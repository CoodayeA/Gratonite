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
    // Use independent byte-derived offsets so two guilds rarely share both color AND timing
    const h2 = hashOf(seed + '#sat');
    const h3 = hashOf(seed + '#delay');
    const colors = ['#ff3df0', '#00ffff', '#ffe600', '#00ff88', '#ff5588', '#5ab8ff', '#ff8800', '#aaff66', '#c084ff'];
    const satelliteColor = colors[h2 % colors.length];
    // Planet hue (HSL) — seeded so each guild's central orb is its own color
    const planetHue = h % 360;
    const orbitDuration = 4 + (h % 5); // 4s..8s — slower so motion reads as "orbit" not "spin"
    const orbitRadius = 19 + (h2 % 5); // 19..23px
    const satelliteSize = 7 + (h2 % 3); // 7..9px
    // Negative delay desynchronizes phase so satellites aren't all at the same orbital position
    const orbitDelay = -((h3 % 1000) / 1000) * orbitDuration; // -0..-duration seconds

    return (
        <div className="guild-icon-orbital" title={alt} aria-label={alt}>
            <div
                className="orb-center"
                style={{ ['--planet-hue' as any]: `${planetHue}` }}
            >
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
                    animationDelay: `${orbitDelay}s`,
                    ['--orbit-radius' as any]: `${orbitRadius}px`,
                }}
            />
        </div>
    );
});

AnimatedGuildIcon.displayName = 'AnimatedGuildIcon';

export default AnimatedGuildIcon;
