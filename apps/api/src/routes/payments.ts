import { Router, Request, Response } from 'express';
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

let Stripe: any = null;
let stripe: any = null;
try {
  Stripe = require('stripe');
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe.default(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
  }
} catch {
  // stripe package not installed
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

  if (!stripe) {
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
      const customer = await stripe.customers.create({ metadata: { userId } });
      stripeCustomerId = customer.id;
      await db.insert(stripeCustomers).values({ userId, stripeCustomerId });
    }

    const amount = PRODUCT_PRICES[product];

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      customer: stripeCustomerId,
      metadata: { userId, product },
    });

    // Record purchase
    const [purchase] = await db.insert(purchases).values({
      userId,
      stripePaymentIntentId: paymentIntent.id,
      product,
      amountCents: amount,
      currency: 'usd',
      status: 'pending',
    }).returning();

    res.json({ clientSecret: paymentIntent.client_secret, purchaseId: purchase.id });
  } catch (err) {
    console.error('[payments] create-intent error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to create payment intent' });
  }
});

/**
 * POST /payments/webhook
 * Stripe webhook endpoint. No auth middleware.
 */
router.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  if (!stripe) {
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
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[payments] webhook signature verification failed:', err);
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
      console.error('[payments] failed to update purchase status:', err);
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
    console.error('[payments] history error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to fetch purchase history' });
  }
});

export const paymentsRouter = router;
