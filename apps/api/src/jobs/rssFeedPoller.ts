/**
 * jobs/rssFeedPoller.ts — Background poller for RSS/Atom feed subscriptions.
 *
 * Runs every 60 seconds via BullMQ. For each enabled feed whose poll interval
 * has elapsed, fetches the feed XML, parses new items, and posts them as
 * messages in the target channel with rich embed formatting.
 *
 * @module jobs/rssFeedPoller
 */

import { eq, and, or, isNull, sql, lt } from 'drizzle-orm';
import { XMLParser } from 'fast-xml-parser';

import { db } from '../db/index';
import { rssFeeds } from '../db/schema/rss-feeds';
import { messages } from '../db/schema/messages';
import { getIO } from '../lib/socket-io';
import { logger } from '../lib/logger';

// ---------------------------------------------------------------------------
// XML parser (reusable instance)
// ---------------------------------------------------------------------------

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: (name) => ['item', 'entry'].includes(name),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FeedItem {
  title: string;
  link: string;
  description?: string;
  guid: string;
  pubDate?: Date;
  image?: string;
  author?: string;
}

// ---------------------------------------------------------------------------
// Feed parsing helpers
// ---------------------------------------------------------------------------

/**
 * Parse RSS 2.0 or Atom XML into a normalized list of feed items.
 */
function parseFeedXml(xml: string): { title?: string; items: FeedItem[] } {
  const parsed = xmlParser.parse(xml);

  // RSS 2.0
  if (parsed.rss?.channel) {
    const channel = parsed.rss.channel;
    const rawItems = channel.item || [];
    const items: FeedItem[] = rawItems.map((item: any) => ({
      title: String(item.title || '').slice(0, 256),
      link: extractLink(item.link),
      description: item.description ? stripHtml(String(item.description)).slice(0, 500) : undefined,
      guid: String(item.guid?.['#text'] || item.guid || item.link || ''),
      pubDate: item.pubDate ? new Date(item.pubDate) : undefined,
      image: item.enclosure?.['@_url'] || item['media:thumbnail']?.['@_url'] || undefined,
      author: item.author || item['dc:creator'] || undefined,
    }));
    return { title: channel.title ? String(channel.title) : undefined, items };
  }

  // Atom
  if (parsed.feed) {
    const feed = parsed.feed;
    const rawEntries = feed.entry || [];
    const items: FeedItem[] = rawEntries.map((entry: any) => {
      const link = Array.isArray(entry.link)
        ? entry.link.find((l: any) => l['@_rel'] === 'alternate' || !l['@_rel'])?.['@_href'] || entry.link[0]?.['@_href']
        : entry.link?.['@_href'] || String(entry.link || '');
      return {
        title: String(entry.title?.['#text'] || entry.title || '').slice(0, 256),
        link: String(link),
        description: entry.summary
          ? stripHtml(String(entry.summary?.['#text'] || entry.summary)).slice(0, 500)
          : entry.content
            ? stripHtml(String(entry.content?.['#text'] || entry.content)).slice(0, 500)
            : undefined,
        guid: String(entry.id || link || ''),
        pubDate: entry.published ? new Date(entry.published) : entry.updated ? new Date(entry.updated) : undefined,
        image: undefined,
        author: entry.author?.name ? String(entry.author.name) : undefined,
      };
    });
    return { title: feed.title ? String(feed.title?.['#text'] || feed.title) : undefined, items };
  }

  return { items: [] };
}

function extractLink(link: any): string {
  if (typeof link === 'string') return link;
  if (link?.['@_href']) return String(link['@_href']);
  if (link?.['#text']) return String(link['#text']);
  return '';
}

/** Strip basic HTML tags for plain text display. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Main processor
// ---------------------------------------------------------------------------

export async function processRssFeedPoller(): Promise<void> {
  try {
    // Find feeds that are due for a poll
    const dueFeeds = await db
      .select()
      .from(rssFeeds)
      .where(
        and(
          eq(rssFeeds.enabled, true),
          or(
            isNull(rssFeeds.lastFetchedAt),
            sql`${rssFeeds.lastFetchedAt} + (${rssFeeds.pollIntervalMinutes} || ' minutes')::interval < now()`,
          ),
        ),
      );

    if (dueFeeds.length === 0) return;

    logger.debug(`[rss-poller] ${dueFeeds.length} feed(s) due for polling`);

    for (const feed of dueFeeds) {
      try {
        await pollSingleFeed(feed);
      } catch (err) {
        logger.error({ msg: '[rss-poller] error polling feed', feedId: feed.id, feedUrl: feed.feedUrl, err });
        // Still update lastFetchedAt so we don't hammer a broken feed
        await db
          .update(rssFeeds)
          .set({ lastFetchedAt: new Date() })
          .where(eq(rssFeeds.id, feed.id));
      }
    }
  } catch (err) {
    logger.error('[rss-poller] top-level error:', err);
  }
}

async function pollSingleFeed(feed: typeof rssFeeds.$inferSelect): Promise<void> {
  // Fetch the XML
  const res = await fetch(feed.feedUrl, {
    headers: {
      'User-Agent': 'Gratonite/1.0 (RSS feed reader)',
      Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${feed.feedUrl}`);
  }

  const xml = await res.text();
  const { title: feedTitle, items } = parseFeedXml(xml);

  if (items.length === 0) {
    await db.update(rssFeeds).set({ lastFetchedAt: new Date() }).where(eq(rssFeeds.id, feed.id));
    return;
  }

  // Auto-set feed title if not set
  if (!feed.title && feedTitle) {
    await db.update(rssFeeds).set({ title: feedTitle.slice(0, 200) }).where(eq(rssFeeds.id, feed.id));
    feed = { ...feed, title: feedTitle.slice(0, 200) };
  }

  // Filter to new items only (after lastItemGuid or all if first fetch)
  let newItems: FeedItem[];
  if (feed.lastItemGuid) {
    const lastIdx = items.findIndex((i) => i.guid === feed.lastItemGuid);
    if (lastIdx <= 0) {
      // lastItemGuid not found or is the first item — check by date
      if (feed.lastFetchedAt) {
        newItems = items.filter((i) => i.pubDate && i.pubDate > feed.lastFetchedAt!);
      } else {
        newItems = items.slice(0, 5); // First fetch: post at most 5
      }
    } else {
      newItems = items.slice(0, lastIdx);
    }
  } else {
    // First time — post only the latest 3 items
    newItems = items.slice(0, 3);
  }

  // Apply content filter if configured
  if (feed.contentFilter) {
    try {
      const regex = new RegExp(feed.contentFilter, 'i');
      newItems = newItems.filter(
        (item) => regex.test(item.title) || (item.description && regex.test(item.description)),
      );
    } catch {
      // Invalid regex — skip filtering
    }
  }

  // Cap to 10 items per poll to avoid spam
  newItems = newItems.slice(0, 10);

  // Post items in reverse (oldest first)
  const io = getIO();
  for (const item of newItems.reverse()) {
    const embed = {
      type: 'rss',
      url: item.link,
      title: item.title,
      description: item.description,
      color: '#f26522',
      fields: [] as { name: string; value: string; inline?: boolean }[],
      image: item.image || undefined,
      footer: feed.title || feedTitle || new URL(feed.feedUrl).hostname,
    };

    if (item.author) {
      embed.fields.push({ name: 'Author', value: item.author, inline: true });
    }
    if (item.pubDate) {
      embed.fields.push({
        name: 'Published',
        value: item.pubDate.toLocaleDateString(),
        inline: true,
      });
    }

    const content = `**${item.title}**\n${item.link}`;

    const [newMessage] = await db
      .insert(messages)
      .values({
        channelId: feed.channelId,
        authorId: null, // System/bot message (no author)
        content,
        embeds: [embed],
      })
      .returning();

    // Emit socket event
    io.to(`channel:${feed.channelId}`).emit('MESSAGE_CREATE', {
      ...newMessage,
      author: {
        id: 'system',
        username: 'RSS Feed',
        displayName: feed.title || feedTitle || 'RSS Feed',
        avatarUrl: null,
      },
    });
  }

  // Update tracking
  const latestGuid = items[0]?.guid || feed.lastItemGuid;
  await db
    .update(rssFeeds)
    .set({
      lastFetchedAt: new Date(),
      lastItemGuid: latestGuid,
    })
    .where(eq(rssFeeds.id, feed.id));

  if (newItems.length > 0) {
    logger.debug(`[rss-poller] Posted ${newItems.length} item(s) from feed ${feed.id}`);
  }
}
