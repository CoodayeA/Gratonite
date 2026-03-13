import { useState, useEffect, useCallback } from 'react';
import { Trophy, Users, MessageSquare, Calendar } from 'lucide-react';

interface MilestoneInfo {
  type: 'members' | 'messages' | 'anniversary';
  value: number;
  serverName: string;
}

const MEMBER_MILESTONES = [10, 50, 100, 500, 1000, 5000, 10000];
const MESSAGE_MILESTONES = [1000, 10000, 100000, 1000000];

function getMilestoneHit(count: number, milestones: number[]): number | null {
  for (let i = milestones.length - 1; i >= 0; i--) {
    if (count >= milestones[i]) return milestones[i];
  }
  return null;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return String(n);
}

export function checkMilestone(guildId: string, memberCount: number, messageCount?: number): MilestoneInfo | null {
  const key = `gratonite-milestone-shown:${guildId}`;
  const shown = JSON.parse(localStorage.getItem(key) || '{}') as Record<string, boolean>;

  const memberMilestone = getMilestoneHit(memberCount, MEMBER_MILESTONES);
  if (memberMilestone && !shown[`members:${memberMilestone}`]) {
    return { type: 'members', value: memberMilestone, serverName: '' };
  }

  if (messageCount) {
    const msgMilestone = getMilestoneHit(messageCount, MESSAGE_MILESTONES);
    if (msgMilestone && !shown[`messages:${msgMilestone}`]) {
      return { type: 'messages', value: msgMilestone, serverName: '' };
    }
  }

  return null;
}

export function markMilestoneShown(guildId: string, type: string, value: number): void {
  const key = `gratonite-milestone-shown:${guildId}`;
  const shown = JSON.parse(localStorage.getItem(key) || '{}') as Record<string, boolean>;
  shown[`${type}:${value}`] = true;
  localStorage.setItem(key, JSON.stringify(shown));
}

interface ServerMilestoneProps {
  milestone: MilestoneInfo;
  onDismiss: () => void;
}

export default function ServerMilestone({ milestone, onDismiss }: ServerMilestoneProps) {
  const [visible, setVisible] = useState(false);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; color: string; size: number; delay: number }>>([]);

  useEffect(() => {
    setVisible(true);
    // Generate confetti particles
    const colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#fd79a8'];
    const p = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: -10 - Math.random() * 20,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 4 + Math.random() * 6,
      delay: Math.random() * 0.8,
    }));
    setParticles(p);

    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 400);
    }, 6000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const Icon = milestone.type === 'members' ? Users : milestone.type === 'messages' ? MessageSquare : Calendar;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      {/* Confetti */}
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute',
          left: `${p.x}%`,
          top: `${p.y}%`,
          width: `${p.size}px`,
          height: `${p.size}px`,
          borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          background: p.color,
          animation: `confettiFall 2.5s ${p.delay}s ease-in forwards`,
          opacity: 0.9,
        }} />
      ))}

      {/* Card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 31, 34, 0.95), rgba(40, 42, 54, 0.95))',
        backdropFilter: 'blur(20px)',
        borderRadius: '16px',
        padding: '32px 40px',
        textAlign: 'center',
        border: '1px solid rgba(255, 215, 0, 0.3)',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(255, 215, 0, 0.1)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1)' : 'scale(0.8)',
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: 'auto',
        cursor: 'pointer',
        maxWidth: '340px',
      }} onClick={onDismiss}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '50%', margin: '0 auto 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #ffd700, #f0c000)',
          boxShadow: '0 4px 20px rgba(255, 215, 0, 0.3)',
        }}>
          <Trophy size={28} color="#1a1a1a" />
        </div>
        <h2 style={{
          margin: 0, fontSize: '20px', fontWeight: 700,
          background: 'linear-gradient(90deg, #ffd700, #ffec8b)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Milestone Reached!
        </h2>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          marginTop: '12px', color: 'var(--text-primary)', fontSize: '15px',
        }}>
          <Icon size={18} />
          <span>
            {milestone.type === 'members' ? `${formatNumber(milestone.value)} Members` :
             milestone.type === 'messages' ? `${formatNumber(milestone.value)} Messages` :
             'Anniversary!'}
          </span>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
          Click to dismiss
        </p>
      </div>

      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
