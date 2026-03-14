import { describe, it, expect, beforeEach } from 'vitest';
import { testDb } from '../setup';
import { createTestUser } from '../helpers';
import { cleanupDatabase } from '../setup';
import { stripeCustomers } from '../../db/schema/stripe';

describe('Payments', () => {
  beforeEach(async () => { await cleanupDatabase(); });

  it('should create a stripe customer record', async () => {
    const { user } = await createTestUser();

    const [customer] = await testDb.insert(stripeCustomers).values({
      userId: user.id,
      stripeCustomerId: 'cus_test_123',
    }).returning();

    expect(customer.userId).toBe(user.id);
    expect(customer.stripeCustomerId).toBe('cus_test_123');
  });
});
