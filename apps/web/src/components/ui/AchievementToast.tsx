import React, { useState, useEffect, useCallback } from 'react';

import { playSound } from '../../utils/SoundManager';

export type Achievement = {
    id: string;
    title: string;
    description: string;
    icon?: React.ReactNode;
    rarity?: 'common' | 'rare' | 'epic' | 'legendary';
    points?: number;
};

type QueuedAchievement = Achievement & { key: number };

// Singleton event bus
const listeners: Set<(a: Achievement) => void> = new Set();

export function triggerAchievement(a: Achievement) {
    listeners.forEach(fn => fn(a));
}

// Pre-defined achievements
export const ACHIEVEMENTS: Record<string, Achievement> = {
    firstMessage:   { id: 'firstMessage',   title: 'First Words',      description: 'Sent your first message',             icon: '💬', rarity: 'common',    points: 10 },
    gachaLegendary: { id: 'gachaLegendary', title: 'LEGENDARY PULL!',  description: 'Pulled a Legendary from the Gacha',   icon: '🌟', rarity: 'legendary', points: 100 },
    fameGiven:      { id: 'fameGiven',       title: 'Spreading Kindness', description: 'Gave FAME to a community member',   icon: '⭐', rarity: 'rare',      points: 25 },
    fameReceived:   { id: 'fameReceived',    title: 'Community Star',   description: 'Received your first FAME',            icon: '✨', rarity: 'rare',      points: 50 },
    joinedGuild:    { id: 'joinedGuild',     title: 'New Member',       description: 'Joined your first portal',            icon: '🚀', rarity: 'common',    points: 10 },
    shopPurchase:   { id: 'shopPurchase',    title: 'First Purchase',   description: 'Bought your first item from the Shop', icon: '🛒', rarity: 'common',    points: 15 },
    customTheme:    { id: 'customTheme',     title: 'Style Icon',       description: 'Applied a custom theme',               icon: '🎨', rarity: 'rare',      points: 20 },
    voiceChat:      { id: 'voiceChat',       title: 'Voice of Reason',  description: 'Joined a voice channel',              icon: '🎙️', rarity: 'common',   points: 10 },
    highFame:       { id: 'highFame',        title: 'FAME Legend',      description: 'Reached 1000 FAME received',          icon: '👑', rarity: 'legendary', points: 200 },
};

const rarityColors: Record<string, string> = {
    common:    '#6b7280',
    rare:      '#3b82f6',
    epic:      '#8b5cf6',
    legendary: '#f59e0b',
};

const rarityLabels: Record<string, string> = {
    common:    'Achievement Unlocked',
    rare:      'Rare Achievement!',
    epic:      'Epic Achievement!',
    legendary: '✦ LEGENDARY ACHIEVEMENT ✦',
};

const AchievementCard = ({ achievement, onDone }: { achievement: QueuedAchievement; onDone: () => void }) => {
    const rarity = achievement.rarity || 'common';
    const color = rarityColors[rarity];

    useEffect(() => {
        playSound('achievement');
        const timer = setTimeout(onDone, 4200);
        return () => clearTimeout(timer);
    }, [onDone]);

    return (
        <div className="achievement-popup" style={{
            width: '320px',
            background: 'var(--bg-elevated)',
            borderRadius: '14px',
            border: `1px solid ${color}`,
            boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 24px ${color}44`,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
        }}>
            {/* Rarity stripe */}
            <div style={{ height: '3px', background: color }} />

            <div style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                {/* Icon */}
                <div style={{
                    width: '52px', height: '52px', borderRadius: '12px', flexShrink: 0,
                    background: `linear-gradient(135deg, ${color}33, ${color}11)`,
                    border: `1px solid ${color}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '24px'
                }}>
                    {achievement.icon}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '10px', fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>
                        {rarityLabels[rarity]}
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>
                        {achievement.title}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {achievement.description}
                    </div>
                </div>

                {achievement.points && (
                    <div style={{ fontSize: '13px', fontWeight: 800, color, whiteSpace: 'nowrap' }}>
                        +{achievement.points} XP
                    </div>
                )}
            </div>

            {/* Progress bar decay */}
            <div style={{ height: '2px', background: 'var(--bg-tertiary)' }}>
                <div style={{
                    height: '100%',
                    background: color,
                    animation: 'achievementDecay 4s linear forwards',
                }} />
            </div>
        </div>
    );
};

export const AchievementToastProvider = ({ children }: { children: React.ReactNode }) => {
    const [queue, setQueue] = useState<QueuedAchievement[]>([]);
    const counter = React.useRef(0);

    const onAchievement = useCallback((a: Achievement) => {
        setQueue(q => [...q, { ...a, key: ++counter.current }]);
    }, []);

    useEffect(() => {
        listeners.add(onAchievement);
        return () => { listeners.delete(onAchievement); };
    }, [onAchievement]);

    const dismiss = useCallback((key: number) => {
        setQueue(q => q.filter(a => a.key !== key));
    }, []);

    return (
        <>
            {children}
            <style>{`
                @keyframes achievementDecay {
                    from { width: 100%; }
                    to   { width: 0%; }
                }
            `}</style>
            {queue.slice(0, 3).map(a => (
                <AchievementCard key={a.key} achievement={a} onDone={() => dismiss(a.key)} />
            ))}
        </>
    );
};

export default AchievementToastProvider;
