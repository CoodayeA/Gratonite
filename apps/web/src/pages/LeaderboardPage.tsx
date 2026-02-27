import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Avatar } from '@/components/ui/Avatar';

type Period = 'week' | 'month' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
  week: 'Week',
  month: 'Month',
  all: 'All Time',
};

/** Derive a simple level from lifetime gratonites earned. */
function getLevel(gratonites: number): number {
  if (gratonites <= 0) return 1;
  return Math.min(99, Math.floor(Math.sqrt(gratonites / 10)) + 1);
}

/** Compute days since a date string. */
function getDaysActive(memberSince: string): number {
  const ms = Date.now() - new Date(memberSince).getTime();
  return Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

/** Color for rank number display. */
function rankColor(rank: number): string {
  if (rank === 1) return '#d4af37';
  if (rank === 2) return '#c0c0c0';
  if (rank === 3) return '#cd7f32';
  return 'var(--text-muted)';
}

/* ------------------------------------------------------------------ */
/*  Styles                                                            */
/* ------------------------------------------------------------------ */

const styles = {
  page: {
    padding: '32px 40px',
    maxWidth: 960,
    margin: '0 auto',
    minHeight: '100%',
  } as React.CSSProperties,

  /* Header row */
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  } as React.CSSProperties,

  title: {
    fontSize: 28,
    fontWeight: 700,
    color: 'var(--text)',
    margin: 0,
  } as React.CSSProperties,

  /* Period filter pills */
  filterGroup: {
    display: 'flex',
    gap: 8,
  } as React.CSSProperties,

  filterPill: (active: boolean) =>
    ({
      padding: '6px 18px',
      borderRadius: 'var(--radius-xl)',
      border: active ? '1.5px solid var(--accent)' : '1.5px solid var(--stroke)',
      background: active ? 'var(--accent)' : 'transparent',
      color: active ? 'var(--text-on-gold, #1a1625)' : 'var(--text-muted)',
      fontWeight: active ? 600 : 500,
      fontSize: 13,
      cursor: 'pointer',
      transition: 'all 0.15s ease',
    }) as React.CSSProperties,

  /* Podium section */
  podiumSection: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 20,
    marginBottom: 40,
    padding: '20px 0 0',
  } as React.CSSProperties,

  podiumCard: (isFirst: boolean) =>
    ({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: isFirst ? '28px 28px 24px' : '22px 24px 20px',
      borderRadius: 'var(--radius-lg)',
      background: 'var(--bg-elevated, #353348)',
      border: isFirst ? '1px solid var(--border-gold)' : '1px solid var(--stroke)',
      width: isFirst ? 200 : 170,
      position: 'relative',
      marginBottom: isFirst ? 16 : 0,
    }) as React.CSSProperties,

  crownIcon: {
    position: 'absolute',
    top: -18,
    fontSize: 28,
    lineHeight: 1,
  } as React.CSSProperties,

  podiumRankBadge: (rank: number) =>
    ({
      width: 28,
      height: 28,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      fontSize: 13,
      marginBottom: 12,
      background:
        rank === 1
          ? 'var(--accent)'
          : rank === 2
            ? 'linear-gradient(135deg, #c0c0c0, #8a8a8a)'
            : 'linear-gradient(135deg, #cd7f32, #8b5e3c)',
      color: rank === 1 ? 'var(--text-on-gold, #1a1625)' : '#fff',
    }) as React.CSSProperties,

  podiumAvatar: {
    marginBottom: 10,
  } as React.CSSProperties,

  podiumName: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: 6,
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
  } as React.CSSProperties,

  podiumGratonite: {
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--accent)',
    marginBottom: 4,
  } as React.CSSProperties,

  podiumLevel: {
    fontSize: 12,
    color: 'var(--text-muted)',
    fontWeight: 500,
  } as React.CSSProperties,

  /* Table */
  tableWrapper: {
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    border: '1px solid var(--stroke)',
    background: 'var(--bg-elevated, #353348)',
  } as React.CSSProperties,

  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 14,
  } as React.CSSProperties,

  th: {
    textAlign: 'left',
    padding: '12px 16px',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--text-faint)',
    borderBottom: '1px solid var(--stroke)',
  } as React.CSSProperties,

  td: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--stroke)',
    color: 'var(--text)',
  } as React.CSSProperties,

  row: (isCurrentUser: boolean) =>
    ({
      background: isCurrentUser ? 'rgba(var(--accent-rgb, 212, 175, 55), 0.08)' : 'transparent',
      transition: 'background 0.12s ease',
    }) as React.CSSProperties,

  userCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  } as React.CSSProperties,

  userName: {
    fontWeight: 500,
    color: 'var(--text)',
  } as React.CSSProperties,

  goldText: {
    color: 'var(--accent)',
    fontWeight: 600,
  } as React.CSSProperties,

  rankCell: {
    fontWeight: 600,
    color: 'var(--text-muted)',
    width: 48,
  } as React.CSSProperties,

  /* Footer link */
  footer: {
    textAlign: 'center',
    padding: '20px 0',
  } as React.CSSProperties,

  showAllLink: {
    color: 'var(--text-muted)',
    fontSize: 13,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    textDecoration: 'underline',
    textUnderlineOffset: 3,
  } as React.CSSProperties,

  /* User own rank footer bar */
  userRankBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--gold-glow)',
    border: '1px solid var(--border-gold)',
    marginTop: 8,
  } as React.CSSProperties,

  userRankLabel: {
    fontSize: 13,
    color: 'var(--text-muted)',
  } as React.CSSProperties,

  userRankValue: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--accent)',
  } as React.CSSProperties,

  /* Loading / empty state */
  emptyState: {
    textAlign: 'center',
    padding: '64px 0',
    color: 'var(--text-muted)',
    fontSize: 15,
  } as React.CSSProperties,
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function LeaderboardPage() {
  const [period, setPeriod] = useState<Period>('week');
  const [showAll, setShowAll] = useState(false);
  const currentUser = useAuthStore((s) => s.user);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['leaderboard', period],
    queryFn: () => api.leaderboard.get(period),
  });

  const top3 = entries.slice(0, 3);
  const rest = showAll ? entries.slice(3) : entries.slice(3, 10);

  // Re-order top 3 for podium display: [#2, #1, #3]
  const podiumOrder = (top3.length >= 3
    ? [top3[1]!, top3[0]!, top3[2]!]
    : top3) as NonNullable<typeof top3[number]>[];

  // Find current user in the leaderboard
  const myEntry = currentUser ? entries.find((e) => e.userId === currentUser.id) : null;

  return (
    <div style={styles.page}>
      {/* Header: title + period filters */}
      <div style={styles.headerRow}>
        <h1 style={styles.title}>Leaderboard</h1>
        <div style={styles.filterGroup}>
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              style={styles.filterPill(period === p)}
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div style={styles.emptyState}>Loading leaderboard...</div>
      ) : entries.length === 0 ? (
        <div style={styles.emptyState}>No leaderboard data yet.</div>
      ) : (
        <>
          {/* Top 3 Podium */}
          {top3.length >= 3 && (
            <div style={styles.podiumSection}>
              {podiumOrder.map((entry) => {
                const level = getLevel(entry.gratonitesEarned);
                const isFirst = entry.rank === 1;
                return (
                  <div key={entry.userId} style={styles.podiumCard(isFirst)}>
                    {isFirst && <span style={styles.crownIcon as React.CSSProperties}>&#128081;</span>}
                    <div style={styles.podiumRankBadge(entry.rank)}>
                      {entry.rank}
                    </div>
                    <div style={styles.podiumAvatar}>
                      <Avatar
                        name={entry.displayName}
                        hash={entry.avatarHash}
                        userId={entry.userId}
                        size={isFirst ? 64 : 52}
                      />
                    </div>
                    <div style={styles.podiumName}>{entry.displayName}</div>
                    <div style={styles.podiumGratonite}>
                      {entry.gratonitesEarned.toLocaleString()} G
                    </div>
                    <div style={styles.podiumLevel}>Level {level}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Rankings Table */}
          {rest.length > 0 && (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, width: 48 }}>#</th>
                    <th style={styles.th}>User</th>
                    <th style={styles.th}>Level</th>
                    <th style={styles.th}>Messages</th>
                    <th style={styles.th}>Days Active</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>G Earned</th>
                  </tr>
                </thead>
                <tbody>
                  {rest.map((entry) => {
                    const isCurrentUser = currentUser?.id === entry.userId;
                    const level = getLevel(entry.gratonitesEarned);
                    const daysActive = getDaysActive(entry.memberSince);
                    return (
                      <tr key={entry.userId} style={styles.row(isCurrentUser)}>
                        <td style={{ ...styles.td, ...styles.rankCell, color: rankColor(entry.rank) }}>{entry.rank}</td>
                        <td style={styles.td}>
                          <div style={styles.userCell}>
                            <Avatar
                              name={entry.displayName}
                              hash={entry.avatarHash}
                              userId={entry.userId}
                              size={32}
                            />
                            <span style={styles.userName}>{entry.displayName}</span>
                          </div>
                        </td>
                        <td style={styles.td}>{level}</td>
                        <td style={styles.td}>{entry.messageCount.toLocaleString()}</td>
                        <td style={styles.td}>{daysActive}</td>
                        <td style={{ ...styles.td, ...styles.goldText, textAlign: 'right' }}>
                          {entry.gratonitesEarned.toLocaleString()} G
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Show all link */}
          {entries.length > 13 && !showAll && (
            <div style={styles.footer as React.CSSProperties}>
              <button style={styles.showAllLink} onClick={() => setShowAll(true)}>
                Show all rankings
              </button>
            </div>
          )}
          {entries.length <= 13 && entries.length > 3 && (
            <div style={styles.footer as React.CSSProperties}>
              <span style={{ ...styles.showAllLink, cursor: 'default', textDecoration: 'none', color: 'var(--text-faint)' }}>
                Show all rankings
              </span>
            </div>
          )}

          {/* Current user's own rank footer */}
          {myEntry && (
            <div style={styles.userRankBar}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 } as React.CSSProperties}>
                <Avatar
                  name={myEntry.displayName}
                  hash={myEntry.avatarHash}
                  userId={myEntry.userId}
                  size={32}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 } as React.CSSProperties}>
                  <span style={styles.userRankLabel}>Your rank</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' } as React.CSSProperties}>{myEntry.displayName}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 } as React.CSSProperties}>
                <div style={{ textAlign: 'right' } as React.CSSProperties}>
                  <div style={styles.userRankValue}>#{myEntry.rank}</div>
                  <div style={styles.userRankLabel}>{myEntry.gratonitesEarned.toLocaleString()} G earned</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
