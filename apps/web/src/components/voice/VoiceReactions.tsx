import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSocket, emitOrQueue } from '../../lib/socket';

interface VoiceReactionsProps {
  channelId: string;
}

interface FloatingEmoji {
  id: string;
  emoji: string;
  x: number;
  username: string;
}

const REACTIONS = [
  { emoji: '\uD83D\uDC4F', label: 'Applause', sound: 'applause' },
  { emoji: '\uD83D\uDE02', label: 'Laugh', sound: 'laugh' },
  { emoji: '\uD83D\uDCEF', label: 'Airhorn', sound: 'airhorn' },
  { emoji: '\uD83E\uDD41', label: 'Drum Roll', sound: 'drumroll' },
  { emoji: '\uD83D\uDE22', label: 'Sad Trombone', sound: 'sadtrombone' },
  { emoji: '\uD83C\uDF89', label: 'Tada', sound: 'tada' },
  { emoji: '\uD83E\uDD97', label: 'Crickets', sound: 'crickets' },
  { emoji: '\uD83D\uDE2E', label: 'Wow', sound: 'wow' },
  { emoji: '\uD83D\uDC4E', label: 'Boo', sound: 'boo' },
  { emoji: '\uD83E\uDD41', label: 'Rimshot', sound: 'rimshot' },
] as const;

const COOLDOWN_MS = 3000;

let emojiCounter = 0;

export function VoiceReactions({ channelId }: VoiceReactionsProps) {
  const [floating, setFloating] = useState<FloatingEmoji[]>([]);
  const [cooldowns, setCooldowns] = useState<Map<string, number>>(new Map());
  const cooldownTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Play sound effect
  const playSound = useCallback((sound: string) => {
    try {
      const audio = new Audio(`/sounds/reactions/${sound}.mp3`);
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch {
      // Audio playback failed
    }
  }, []);

  // Add floating emoji
  const addFloating = useCallback((emoji: string, username: string) => {
    const id = `float-${emojiCounter++}`;
    const x = 20 + Math.random() * 60; // random horizontal position (20-80%)
    setFloating(prev => [...prev, { id, emoji, x, username }]);

    // Remove after animation
    setTimeout(() => {
      setFloating(prev => prev.filter(f => f.id !== id));
    }, 2000);
  }, []);

  // Listen for remote reactions
  useEffect(() => {
    const handleReaction = (data: { channelId: string; emoji: string; sound: string; username: string }) => {
      if (data.channelId !== channelId) return;
      playSound(data.sound);
      addFloating(data.emoji, data.username);
    };

    const s = getSocket();
    if (!s) return;
    s.on('VOICE_REACTION', handleReaction);
    return () => {
      s.off('VOICE_REACTION', handleReaction);
    };
  }, [channelId, playSound, addFloating]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      cooldownTimers.current.forEach(t => clearTimeout(t));
    };
  }, []);

  const sendReaction = useCallback(
    (reaction: (typeof REACTIONS)[number]) => {
      const now = Date.now();
      const lastUsed = cooldowns.get(reaction.sound) ?? 0;
      if (now - lastUsed < COOLDOWN_MS) return;

      // Set cooldown
      setCooldowns(prev => new Map(prev).set(reaction.sound, now));
      const timer = setTimeout(() => {
        setCooldowns(prev => {
          const next = new Map(prev);
          next.delete(reaction.sound);
          return next;
        });
      }, COOLDOWN_MS);

      const oldTimer = cooldownTimers.current.get(reaction.sound);
      if (oldTimer) clearTimeout(oldTimer);
      cooldownTimers.current.set(reaction.sound, timer);

      // Emit & play locally
      emitOrQueue('VOICE_REACTION', {
        channelId,
        emoji: reaction.emoji,
        sound: reaction.sound,
      });
      playSound(reaction.sound);
      addFloating(reaction.emoji, 'You');
    },
    [channelId, cooldowns, playSound, addFloating],
  );

  return (
    <div style={{ position: 'relative' }}>
      {/* Floating emoji overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: '100%',
          left: 0,
          right: 0,
          height: 200,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        <AnimatePresence>
          {floating.map(f => (
            <motion.div
              key={f.id}
              initial={{ opacity: 1, y: 0, scale: 0.5 }}
              animate={{ opacity: 0, y: -160, scale: 1.2 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.8, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                bottom: 0,
                left: `${f.x}%`,
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <span style={{ fontSize: 32 }}>{f.emoji}</span>
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  background: 'var(--bg-elevated)',
                  padding: '1px 5px',
                  borderRadius: 3,
                  whiteSpace: 'nowrap',
                }}
              >
                {f.username}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Reaction buttons */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '6px 8px',
          borderRadius: 10,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--stroke)',
          overflowX: 'auto',
        }}
      >
        {REACTIONS.map(reaction => {
          const onCooldown = cooldowns.has(reaction.sound);
          return (
            <button
              key={reaction.sound}
              onClick={() => sendReaction(reaction)}
              title={reaction.label}
              disabled={onCooldown}
              style={{
                position: 'relative',
                width: 36,
                height: 36,
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                cursor: onCooldown ? 'not-allowed' : 'pointer',
                fontSize: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: onCooldown ? 0.4 : 1,
                transition: 'transform 0.1s, opacity 0.2s',
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                if (!onCooldown) e.currentTarget.style.transform = 'scale(1.2)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {reaction.emoji}
              {onCooldown && (
                <motion.div
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{ duration: COOLDOWN_MS / 1000, ease: 'linear' }}
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 4,
                    right: 4,
                    height: 2,
                    borderRadius: 1,
                    background: 'var(--accent-primary)',
                    transformOrigin: 'left',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
