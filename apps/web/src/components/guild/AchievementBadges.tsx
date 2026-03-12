import { Award, MessageSquare, Mic, Clock, Star, Users, Zap, Heart } from 'lucide-react';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: typeof Award;
  color: string;
  earned: boolean;
  earnedAt?: string;
}

const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-message', name: 'First Words', description: 'Send your first message', icon: MessageSquare, color: '#6366f1', earned: false },
  { id: 'hundred-messages', name: 'Chatterbox', description: 'Send 100 messages', icon: MessageSquare, color: '#8b5cf6', earned: false },
  { id: 'thousand-messages', name: 'Motormouth', description: 'Send 1,000 messages', icon: Zap, color: '#f59e0b', earned: false },
  { id: 'first-voice', name: 'Voice Debut', description: 'Join a voice channel', icon: Mic, color: '#22c55e', earned: false },
  { id: 'voice-hour', name: 'Voice Veteran', description: 'Spend 1 hour in voice', icon: Clock, color: '#06b6d4', earned: false },
  { id: 'first-thread', name: 'Thread Starter', description: 'Create your first thread', icon: MessageSquare, color: '#ec4899', earned: false },
  { id: 'first-reaction', name: 'Reactor', description: 'Add your first reaction', icon: Heart, color: '#ef4444', earned: false },
  { id: 'one-year', name: 'OG Member', description: 'Be a member for 1 year', icon: Star, color: '#f59e0b', earned: false },
  { id: 'invite-five', name: 'Recruiter', description: 'Invite 5 members', icon: Users, color: '#3b82f6', earned: false },
  { id: 'first-fame', name: 'Famous', description: 'Receive your first fame', icon: Award, color: '#a855f7', earned: false },
];

export default function AchievementBadges({ earnedIds }: { earnedIds: string[] }) {
  const badges = ACHIEVEMENTS.map(a => ({ ...a, earned: earnedIds.includes(a.id) }));
  const earnedCount = badges.filter(b => b.earned).length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Award size={18} style={{ color: '#f59e0b' }} />
        <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>Achievements</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>{earnedCount}/{badges.length}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
        {badges.map(badge => {
          const Icon = badge.icon;
          return (
            <div key={badge.id} style={{ background: badge.earned ? 'var(--bg-elevated)' : 'var(--bg-secondary)', borderRadius: 8, padding: 12, textAlign: 'center', opacity: badge.earned ? 1 : 0.4, border: badge.earned ? `1px solid ${badge.color}33` : '1px solid var(--border-primary)', transition: 'opacity 0.2s' }} title={badge.description}>
              <Icon size={24} style={{ color: badge.color, marginBottom: 6 }} />
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{badge.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{badge.description}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
