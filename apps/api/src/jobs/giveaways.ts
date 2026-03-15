import { db } from '../db/index';
import { logger } from '../lib/logger';
import { giveaways, giveawayEntries, giveawayWinners } from '../db/schema/giveaways';
import { lte, and, eq } from 'drizzle-orm';

/** BullMQ processor — ends expired giveaways and picks winners. */
export async function processGiveaways(): Promise<void> {
  // Find active giveaways past their end time
  const expired = await db.select()
    .from(giveaways)
    .where(and(eq(giveaways.status, 'active'), lte(giveaways.endsAt, new Date())));

  for (const giveaway of expired) {
    // Get all entries
    const entries = await db.select({ userId: giveawayEntries.userId })
      .from(giveawayEntries)
      .where(eq(giveawayEntries.giveawayId, giveaway.id));

    // Shuffle and pick winners
    const shuffled = entries.sort(() => Math.random() - 0.5);
    const winners = shuffled.slice(0, Math.min(giveaway.winnersCount, shuffled.length));

    // Insert winner records
    for (const w of winners) {
      await db.insert(giveawayWinners)
        .values({ giveawayId: giveaway.id, userId: w.userId })
        .onConflictDoNothing();
    }

    // Mark as ended
    await db.update(giveaways)
      .set({ status: 'ended', endedAt: new Date() })
      .where(eq(giveaways.id, giveaway.id));

    console.log(`[giveaways] Ended giveaway ${giveaway.id} with ${winners.length} winner(s)`);
  }
}

/** @deprecated Use BullMQ scheduler in worker.ts instead. */
export function startGiveawaysJob() {
  setInterval(async () => {
    try {
      // Find active giveaways past their end time
      const expired = await db.select()
        .from(giveaways)
        .where(and(eq(giveaways.status, 'active'), lte(giveaways.endsAt, new Date())));

      for (const giveaway of expired) {
        try {
          // Get all entries
          const entries = await db.select({ userId: giveawayEntries.userId })
            .from(giveawayEntries)
            .where(eq(giveawayEntries.giveawayId, giveaway.id));

          // Shuffle and pick winners
          const shuffled = entries.sort(() => Math.random() - 0.5);
          const winners = shuffled.slice(0, Math.min(giveaway.winnersCount, shuffled.length));

          // Insert winner records
          for (const w of winners) {
            await db.insert(giveawayWinners)
              .values({ giveawayId: giveaway.id, userId: w.userId })
              .onConflictDoNothing();
          }

          // Mark as ended
          await db.update(giveaways)
            .set({ status: 'ended', endedAt: new Date() })
            .where(eq(giveaways.id, giveaway.id));

          console.log(`[giveaways] Ended giveaway ${giveaway.id} with ${winners.length} winner(s)`);
        } catch (err) {
          logger.error(`[giveaways] Error ending giveaway ${giveaway.id}:`, err);
        }
      }
    } catch (err) {
      logger.error('[giveaways] Job error:', err);
    }
  }, 30_000);
}
