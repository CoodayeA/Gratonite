import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * AuroraBackdrop — Gratonite's signature animated call backdrop.
 *
 * A full-bleed, soft animated gradient layer that sits BEHIND call participant
 * tiles. It "reacts" to who is speaking by shifting hue toward warm/cool
 * accents and pulsing intensity. Intentionally low-frequency (CSS keyframes,
 * no JS rAF loops) so it adds zero perceptible cost.
 *
 * Designed to be dropped inside a `position: relative` parent. Use it as the
 * first child so participant tiles render on top.
 *
 * Honors `prefers-reduced-motion` and pauses when the document is hidden.
 */
export interface AuroraBackdropProps {
    /** True if any participant in the call is currently speaking. */
    anyoneSpeaking: boolean;
    /** Total participant count, drives intensity (more people = livelier). */
    participantCount: number;
    /** True when a screen share is being broadcast — fades to a calmer state. */
    isScreenSharing?: boolean;
    /** Force the aurora off (e.g. low-power mode setting). */
    disabled?: boolean;
}

const STYLE_ID = 'gratonite-aurora-backdrop-styles';

function ensureStylesInjected() {
    if (typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
@keyframes gratonite-aurora-drift {
    0%   { transform: translate(-12%, -8%)  scale(1.05); }
    25%  { transform: translate(8%, -4%)    scale(1.12); }
    50%  { transform: translate(10%, 10%)   scale(1.05); }
    75%  { transform: translate(-6%, 6%)    scale(1.10); }
    100% { transform: translate(-12%, -8%)  scale(1.05); }
}
@keyframes gratonite-aurora-drift-2 {
    0%   { transform: translate(15%, 10%)   scale(0.95); }
    33%  { transform: translate(-10%, 5%)   scale(1.08); }
    66%  { transform: translate(0%, -10%)   scale(1.0); }
    100% { transform: translate(15%, 10%)   scale(0.95); }
}
@keyframes gratonite-aurora-pulse {
    0%, 100% { opacity: var(--aurora-base, 0.55); }
    50%      { opacity: var(--aurora-peak, 0.85); }
}
.gratonite-aurora-root {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    z-index: 0;
    border-radius: inherit;
}
.gratonite-aurora-blob {
    position: absolute;
    inset: -25%;
    border-radius: 50%;
    filter: blur(80px);
    will-change: transform, opacity;
    mix-blend-mode: screen;
}
.gratonite-aurora-blob.b1 {
    background: radial-gradient(circle at 30% 30%,
        rgba(99, 102, 241, 0.7),
        rgba(99, 102, 241, 0) 60%);
    animation: gratonite-aurora-drift 22s ease-in-out infinite,
               gratonite-aurora-pulse 6s ease-in-out infinite;
}
.gratonite-aurora-blob.b2 {
    background: radial-gradient(circle at 70% 70%,
        rgba(67, 181, 129, 0.55),
        rgba(67, 181, 129, 0) 60%);
    animation: gratonite-aurora-drift-2 28s ease-in-out infinite,
               gratonite-aurora-pulse 8s ease-in-out infinite;
    animation-delay: -3s, -2s;
}
.gratonite-aurora-blob.b3 {
    background: radial-gradient(circle at 50% 20%,
        rgba(236, 72, 153, 0.45),
        rgba(236, 72, 153, 0) 60%);
    animation: gratonite-aurora-drift 30s ease-in-out infinite,
               gratonite-aurora-pulse 10s ease-in-out infinite;
    animation-delay: -7s, -4s;
}
.gratonite-aurora-grain {
    position: absolute;
    inset: 0;
    opacity: 0.06;
    mix-blend-mode: overlay;
    background-image: radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px);
    background-size: 3px 3px;
    pointer-events: none;
}
.gratonite-aurora-root.is-speaking .gratonite-aurora-blob.b1 {
    animation-duration: 14s, 3.5s;
}
.gratonite-aurora-root.is-speaking .gratonite-aurora-blob.b2 {
    animation-duration: 18s, 4.5s;
}
.gratonite-aurora-root.is-screen-sharing .gratonite-aurora-blob {
    opacity: 0.35;
    animation-duration: 40s, 14s !important;
}
.gratonite-aurora-root.is-paused .gratonite-aurora-blob {
    animation-play-state: paused;
}
@media (prefers-reduced-motion: reduce) {
    .gratonite-aurora-root .gratonite-aurora-blob {
        animation: none !important;
        opacity: 0.4;
    }
}
`;
    document.head.appendChild(style);
}

export default function AuroraBackdrop({
    anyoneSpeaking,
    participantCount,
    isScreenSharing = false,
    disabled = false,
}: AuroraBackdropProps) {
    const [isVisible, setIsVisible] = useState(true);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        ensureStylesInjected();
    }, []);

    // Pause animation when tab is hidden to save CPU.
    useEffect(() => {
        const onVis = () => setIsVisible(!document.hidden);
        document.addEventListener('visibilitychange', onVis);
        return () => document.removeEventListener('visibilitychange', onVis);
    }, []);

    const styleVars = useMemo<React.CSSProperties>(() => {
        // More participants = livelier base; speaking = stronger peak.
        const base = Math.min(0.45 + participantCount * 0.04, 0.7);
        const peak = anyoneSpeaking ? 0.95 : Math.min(base + 0.2, 0.85);
        return {
            ['--aurora-base' as string]: String(base),
            ['--aurora-peak' as string]: String(peak),
        };
    }, [anyoneSpeaking, participantCount]);

    if (disabled) return null;

    const cls = [
        'gratonite-aurora-root',
        anyoneSpeaking ? 'is-speaking' : '',
        isScreenSharing ? 'is-screen-sharing' : '',
        isVisible ? '' : 'is-paused',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div ref={rootRef} className={cls} style={styleVars} aria-hidden="true">
            <div className="gratonite-aurora-blob b1" />
            <div className="gratonite-aurora-blob b2" />
            <div className="gratonite-aurora-blob b3" />
            <div className="gratonite-aurora-grain" />
        </div>
    );
}
