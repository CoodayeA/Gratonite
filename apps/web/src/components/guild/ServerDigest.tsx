import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Users,
  TrendingUp,
  Hash,
  MessageCircle,
  Crown,
  Heart,
  Star,
} from 'lucide-react';

/* ── Types ──────────────────────────────────────────────── */

interface TopMessage {
  messageId: string;
  content: string | null;
  reactionCount: number;
  authorUsername?: string;
  authorDisplayName?: string;
}

interface NewMember {
  userId: string;
  displayName: string;
  username: string;
  avatarHash?: string | null;
}

interface ActiveChannel {
  channelName: string;
  messageCount: number;
}

interface ActiveMember {
  displayName: string | null;
  username: string | null;
  messageCount: number;
}

interface ActiveThread {
  name: string;
  participantCount: number;
}

interface DigestContent {
  topMessages: TopMessage[];
  newMembers: NewMember[];
  messageCount: number;
  activeChannels: ActiveChannel[];
  activeMembers: ActiveMember[];
  activeThreads?: ActiveThread[];
}

interface ServerDigestProps {
  digest: {
    weekStart: string;
    guildName?: string;
    guildIconHash?: string | null;
    guildId?: string;
    content: DigestContent;
  };
}

/* ── Helpers ────────────────────────────────────────────── */

function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}, ${end.getFullYear()}`;
}

function getInitials(name: string): string {
  return name.charAt(0).toUpperCase();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '...';
}

/* ── Sub-components ─────────────────────────────────────── */

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          background: 'var(--accent-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
        }}
      >
        {icon}
      </div>
      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
        {title}
      </span>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div
      style={{
        flex: '1 1 0',
        minWidth: 100,
        padding: 14,
        borderRadius: 10,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--stroke)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <div style={{ color: 'var(--accent-primary)' }}>{icon}</div>
      <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{value}</span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────── */

export function ServerDigest({ digest }: ServerDigestProps) {
  const { content, weekStart, guildName, guildIconHash, guildId } = digest;

  const maxChannelMessages = useMemo(
    () => Math.max(1, ...content.activeChannels.map(c => c.messageCount)),
    [content.activeChannels],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        maxWidth: 520,
        borderRadius: 14,
        overflow: 'hidden',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--stroke)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
      }}
    >
      {/* Gradient header */}
      <div
        style={{
          padding: '28px 24px 20px',
          background: 'linear-gradient(135deg, var(--accent-primary), #7c3aed)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        {/* Guild icon */}
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: guildIconHash
              ? `url(/icons/${guildId}/${guildIconHash}.webp) center/cover`
              : 'rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            fontWeight: 800,
            border: '2px solid rgba(255,255,255,0.3)',
            flexShrink: 0,
          }}
        >
          {!guildIconHash && getInitials(guildName ?? 'S')}
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
            Weekly Digest
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, opacity: 0.85 }}>
            {formatWeekRange(weekStart)}
          </p>
          {guildName && (
            <p style={{ margin: '2px 0 0', fontSize: 12, opacity: 0.7 }}>{guildName}</p>
          )}
        </div>
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Server Stats */}
        <section>
          <SectionHeader icon={<TrendingUp size={16} />} title="Server Stats" />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <StatCard
              label="Messages"
              value={content.messageCount.toLocaleString()}
              icon={<MessageSquare size={18} />}
            />
            <StatCard
              label="Active Members"
              value={content.activeMembers.length}
              icon={<Users size={18} />}
            />
            <StatCard
              label="New Members"
              value={content.newMembers.length}
              icon={<Star size={18} />}
            />
          </div>
        </section>

        {/* Top Messages */}
        {content.topMessages.length > 0 && (
          <section>
            <SectionHeader icon={<Crown size={16} />} title="Top Messages" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {content.topMessages.slice(0, 5).map((msg, i) => (
                <div
                  key={msg.messageId}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--stroke)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: i === 0 ? '#faa61a' : 'var(--text-muted)',
                      width: 20,
                      flexShrink: 0,
                      textAlign: 'center',
                    }}
                  >
                    #{i + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        color: 'var(--text-primary)',
                        lineHeight: 1.4,
                        wordBreak: 'break-word',
                      }}
                    >
                      {msg.content ? truncate(msg.content, 120) : '[Attachment]'}
                    </p>
                    {msg.authorDisplayName && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        - {msg.authorDisplayName}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      color: 'var(--text-muted)',
                      fontSize: 12,
                      flexShrink: 0,
                    }}
                  >
                    <Heart size={12} />
                    {msg.reactionCount}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* New Members */}
        {content.newMembers.length > 0 && (
          <section>
            <SectionHeader icon={<Users size={16} />} title="New Members" />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {content.newMembers.slice(0, 12).map(member => (
                <div
                  key={member.userId}
                  title={member.displayName || member.username}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px 4px 4px',
                    borderRadius: 16,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--stroke)',
                  }}
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: member.avatarHash
                        ? `url(/avatars/${member.userId}/${member.avatarHash}.webp) center/cover`
                        : 'var(--accent-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {!member.avatarHash && getInitials(member.displayName || member.username)}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                    {member.displayName || member.username}
                  </span>
                </div>
              ))}
              {content.newMembers.length > 12 && (
                <div
                  style={{
                    padding: '4px 10px',
                    borderRadius: 16,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--stroke)',
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  +{content.newMembers.length - 12} more
                </div>
              )}
            </div>
          </section>
        )}

        {/* Hot Channels */}
        {content.activeChannels.length > 0 && (
          <section>
            <SectionHeader icon={<Hash size={16} />} title="Hot Channels" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {content.activeChannels.slice(0, 6).map(ch => (
                <div key={ch.channelName} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                      width: 90,
                      flexShrink: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    #{ch.channelName}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: 8,
                      borderRadius: 4,
                      background: 'var(--bg-elevated)',
                      overflow: 'hidden',
                    }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(ch.messageCount / maxChannelMessages) * 100}%` }}
                      transition={{ duration: 0.6, delay: 0.1 }}
                      style={{
                        height: '100%',
                        borderRadius: 4,
                        background: 'var(--accent-primary)',
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 36, textAlign: 'right', flexShrink: 0 }}>
                    {ch.messageCount}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Active Threads */}
        {content.activeThreads && content.activeThreads.length > 0 && (
          <section>
            <SectionHeader icon={<MessageCircle size={16} />} title="Active Threads" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {content.activeThreads.slice(0, 5).map((thread, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--stroke)',
                  }}
                >
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                    {thread.name}
                  </span>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      color: 'var(--text-muted)',
                      fontSize: 12,
                    }}
                  >
                    <Users size={12} />
                    {thread.participantCount}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </motion.div>
  );
}
