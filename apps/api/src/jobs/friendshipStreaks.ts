import { db } from '../db/index';
import { logger } from '../lib/logger';
import { friendshipStreaks, friendshipMilestones } from '../db/schema/friendship-streaks';
import { lt, sql, and, isNotNull } from 'drizzle-orm';

const MILESTONE_THRESHOLDS: Array<{ milestone: string; days: number }> = [
  { milestone: '1_week', days: 7 },
  { milestone: '1_month', days: 30 },
  { milestone: '3_months', days: 90 },
  { milestone: '6_months', days: 180 },
  { milestone: '1_year', days: 365 },
];

export function startFriendshipStreaksJob() {
  // Run daily (every 24 hours)
  setInterval(async () => {
    try {
      // Reset streaks where lastInteraction > 48 hours ago
      await db.update(friendshipStreaks)
        .set({ currentStreak: 0 })
        .where(and(
          isNotNull(friendshipStreaks.lastInteraction),
          lt(friendshipStreaks.lastInteraction, new Date(Date.now() - 48 * 60 * 60 * 1000)),
          sql`${friendshipStreaks.currentStreak} > 0`,
        ));

      // Check for new milestones based on friendsSince date
      const allStreaks = await db.select({
        id: friendshipStreaks.id,
        userId: friendshipStreaks.userId,
        friendId: friendshipStreaks.friendId,
        friendsSince: friendshipStreaks.friendsSince,
      }).from(friendshipStreaks);

      for (const streak of allStreaks) {
        const daysSinceFriends = Math.floor(
          (Date.now() - new Date(streak.friendsSince).getTime()) / (1000 * 60 * 60 * 24)
        );

        for (const { milestone, days } of MILESTONE_THRESHOLDS) {
          if (daysSinceFriends >= days) {
            await db.insert(friendshipMilestones).values({
              userId: streak.userId,
              friendId: streak.friendId,
              milestone,
            }).onConflictDoNothing();
          }
        }
      }
    } catch (err) {
      logger.error('[friendshipStreaks] Job error:', err);
    }
  }, 24 * 60 * 60 * 1000); // 24 hours
}
