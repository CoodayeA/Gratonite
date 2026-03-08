# Enterprise Batch 4+5 Integration Notes

## 1. Lines to add to routes/index.ts

```typescript
import { oauthRouter } from './oauth';
// Add after existing router mounts:
router.use('/oauth', oauthRouter);
// reactionsRouter is already mounted at line 92
```

## 2. Lines to add to schema/index.ts

```typescript
export * from './oauth';
export * from './webhook-delivery-logs';
```

## 3. Translation endpoint to add to messages.ts

Add this endpoint inside the messagesRouter:

```typescript
// POST /channels/:channelId/messages/:messageId/translate
messagesRouter.post('/:messageId/translate', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { channelId, messageId } = req.params;
  const { targetLang = 'EN' } = req.body;

  // Fetch message
  const [msg] = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
  if (!msg || !msg.content) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Message not found' }); return;
  }

  // Check Redis cache
  const cacheKey = `translate:${messageId}:${targetLang}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    res.json(JSON.parse(cached)); return;
  }

  // Call DeepL API
  const deeplKey = process.env.DEEPL_API_KEY;
  if (!deeplKey) {
    // Return mock if no key configured
    res.json({ translatedText: msg.content, detectedLanguage: 'EN', mock: true }); return;
  }

  try {
    const response = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: { 'Authorization': `DeepL-Auth-Key ${deeplKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: [msg.content], target_lang: targetLang }),
    });
    const data = await response.json() as { translations: Array<{ text: string; detected_source_language: string }> };
    const result = {
      translatedText: data.translations[0].text,
      detectedLanguage: data.translations[0].detected_source_language,
    };
    await redis.set(cacheKey, JSON.stringify(result), 'EX', 3600);
    res.json(result);
  } catch (err) {
    console.error('[translate] DeepL error:', err);
    res.status(500).json({ code: 'TRANSLATION_ERROR', message: 'Translation failed' });
  }
});
```

Requires adding import at top of messages.ts:
```typescript
import { redis } from '../lib/redis';
```

## 4. Webhook delivery logging to add to lib/webhook-dispatch.ts

Replace the `_sendToBot` function's fetch block to add delivery logging. Add import at top:

```typescript
import { webhookDeliveryLogs } from '../db/schema/webhook-delivery-logs';
```

Then wrap the fetch call in `_sendToBot`:

```typescript
const startTime = Date.now();
try {
  const resp = await fetch(bot.webhookUrl, {
    // ... existing code ...
  });

  clearTimeout(timer);
  const durationMs = Date.now() - startTime;

  let responseText = '';
  if (resp.ok) {
    const contentType = resp.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      responseText = await resp.text();
      responseBody = JSON.parse(responseText) as BotActionResponse;
    }
  } else {
    responseText = await resp.text();
  }

  // Log the delivery (fire and forget)
  await db.insert(webhookDeliveryLogs).values({
    webhookId: bot.id,
    eventType: 'message_create',
    payload: JSON.parse(payload) as any,
    responseStatus: resp.status,
    responseBody: responseText.slice(0, 1000),
    durationMs,
    success: resp.ok,
  }).catch(() => {});

} catch (fetchErr: unknown) {
  clearTimeout(timer);
  const durationMs = Date.now() - startTime;

  // Log failure
  await db.insert(webhookDeliveryLogs).values({
    webhookId: bot.id,
    eventType: 'message_create',
    payload: JSON.parse(payload) as any,
    responseStatus: null,
    responseBody: String(fetchErr),
    durationMs,
    success: false,
  }).catch(() => {});

  // existing error handling...
}
```

## 5. Web app routes to add

In App.tsx, add these routes inside the RequireAuth layout:

```tsx
import OAuthAuthorize from './pages/app/OAuthAuthorize';
import GlobalSearch from './pages/guilds/GlobalSearch';

// Routes:
<Route path="oauth/authorize" element={<OAuthAuthorize />} />
<Route path="search" element={<GlobalSearch />} />
```

## 6. api.ts methods to add

```typescript
// In the api object:

// Search
search: {
  global: (params: { q: string; guildId?: string; channelId?: string; authorId?: string; hasFile?: string; before?: string; after?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.set(k, String(v)); });
    return api.get(`/search/messages?${qs.toString()}`);
  },
},

// OAuth
oauth: {
  getAuthorize: (clientId: string, scope?: string) =>
    api.get(`/oauth/authorize?client_id=${encodeURIComponent(clientId)}${scope ? `&scope=${encodeURIComponent(scope)}` : ''}`),
  authorize: (body: { clientId: string; redirectUri: string; scope: string; state: string; approved: boolean }) =>
    api.post('/oauth/authorize', body),
  getApplications: () => api.get('/oauth/applications'),
  createApplication: (body: { name: string; description?: string; redirectUris: string[]; scopes: string[] }) =>
    api.post('/oauth/applications', body),
  getApplication: (appId: string) => api.get(`/oauth/applications/${appId}`),
  updateApplication: (appId: string, body: Record<string, unknown>) => api.patch(`/oauth/applications/${appId}`, body),
  deleteApplication: (appId: string) => api.delete(`/oauth/applications/${appId}`),
},

// Webhooks delivery logs
webhooks: {
  getDeliveries: (webhookId: string) => api.get(`/webhooks/${webhookId}/deliveries`),
  redeliver: (webhookId: string, deliveryId: string) =>
    api.post(`/webhooks/${webhookId}/deliveries/${deliveryId}/redeliver`, {}),
},

// Reactions
reactions: {
  getUsers: (channelId: string, messageId: string, emoji: string) =>
    api.get(`/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`),
},

// Messages translation
messages: {
  translate: (channelId: string, messageId: string, targetLang: string) =>
    api.post(`/channels/${channelId}/messages/${messageId}/translate`, { targetLang }),
},
```
