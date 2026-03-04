import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import { triggerAchievement, ACHIEVEMENTS } from './AchievementToast';
import { playSound } from '../../utils/SoundManager';

type RevealItem = {
    id: number | string;
    name: string;
    rarity: 'Legendary' | 'Epic' | 'Rare' | 'Uncommon' | 'Common';
    image: string;
};

interface GachaRevealProps {
    items: RevealItem[];
    onClose: () => void;
}

const RARITY_COLORS: Record<string, string> = {
    Legendary: '#f59e0b',
    Epic: '#8b5cf6',
    Rare: '#3b82f6',
    Uncommon: '#10b981',
    Common: '#71717a',
};

interface FireworkParticle {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
    delay: number;
}

const FIREWORK_COLORS = ['#f59e0b', '#fbbf24', '#fcd34d', '#fff', '#8b5cf6', '#ec4899', '#ef4444', '#10b981'];

export const GachaReveal: React.FC<GachaRevealProps> = ({ items, onClose }) => {
    const [phase, setPhase] = useState<'shake' | 'flash' | 'reveal'>('shake');
    const [flippedCards, setFlippedCards] = useState<number[]>([]);
    const [showChromatic, setShowChromatic] = useState(false);
    const [fireworks, setFireworks] = useState<FireworkParticle[]>([]);
    const [screenFlashGold, setScreenFlashGold] = useState(false);

    useEffect(() => {
        const flashTimer = setTimeout(() => setPhase('flash'), 2500);
        const revealTimer = setTimeout(() => setPhase('reveal'), 3000);
        return () => {
            clearTimeout(flashTimer);
            clearTimeout(revealTimer);
        };
    }, []);

    const spawnFireworks = useCallback(() => {
        const particles: FireworkParticle[] = [];
        const bursts = [
            { cx: window.innerWidth * 0.25, cy: window.innerHeight * 0.3 },
            { cx: window.innerWidth * 0.5, cy: window.innerHeight * 0.2 },
            { cx: window.innerWidth * 0.75, cy: window.innerHeight * 0.35 },
        ];

        bursts.forEach((burst, bi) => {
            for (let i = 0; i < 30; i++) {
                const angle = (i / 30) * Math.PI * 2 + Math.random() * 0.3;
                const speed = 120 + Math.random() * 180;
                particles.push({
                    id: bi * 100 + i + Date.now(),
                    x: burst.cx,
                    y: burst.cy,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 40,
                    color: FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
                    size: 3 + Math.random() * 5,
                    delay: bi * 200,
                });
            }
        });

        setFireworks(particles);

        // Second wave
        setTimeout(() => {
            const wave2: FireworkParticle[] = [];
            const bursts2 = [
                { cx: window.innerWidth * 0.35, cy: window.innerHeight * 0.25 },
                { cx: window.innerWidth * 0.65, cy: window.innerHeight * 0.3 },
            ];
            bursts2.forEach((burst, bi) => {
                for (let i = 0; i < 25; i++) {
                    const angle = (i / 25) * Math.PI * 2 + Math.random() * 0.4;
                    const speed = 100 + Math.random() * 150;
                    wave2.push({
                        id: (bi + 10) * 100 + i + Date.now(),
                        x: burst.cx,
                        y: burst.cy,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed - 30,
                        color: FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
                        size: 2 + Math.random() * 4,
                        delay: 0,
                    });
                }
            });
            setFireworks(prev => [...prev, ...wave2]);
        }, 600);

        setTimeout(() => setFireworks([]), 2500);
    }, []);

    const flipCard = (index: number) => {
        if (!flippedCards.includes(index)) {
            setFlippedCards(prev => [...prev, index]);
            const item = items[index];
            playSound('gachaReveal');
            if (item.rarity === 'Legendary') {
                playSound('gachaLegendary');
                setShowChromatic(true);
                setScreenFlashGold(true);
                setTimeout(() => setShowChromatic(false), 1200);
                setTimeout(() => setScreenFlashGold(false), 800);
                triggerAchievement(ACHIEVEMENTS.gachaLegendary);
                document.body.style.animation = 'screenShake 0.5s ease';
                setTimeout(() => { document.body.style.animation = ''; }, 500);
                spawnFireworks();
            }
        }
    };

    const allFlipped = flippedCards.length === items.length;

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(10px)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            overflow: 'hidden',
            ...(showChromatic ? { animation: 'chromaticAberration 1s ease-in-out both' } : {})
        }}>
            {/* Gold flash overlay for legendary */}
            {screenFlashGold && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'radial-gradient(circle, rgba(245,158,11,0.5) 0%, rgba(245,158,11,0.2) 40%, transparent 70%)',
                    animation: 'flashWhite 0.8s ease-out forwards',
                    pointerEvents: 'none',
                    zIndex: 50,
                }} />
            )}

            <style>{`
                @keyframes intenseShake {
                    0% { transform: translate(1px, 1px) rotate(0deg) scale(1); }
                    10% { transform: translate(-1px, -2px) rotate(-1deg) scale(1.05); }
                    20% { transform: translate(-3px, 0px) rotate(1deg) scale(1.1); }
                    30% { transform: translate(3px, 2px) rotate(0deg) scale(1.15); box-shadow: 0 0 40px var(--accent-primary); }
                    40% { transform: translate(1px, -1px) rotate(1deg) scale(1.2); box-shadow: 0 0 60px var(--accent-purple); }
                    50% { transform: translate(-1px, 2px) rotate(-1deg) scale(1.25); box-shadow: 0 0 80px var(--accent-pink); }
                    60% { transform: translate(-3px, 1px) rotate(0deg) scale(1.3); }
                    70% { transform: translate(3px, 1px) rotate(-1deg) scale(1.35); }
                    80% { transform: translate(-1px, -1px) rotate(1deg) scale(1.4); }
                    90% { transform: translate(1px, 2px) rotate(0deg) scale(1.45); }
                    100% { transform: translate(1px, -2px) rotate(-1deg) scale(1.5); box-shadow: 0 0 100px #fff; }
                }
                @keyframes flashWhite {
                    0% { opacity: 0; }
                    50% { opacity: 1; }
                    100% { opacity: 0; }
                }
                .gacha-box {
                    width: 150px; height: 150px;
                    background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
                    border-radius: 24px; display: flex; align-items: center; justify-content: center;
                    border: 4px solid rgba(255,255,255,0.2);
                    animation: intenseShake 2.5s cubic-bezier(.36,.07,.19,.97) both;
                }
                .flash-overlay {
                    position: absolute; inset: 0; z-index: 10; pointer-events: none;
                    background: white; animation: flashWhite 1s ease-out forwards;
                }
                .card-container { perspective: 1000px; width: 200px; height: 300px; cursor: pointer; margin: 0 16px; }
                .card-inner {
                    width: 100%; height: 100%;
                    transition: transform 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    transform-style: preserve-3d; position: relative;
                }
                .card-container.flipped .card-inner { transform: rotateY(180deg); }
                .card-face {
                    position: absolute; width: 100%; height: 100%;
                    backface-visibility: hidden; border-radius: 16px;
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                    border: 2px solid rgba(255,255,255,0.1); overflow: hidden;
                }
                .card-front {
                    background: repeating-linear-gradient(45deg, #1a1a2e, #1a1a2e 10px, #16213e 10px, #16213e 20px);
                }
                .card-front::after { content: '?'; font-size: 64px; font-weight: 800; color: rgba(255,255,255,0.2); }
                .card-back { background: var(--bg-elevated); transform: rotateY(180deg); }
                .foil-effect {
                    position: absolute; inset: 0;
                    background: linear-gradient(125deg, transparent 20%, rgba(255,255,255,0.4) 40%, transparent 60%);
                    background-size: 200% 200%; animation: shimmer 3s infinite linear;
                    pointer-events: none; z-index: 2;
                }
                @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
                .legendary-burst {
                    position: absolute; inset: -50px;
                    background: radial-gradient(circle, rgba(245, 158, 11, 0.4) 0%, transparent 70%);
                    animation: pulse 2s infinite; pointer-events: none; z-index: -1;
                }
                @keyframes fireworkBurst {
                    0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                    50% { opacity: 1; }
                    100% { transform: translate(calc(-50% + var(--fw-vx)), calc(-50% + var(--fw-vy))) scale(0); opacity: 0; }
                }
                @keyframes legendaryCardGlow {
                    0%, 100% { box-shadow: 0 0 20px rgba(245,158,11,0.4), 0 10px 30px rgba(0,0,0,0.5); }
                    50% { box-shadow: 0 0 40px rgba(245,158,11,0.7), 0 0 80px rgba(245,158,11,0.3), 0 10px 30px rgba(0,0,0,0.5); }
                }
            `}</style>

            {phase === 'shake' && (
                <div className="gacha-box">
                    <Sparkles size={64} color="white" />
                </div>
            )}

            {phase === 'flash' && <div className="flash-overlay"></div>}

            {phase === 'reveal' && (
                <>
                    <h2 style={{ fontSize: '32px', marginBottom: '48px', fontFamily: 'var(--font-display)', animation: 'slideDown 0.5s ease' }}>Click to Reveal</h2>
                    <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {items.map((item, index) => {
                            const isFlipped = flippedCards.includes(index);
                            const isLegendary = item.rarity === 'Legendary';
                            const isEpic = item.rarity === 'Epic';
                            const rarityColor = RARITY_COLORS[item.rarity] || 'var(--stroke)';
                            return (
                                <div key={index} className={`card-container ${isFlipped ? 'flipped' : ''}`} onClick={() => flipCard(index)}>
                                    <div className="card-inner">
                                        <div className="card-face card-front"></div>
                                        <div className="card-face card-back" style={{
                                            borderColor: rarityColor,
                                            ...(isLegendary && isFlipped ? { animation: 'legendaryCardGlow 2s infinite' } : {}),
                                        }}>
                                            {isLegendary && <div className="legendary-burst"></div>}
                                            {/* Card image */}
                                            <div style={{
                                                height: '55%', width: '100%',
                                                background: `radial-gradient(circle at 50% 60%, ${rarityColor}15, var(--bg-tertiary))`,
                                                position: 'relative',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                overflow: 'hidden',
                                            }}>
                                                <img
                                                    src={item.image}
                                                    alt={item.name}
                                                    style={{
                                                        maxWidth: '85%', maxHeight: '85%', objectFit: 'contain',
                                                        position: 'relative', zIndex: 1,
                                                        filter: isLegendary ? 'drop-shadow(0 0 12px rgba(245,158,11,0.6))' : isEpic ? 'drop-shadow(0 0 8px rgba(139,92,246,0.5))' : 'none',
                                                    }}
                                                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                />
                                                {(isLegendary || isEpic) && <div className="foil-effect"></div>}
                                            </div>
                                            {/* Card info */}
                                            <div style={{
                                                height: '45%', padding: '16px 20px', textAlign: 'center',
                                                display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px',
                                                borderTop: `1px solid ${rarityColor}30`,
                                            }}>
                                                <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 800, color: rarityColor, letterSpacing: '0.12em' }}>
                                                    {isLegendary ? '\u2605 ' : ''}{item.rarity}{isLegendary ? ' \u2605' : ''}
                                                </div>
                                                <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', lineHeight: 1.2 }}>
                                                    {item.name}
                                                </div>
                                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}>
                                                    Gratonite Guys
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {allFlipped && (
                        <button
                            onClick={onClose}
                            style={{
                                marginTop: '64px', padding: '16px 48px', fontSize: '18px', fontWeight: 700,
                                background: 'white', color: 'black', border: 'none', borderRadius: '32px',
                                cursor: 'pointer', animation: 'scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
                            }}
                        >
                            Collect All
                        </button>
                    )}
                </>
            )}

            {/* Firework particles */}
            {fireworks.map(p => (
                <div
                    key={p.id}
                    style={{
                        position: 'fixed', left: p.x, top: p.y,
                        width: `${p.size}px`, height: `${p.size}px`,
                        borderRadius: '50%', background: p.color,
                        boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
                        pointerEvents: 'none', zIndex: 100,
                        '--fw-vx': `${p.vx}px`,
                        '--fw-vy': `${p.vy}px`,
                        animation: `fireworkBurst 1.2s cubic-bezier(0.22,1,0.36,1) ${p.delay}ms forwards`,
                    } as React.CSSProperties}
                />
            ))}
        </div>
    );
};
