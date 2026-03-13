import React from 'react';
import { Hash, X } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
    channelId: string;
    channelName: string;
    topic?: string | null;
}

export function ChannelWelcomeCard({ channelId, channelName, topic }: Props) {
    const storageKey = 'gratonite:welcomed-channels';

    const isDismissed = () => {
        try {
            const set = JSON.parse(localStorage.getItem(storageKey) || '[]');
            return Array.isArray(set) && set.includes(channelId);
        } catch {
            return false;
        }
    };

    const [dismissed, setDismissed] = React.useState(isDismissed);

    const handleDismiss = () => {
        try {
            const set = JSON.parse(localStorage.getItem(storageKey) || '[]');
            if (!set.includes(channelId)) {
                set.push(channelId);
                localStorage.setItem(storageKey, JSON.stringify(set));
            }
        } catch {
            localStorage.setItem(storageKey, JSON.stringify([channelId]));
        }
        setDismissed(true);
    };

    // Reset dismissed state when channel changes
    React.useEffect(() => {
        setDismissed(isDismissed());
    }, [channelId]);

    if (dismissed) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
                margin: '16px 16px 8px',
                padding: '20px',
                background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 12%, var(--bg-secondary)), var(--bg-secondary))',
                border: '1px solid var(--stroke)',
                borderRadius: '12px',
                position: 'relative',
            }}
        >
            <button
                onClick={handleDismiss}
                style={{
                    position: 'absolute', top: '12px', right: '12px',
                    background: 'none', border: 'none', color: 'var(--text-muted)',
                    cursor: 'pointer', padding: '4px', display: 'flex',
                }}
            >
                <X size={16} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{
                    width: '40px', height: '40px', borderRadius: '12px',
                    background: 'var(--accent-primary)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                }}>
                    <Hash size={20} color="white" />
                </div>
                <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        Welcome to #{channelName}
                    </h3>
                </div>
            </div>
            {topic && (
                <p style={{
                    fontSize: '13px', color: 'var(--text-secondary)', margin: '8px 0 0',
                    lineHeight: '1.5',
                }}>
                    {topic}
                </p>
            )}
            <p style={{
                fontSize: '12px', color: 'var(--text-muted)', margin: '12px 0 0',
            }}>
                This is the start of the #{channelName} channel.
            </p>
            <button
                onClick={handleDismiss}
                style={{
                    marginTop: '12px', padding: '6px 16px', borderRadius: '8px',
                    background: 'var(--accent-primary)', border: 'none',
                    color: 'white', fontSize: '12px', fontWeight: 600,
                    cursor: 'pointer', transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
                Got it
            </button>
        </motion.div>
    );
}
