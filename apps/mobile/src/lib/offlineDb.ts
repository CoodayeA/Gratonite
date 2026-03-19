import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import { subtle, getRandomValues } from './cryptoPolyfill';
import { Buffer } from 'buffer';
import type { Message } from '../types';

// ---------------------------------------------------------------------------
// Cache encryption key management (encapsulated in closure)
// ---------------------------------------------------------------------------

const cacheKeyManager = (() => {
  const CACHE_KEY_STORE = 'gratonite_cache_encryption_key';
  let cacheKey: CryptoKey | null = null;

  async function getKey(): Promise<CryptoKey | null> {
    if (cacheKey) return cacheKey;
    try {
      const stored = await SecureStore.getItemAsync(CACHE_KEY_STORE);
      if (stored) {
        const raw = new Uint8Array(Buffer.from(stored, 'base64'));
        cacheKey = await subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
        return cacheKey;
      }
      const key = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
      const rawExported = await subtle.exportKey('raw', key);
      await SecureStore.setItemAsync(CACHE_KEY_STORE, Buffer.from(new Uint8Array(rawExported)).toString('base64'));
      cacheKey = key;
      return cacheKey;
    } catch {
      return null;
    }
  }

  return {
    getKey,
    async clear(): Promise<void> {
      await SecureStore.deleteItemAsync(CACHE_KEY_STORE);
      cacheKey = null;
    },
  };
})();

async function encryptForCache(plaintext: string): Promise<string> {
  const key = await cacheKeyManager.getKey();
  if (!key) return plaintext;
  try {
    const iv = getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    const combined = new Uint8Array(iv.byteLength + ct.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ct), iv.byteLength);
    return Buffer.from(combined).toString('base64');
  } catch {
    return plaintext;
  }
}

async function decryptFromCache(ciphertext: string): Promise<string> {
  const key = await cacheKeyManager.getKey();
  if (!key) return ciphertext;
  try {
    const combined = new Uint8Array(Buffer.from(ciphertext, 'base64'));
    const iv = combined.slice(0, 12);
    const ct = combined.slice(12);
    const plaintext = await subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return new TextDecoder().decode(plaintext);
  } catch {
    return ciphertext;
  }
}

export async function clearCacheEncryptionKey(): Promise<void> {
  await cacheKeyManager.clear();
}

let db: SQLite.SQLiteDatabase | null = null;
const channelLocks = new Map<string, Promise<void>>();

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('gratonite_offline.db');
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS cached_messages (
        id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        author_id TEXT NOT NULL,
        content TEXT NOT NULL,
        type INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        edited_at TEXT,
        author_json TEXT,
        attachments_json TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_cached_messages_channel ON cached_messages(channel_id);

      CREATE TABLE IF NOT EXISTS cached_channels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        guild_id TEXT,
        type TEXT,
        data_json TEXT
      );

      CREATE TABLE IF NOT EXISTS pending_sends (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        is_encrypted INTEGER DEFAULT 0,
        encrypted_content TEXT
      );
    `);
  }
  return db;
}

async function withChannelLock<T>(channelId: string, fn: () => Promise<T>): Promise<T> {
  const existing = channelLocks.get(channelId) ?? Promise.resolve();
  let resolve: () => void;
  const next = new Promise<void>((r) => { resolve = r; });
  channelLocks.set(channelId, next);
  await existing;
  try {
    return await fn();
  } finally {
    resolve!();
    if (channelLocks.get(channelId) === next) {
      channelLocks.delete(channelId);
    }
  }
}

export async function cacheMessages(channelId: string, messages: Message[]): Promise<void> {
  return withChannelLock(channelId, async () => {
    const database = await getDb();
    await database.runAsync('DELETE FROM cached_messages WHERE channel_id = ?', [channelId]);
    for (const msg of messages.slice(-50)) {
      const encContent = await encryptForCache(msg.content);
      const encAuthor = msg.author ? await encryptForCache(JSON.stringify(msg.author)) : null;
      await database.runAsync(
        'INSERT OR REPLACE INTO cached_messages (id, channel_id, author_id, content, type, created_at, edited_at, author_json, attachments_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          msg.id,
          msg.channelId,
          msg.authorId,
          encContent,
          msg.type,
          msg.createdAt,
          msg.editedAt || null,
          encAuthor,
          msg.attachments ? JSON.stringify(msg.attachments) : null,
        ]
      );
    }
  });
}

export async function getCachedMessages(channelId: string): Promise<Message[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<{
    id: string;
    channel_id: string;
    author_id: string;
    content: string;
    type: number;
    created_at: string;
    edited_at: string | null;
    author_json: string | null;
    attachments_json: string | null;
  }>('SELECT * FROM cached_messages WHERE channel_id = ? ORDER BY created_at ASC', [channelId]);

  const results: Message[] = [];
  for (const row of rows) {
    const content = await decryptFromCache(row.content);
    const authorStr = row.author_json ? await decryptFromCache(row.author_json) : null;
    results.push({
      id: row.id,
      channelId: row.channel_id,
      authorId: row.author_id,
      content,
      type: row.type,
      createdAt: row.created_at,
      editedAt: row.edited_at,
      author: authorStr ? JSON.parse(authorStr) : undefined,
      attachments: row.attachments_json ? JSON.parse(row.attachments_json) : undefined,
    });
  }
  return results;
}

export async function queueSend(channelId: string, content: string, encrypted?: { isEncrypted: boolean; encryptedContent: string }): Promise<void> {
  const database = await getDb();
  const encContent = await encryptForCache(content);
  await database.runAsync(
    'INSERT INTO pending_sends (channel_id, content, created_at, is_encrypted, encrypted_content) VALUES (?, ?, ?, ?, ?)',
    [channelId, encContent, new Date().toISOString(), encrypted?.isEncrypted ? 1 : 0, encrypted?.encryptedContent ?? null]
  );
}

export async function getPendingQueue(): Promise<Array<{ id: number; channelId: string; content: string; isEncrypted: boolean; encryptedContent: string | null }>> {
  const database = await getDb();
  const rows = await database.getAllAsync<{ id: number; channel_id: string; content: string; is_encrypted: number; encrypted_content: string | null }>(
    'SELECT id, channel_id, content, is_encrypted, encrypted_content FROM pending_sends ORDER BY id ASC'
  );
  const results = [];
  for (const r of rows) {
    const content = await decryptFromCache(r.content);
    results.push({ id: r.id, channelId: r.channel_id, content, isEncrypted: !!r.is_encrypted, encryptedContent: r.encrypted_content });
  }
  return results;
}

export async function removePending(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync('DELETE FROM pending_sends WHERE id = ?', [id]);
}

export async function closeDb(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
  cacheKey = null;
}
