import fs from 'node:fs/promises';
import { logger } from '../lib/logger';
import path from 'node:path';
import { db } from '../db/index';
import { dataExports } from '../db/schema/data-exports';
import { messages } from '../db/schema/messages';
import { users } from '../db/schema/users';
import { guildMembers } from '../db/schema/guilds';
import { themes } from '../db/schema/themes';
import { userSettings } from '../db/schema/settings';
import { eq, desc } from 'drizzle-orm';

export async function startDataExport(userId: string, exportId: string): Promise<void> {
  try {
    await db.update(dataExports).set({ status: 'processing' }).where(eq(dataExports.id, exportId));

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const userMessages = await db.select().from(messages).where(eq(messages.authorId, userId)).orderBy(desc(messages.createdAt)).limit(1000);
    const memberships = await db.select().from(guildMembers).where(eq(guildMembers.userId, userId));

    // Item 81: Include theme preferences and created themes in GDPR export
    const userThemes = await db.select().from(themes).where(eq(themes.creatorId, userId));
    const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);

    const exportData = {
      exportedAt: new Date().toISOString(),
      user: { id: user.id, username: user.username, email: user.email, createdAt: user.createdAt },
      messages: userMessages.map(m => ({ id: m.id, channelId: m.channelId, content: m.content, createdAt: m.createdAt })),
      guildMemberships: memberships.map(m => ({ guildId: m.guildId, joinedAt: m.joinedAt })),
      themePreferences: settings ? {
        theme: settings.theme,
        colorMode: settings.colorMode,
        accentColor: settings.accentColor,
        customThemeId: (settings as Record<string, unknown>).customThemeId ?? null,
        themePreferences: (settings as Record<string, unknown>).themePreferences ?? null,
      } : null,
      createdThemes: userThemes.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        variables: t.variables,
        tags: t.tags,
        published: t.published,
        downloads: t.downloads,
        createdAt: t.createdAt,
      })),
    };

    const exportsDir = '/tmp/exports';
    await fs.mkdir(exportsDir, { recursive: true });
    const filePath = path.join(exportsDir, `export-${exportId}.json`);
    await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.update(dataExports).set({
      status: 'ready',
      downloadUrl: `/api/v1/users/@me/data-export/${exportId}/download`,
      expiresAt,
    }).where(eq(dataExports.id, exportId));
  } catch (err) {
    logger.error('[dataExport] Error:', err);
    await db.update(dataExports).set({ status: 'pending' }).where(eq(dataExports.id, exportId)).catch(() => {});
  }
}
