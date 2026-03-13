import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { requireAuth } from '../middleware/auth';
import { db } from '../db/index';
import { stripeCustomers, purchases } from '../db/schema/stripe';
import { eq, desc } from 'drizzle-orm';

const router = Router();

const PRODUCT_PRICES: Record<string, number> = {
  coins_1000: 99,
  coins_5000: 399,
  boost_month: 299,
  premium_month: 499,
};

// Stripe is loaded lazily so the app starts without it installed
let stripe: any = null;
async function getStripe(): Promise<any> {
  if (stripe) return stripe;
  if (!process.env.STRIPE_SECRET_KEY) return null;
  try {
    const mod = await import('stripe' as any);
    stripe = new ((mod as any).default ?? mod)(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
    return stripe;
  } catch {
    return null;
  }
}

/**
 * POST /payments/create-intent
 * Create a Stripe PaymentIntent for a product purchase.
 */
router.post('/create-intent', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const { product } = req.body;

  if (!product || !PRODUCT_PRICES[product]) {
    res.status(400).json({ code: 'INVALID_PRODUCT', message: 'Invalid product' });
    return;
  }

  const stripeClient = await getStripe();
  if (!stripeClient) {
    res.status(503).json({ code: 'STRIPE_NOT_CONFIGURED', message: 'Payments not configured' });
    return;
  }

  try {
    // Get or create Stripe customer
    const [existing] = await db
      .select()
      .from(stripeCustomers)
      .where(eq(stripeCustomers.userId, userId))
      .limit(1);

    let stripeCustomerId: string;

    if (existing) {
      stripeCustomerId = existing.stripeCustomerId;
    } else {
      const customer = await stripeClient.customers.create({ metadata: { userId } });
      stripeCustomerId = (customer as any).id;
      await db.insert(stripeCustomers).values({ userId, stripeCustomerId });
    }

    const amount = PRODUCT_PRICES[product];

    // Create PaymentIntent
    const paymentIntent = await stripeClient.paymentIntents.create({
      amount,
      currency: 'usd',
      customer: stripeCustomerId,
      metadata: { userId, product },
    }) as any;

    // Record purchase
    const [purchase] = await db.insert(purchases).values({
      userId,
      stripePaymentIntentId: (paymentIntent as any).id,
      product,
      amountCents: amount,
      currency: 'usd',
      status: 'pending',
    }).returning();

    res.json({ clientSecret: (paymentIntent as any).client_secret, purchaseId: purchase.id });
  } catch (err) {
    logger.error('[payments] create-intent error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to create payment intent' });
  }
});

/**
 * POST /payments/webhook
 * Stripe webhook endpoint. No auth middleware.
 */
router.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  const stripeClient = await getStripe();
  if (!stripeClient) {
    res.status(503).json({ code: 'STRIPE_NOT_CONFIGURED', message: 'Payments not configured' });
    return;
  }

  const sig = req.headers['stripe-signature'] as string | undefined;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    res.status(400).json({ code: 'MISSING_SIGNATURE', message: 'Missing Stripe signature' });
    return;
  }

  let event: any;
  try {
    event = stripeClient.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    logger.error('[payments] webhook signature verification failed:', err);
    res.status(400).json({ code: 'INVALID_SIGNATURE', message: 'Invalid signature' });
    return;
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    try {
      await db
        .update(purchases)
        .set({ status: 'completed' })
        .where(eq(purchases.stripePaymentIntentId, paymentIntent.id));
    } catch (err) {
      logger.error('[payments] failed to update purchase status:', err);
    }
  }

  res.json({ received: true });
});

/**
 * GET /payments/history
 * Returns purchase history for the authenticated user.
 */
router.get('/history', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;

  try {
    const history = await db
      .select()
      .from(purchases)
      .where(eq(purchases.userId, userId))
      .orderBy(desc(purchases.createdAt));

    res.json(history);
  } catch (err) {
    logger.error('[payments] history error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to fetch purchase history' });
  }
});

export const paymentsRouter = router;
