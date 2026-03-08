# Enterprise Batch 6 Integration Notes

## 1. Lines to add to `routes/index.ts`

```typescript
import { paymentsRouter } from './payments';
import { registry } from '../lib/metrics';

// Mount payments router
router.use('/payments', paymentsRouter);

// Metrics endpoint (protect with IP check)
router.get('/metrics', async (req, res) => {
  const allowedIPs = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
  const clientIP = req.ip || req.socket.remoteAddress || '';
  if (!allowedIPs.includes(clientIP)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  res.set('Content-Type', registry.contentType);
  res.send(await registry.metrics());
});
```

## 2. Lines to add to `schema/index.ts`

```typescript
export * from './stripe';
```

## 3. Lines to add to `index.ts` (request duration middleware)

Add BEFORE router mount, after `app.use(express.json())`:

```typescript
import { httpRequestDuration } from './lib/metrics';
import { logger } from './lib/logger';

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    httpRequestDuration.observe(
      { method: req.method, route: req.path, status: String(res.statusCode) },
      duration,
    );
  });
  next();
});
```

## 4. Lines to add to `messages.ts` POST handler (metrics increment)

```typescript
import { messagesSentTotal } from '../lib/metrics';

// At the end of successful message send:
messagesSentTotal.inc();
```

## 5. Lines to add to `socket/index.ts` (WebSocket connection tracking)

```typescript
import { activeWebSocketConnections } from '../lib/metrics';

// In the connection handler, after `io.on('connection', async (socket) => {`:
activeWebSocketConnections.inc();

// In the disconnect handler:
activeWebSocketConnections.dec();
```

## 6. DM_READ socket event

Add to the DM read state handler (wherever `dm_read_state` or `channel_read_state` is updated for DM channels):

```typescript
// After updating dm_read_state for userId in channelId:
// Get the other participant and emit DM_READ to them
const otherMember = await db.select().from(dmChannelMembers)
  .where(and(eq(dmChannelMembers.channelId, channelId), not(eq(dmChannelMembers.userId, userId))))
  .limit(1);
if (otherMember.length > 0) {
  getIO().to(`user:${otherMember[0].userId}`).emit('DM_READ', {
    channelId,
    userId,
    lastReadMessageId, // the last message ID the user read
  });
}
```

## 7. npm install commands needed

```bash
# In apps/api:
npm install stripe pino pino-pretty prom-client

# In apps/web:
npm install @stripe/stripe-js @stripe/react-stripe-js
```

## 8. api.ts methods to add

```typescript
payments: {
  createIntent: (product: string) => fetchJSON('/payments/create-intent', { method: 'POST', body: JSON.stringify({ product }) }),
  getHistory: () => fetchJSON('/payments/history'),
},
```

## 9. Env vars needed

- `STRIPE_SECRET_KEY` - Stripe secret API key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `VITE_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key (for frontend)

## 10. Migration to run on production

```bash
# Run migration 0062_stripe.sql on production server
ssh ferdinand@<server> "cd gratonite-app && node dist/db/migrate.js"
```
