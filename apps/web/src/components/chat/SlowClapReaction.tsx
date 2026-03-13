import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
    onClap: () => void;
}

export function SlowClapReaction({ onClap }: Props) {
    const [crescendo, setCrescendo] = useState(false);
    const [clapCount, setClapCount] = useState(0);
    const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number }>>([]);
    const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const crescendoRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const counterRef = useRef(0);

    const startCrescendo = () => {
        setCrescendo(true);
        setClapCount(1);
        let count = 1;
        crescendoRef.current = setInterval(() => {
            count++;
            setClapCount(count);
            // Add particle
            counterRef.current++;
            setParticles(prev => [...prev, {
                id: counterRef.current,
                x: (Math.random() - 0.5) * 60,
                y: -(Math.random() * 40 + 10),
            }]);
            if (count >= 5) {
                if (crescendoRef.current) clearInterval(crescendoRef.current);
            }
        }, 400);
    };

    const handleMouseDown = () => {
        pressTimerRef.current = setTimeout(() => {
            startCrescendo();
        }, 500);
    };

    const handleMouseUp = () => {
        if (pressTimerRef.current) {
            clearTimeout(pressTimerRef.current);
            pressTimerRef.current = null;
        }
        if (crescendoRef.current) {
            clearInterval(crescendoRef.current);
            crescendoRef.current = null;
        }
        if (!crescendo) {
            // Single click
            onClap();
        } else {
            // Crescendo finished — fire the reaction
            onClap();
            setTimeout(() => {
                setCrescendo(false);
                setClapCount(0);
                setParticles([]);
            }, 800);
        }
    };

    // Auto-clean particles
    React.useEffect(() => {
        if (particles.length > 0) {
            const timer = setTimeout(() => setParticles([]), 2000);
            return () => clearTimeout(timer);
        }
    }, [particles]);

    return (
        <div
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
                if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
            }}
        >
            <motion.span
                animate={crescendo ? { scale: [1, 1.3, 1.5] } : { scale: 1 }}
                transition={{ duration: 0.3 }}
                style={{ fontSize: '18px', userSelect: 'none' }}
            >
                {String.fromCodePoint(0x1F44F)}
            </motion.span>
            {crescendo && clapCount > 0 && (
                <motion.span
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{
                        position: 'absolute', top: '-16px', right: '-8px',
                        fontSize: '10px', fontWeight: 700, color: 'var(--warning)',
                        background: 'var(--bg-elevated)', borderRadius: '8px',
                        padding: '1px 4px',
                    }}
                >
                    x{clapCount}
                </motion.span>
            )}
            <AnimatePresence>
                {particles.map(p => (
                    <motion.span
                        key={p.id}
                        initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                        animate={{ opacity: 0, x: p.x, y: p.y, scale: 0.5 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8 }}
                        style={{
                            position: 'absolute', pointerEvents: 'none',
                            fontSize: '12px',
                        }}
                    >
                        {String.fromCodePoint(0x1F44F)}
                    </motion.span>
                ))}
            </AnimatePresence>
            {crescendo && clapCount >= 5 && (
                <motion.span
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: -20 }}
                    style={{
                        position: 'absolute', left: '50%', transform: 'translateX(-50%)',
                        fontSize: '10px', fontWeight: 700, color: 'var(--accent-primary)',
                        whiteSpace: 'nowrap', pointerEvents: 'none',
                    }}
                >
                    Applause!
                </motion.span>
            )}
        </div>
    );
}
