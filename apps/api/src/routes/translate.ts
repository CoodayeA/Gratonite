/**
 * routes/translate.ts — Inline message translation via LibreTranslate.
 * Caches translations in the message_translations table to avoid re-translating.
 */
import { Router, Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index';
import { messages } from '../db/schema/messages';
import { messageTranslations } from '../db/schema/message-translations';
import { channels } from '../db/schema/channels';
import { dmChannelMembers } from '../db/schema/channels';
import { guildMembers } from '../db/schema/guilds';
import { requireAuth } from '../middleware/auth';
import { logger } from '../lib/logger';

export const translateRouter = Router({ mergeParams: true });

const SUPPORTED_LANGS = ['en', 'es', 'fr', 'de', 'ja', 'zh', 'ko', 'ar', 'pt', 'ru', 'it', 'nl', 'pl', 'tr', 'hi'];

// POST /messages/:messageId/translate — translate message content
translateRouter.post('/:messageId/translate', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const messageId = req.params.messageId as string;
    const { targetLang } = req.body as { targetLang?: string };

    if (!targetLang || !SUPPORTED_LANGS.includes(targetLang.toLowerCase())) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: `targetLang is required and must be one of: ${SUPPORTED_LANGS.join(', ')}`,
      });
      return;
    }

    const lang = targetLang.toLowerCase();
    const libreTranslateUrl = process.env.LIBRETRANSLATE_URL;

    if (!libreTranslateUrl) {
      res.status(503).json({ code: 'NOT_CONFIGURED', message: 'Translation is not configured' });
      return;
    }

    // Check DB cache first
    const [cached] = await db.select().from(messageTranslations)
      .where(and(
        eq(messageTranslations.messageId, messageId),
        eq(messageTranslations.targetLang, lang),
      )).limit(1);

    if (cached) {
      res.json({
        translatedContent: cached.translatedContent,
        sourceLang: cached.sourceLang,
        targetLang: cached.targetLang,
        cached: true,
      });
      return;
    }

    // Fetch the original message and its channel
    const [msg] = await db.select({ content: messages.content, channelId: messages.channelId }).from(messages)
      .where(eq(messages.id, messageId)).limit(1);

    if (!msg || !msg.content) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Message not found' });
      return;
    }

    // SECURITY: verify the user has access to the channel containing this message
    const [channel] = await db.select().from(channels).where(eq(channels.id, msg.channelId)).limit(1);
    if (!channel) { res.status(404).json({ code: 'NOT_FOUND', message: 'Channel not found' }); return; }
    if (channel.type === 'DM' || channel.type === 'GROUP_DM') {
      const [membership] = await db.select({ id: dmChannelMembers.id }).from(dmChannelMembers)
        .where(and(eq(dmChannelMembers.channelId, msg.channelId), eq(dmChannelMembers.userId, req.userId!))).limit(1);
      if (!membership) { res.status(403).json({ code: 'FORBIDDEN', message: 'No access to this channel' }); return; }
    } else if (channel.guildId) {
      const [gm] = await db.select({ id: guildMembers.id }).from(guildMembers)
        .where(and(eq(guildMembers.guildId, channel.guildId), eq(guildMembers.userId, req.userId!))).limit(1);
      if (!gm) { res.status(403).json({ code: 'FORBIDDEN', message: 'No access to this channel' }); return; }
    }

    // Call LibreTranslate API
    const libreTranslateKey = process.env.LIBRETRANSLATE_API_KEY;

    const body: Record<string, string> = {
      q: msg.content,
      source: 'auto',
      target: lang,
      format: 'text',
    };
    if (libreTranslateKey) {
      body.api_key = libreTranslateKey;
    }

    const translateRes = await fetch(libreTranslateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!translateRes.ok) {
      // Fallback: return original content if translation service is unavailable
      logger.warn('[translate] LibreTranslate unavailable, status:', translateRes.status);
      res.json({
        translatedContent: msg.content,
        sourceLang: null,
        targetLang: lang,
        cached: false,
        fallback: true,
      });
      return;
    }

    const data = (await translateRes.json()) as {
      translatedText: string;
      detectedLanguage?: { confidence: number; language: string };
    };

    const sourceLang = data.detectedLanguage?.language || null;
    const translatedContent = data.translatedText;

    // Cache in DB
    await db.insert(messageTranslations).values({
      messageId,
      targetLang: lang,
      translatedContent,
      sourceLang,
    }).onConflictDoNothing();

    res.json({
      translatedContent,
      sourceLang,
      targetLang: lang,
      cached: false,
    });
  } catch (err) {
    logger.error('[translate] POST error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});
