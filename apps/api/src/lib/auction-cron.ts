/**
 * lib/auction-cron.ts — Periodic auction closure job.
 *
 * Runs every 60 seconds. Finds active auctions whose endsAt has passed and:
 *   - If there is a winning bidder: transfers the cosmetic (inserts userCosmetics
 *     row for buyer, removes from seller's inventory, pays seller from escrow).
 *   - Sets auction status to 'ended'.
 *   - Logs all transactions in economyLedger.
 *
 * Call startAuctionCron() from src/index.ts after the server starts.
 */

import { eq, and, lte } from 'drizzle-orm';
import { db } from '../db/index';
import { auctions } from '../db/schema/auctions';
import { userCosmetics } from '../db/schema/cosmetics';
import { userWallets, economyLedger } from '../db/schema/economy';

async function closeExpiredAuctions(): Promise<void> {
  const now = new Date();

  const expiredAuctions = await db
    .select()
    .from(auctions)
    .where(and(eq(auctions.status, 'active'), lte(auctions.endsAt, now)));

  if (expiredAuctions.length === 0) return;

  console.log(`[auction-cron] Closing ${expiredAuctions.length} expired auction(s)`);

  for (const auction of expiredAuctions) {
    try {
      await db.transaction(async (tx) => {
        // Re-fetch inside tx to guard against concurrent runs
        const [txAuction] = await tx
          .select()
          .from(auctions)
          .where(and(eq(auctions.id, auction.id), eq(auctions.status, 'active')))
          .limit(1);

        if (!txAuction) return; // already closed

        if (txAuction.currentBidderId && txAuction.currentBid !== null) {
          const winnerId = txAuction.currentBidderId;
          const winAmount = txAuction.currentBid;
          const sellerId = txAuction.sellerId;
          const cosmeticId = txAuction.cosmeticId;

          // Remove cosmetic from seller
          await tx
            .delete(userCosmetics)
            .where(
              and(
                eq(userCosmetics.userId, sellerId),
                eq(userCosmetics.cosmeticId, cosmeticId),
              ),
            );

          // Grant to winner (only if not already owned)
          const [alreadyOwned] = await tx
            .select({ id: userCosmetics.id })
            .from(userCosmetics)
            .where(
              and(
                eq(userCosmetics.userId, winnerId),
                eq(userCosmetics.cosmeticId, cosmeticId),
              ),
            )
            .limit(1);

          if (!alreadyOwned) {
            await tx.insert(userCosmetics).values({
              userId: winnerId,
              cosmeticId,
              equipped: false,
            });
          }

          // Pay seller
          let [sellerWallet] = await tx
            .select()
            .from(userWallets)
            .where(eq(userWallets.userId, sellerId))
            .limit(1);

          if (!sellerWallet) {
            const [created] = await tx
              .insert(userWallets)
              .values({ userId: sellerId, balance: 0, lifetimeEarned: 0 })
              .returning();
            sellerWallet = created;
          }

          await tx
            .update(userWallets)
            .set({
              balance: sellerWallet.balance + winAmount,
              lifetimeEarned: sellerWallet.lifetimeEarned + winAmount,
              updatedAt: new Date(),
            })
            .where(eq(userWallets.userId, sellerId));

          // Ledger entries
          await tx.insert(economyLedger).values({
            userId: sellerId,
            direction: 'earn',
            amount: winAmount,
            source: 'auction_sale',
            description: `Auction ${txAuction.id} sold cosmetic ${cosmeticId}`,
            contextKey: txAuction.id,
          });

          await tx.insert(economyLedger).values({
            userId: winnerId,
            direction: 'spend',
            amount: winAmount,
            source: 'auction_win',
            description: `Won auction ${txAuction.id} for cosmetic ${cosmeticId}`,
            contextKey: txAuction.id,
          });
        }

        // Mark auction as ended
        await tx
          .update(auctions)
          .set({ status: 'ended' })
          .where(eq(auctions.id, txAuction.id));
      });

      console.log(
        `[auction-cron] Closed auction ${auction.id} (winner: ${auction.currentBidderId ?? 'none'})`,
      );
    } catch (err) {
      console.error(`[auction-cron] Failed to close auction ${auction.id}:`, err);
    }
  }
}

/** Start the auction closure job. Runs every 60 seconds. */
export function startAuctionCron(): void {
  console.log('[auction-cron] Starting auction closure job (interval: 60s)');
  // Run immediately on startup, then on interval
  closeExpiredAuctions().catch((err) =>
    console.error('[auction-cron] Initial run error:', err),
  );
  setInterval(() => {
    closeExpiredAuctions().catch((err) =>
      console.error('[auction-cron] Run error:', err),
    );
  }, 60_000);
}
