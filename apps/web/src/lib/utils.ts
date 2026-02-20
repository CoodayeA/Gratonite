/**
 * Format a timestamp for message display.
 * - Today: "Today at 3:45 PM"
 * - Yesterday: "Yesterday at 3:45 PM"
 * - Older: "02/20/2026 3:45 PM"
 */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isToday) return `Today at ${time}`;
  if (isYesterday) return `Yesterday at ${time}`;
  return `${date.toLocaleDateString()} ${time}`;
}

/**
 * Format a short relative timestamp (for compact mode).
 */
export function formatShortTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * Format typing indicator text.
 * - 1 user: "Alice is typing..."
 * - 2 users: "Alice and Bob are typing..."
 * - 3+ users: "Several people are typing..."
 */
export function formatTypingText(usernames: string[]): string {
  if (usernames.length === 0) return '';
  if (usernames.length === 1) return `${usernames[0]} is typing...`;
  if (usernames.length === 2) return `${usernames[0]} and ${usernames[1]} are typing...`;
  return 'Several people are typing...';
}

/**
 * Extract initials from a name (for avatar fallback).
 * "Arclight Guild" -> "AG"
 * "general" -> "G"
 */
export function getInitials(name: string, maxLength = 2): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .slice(0, maxLength)
    .join('');
}

/**
 * Determine if two consecutive messages should be grouped
 * (same author, within 7 minutes, no special type).
 */
export function shouldGroupMessages(
  prev: { authorId: string; createdAt: string; type?: number } | undefined,
  curr: { authorId: string; createdAt: string; type?: number },
): boolean {
  if (!prev) return false;
  if (prev.authorId !== curr.authorId) return false;
  if (prev.type !== undefined && prev.type !== 0) return false;
  if (curr.type !== undefined && curr.type !== 0) return false;

  const prevTime = new Date(prev.createdAt).getTime();
  const currTime = new Date(curr.createdAt).getTime();
  return currTime - prevTime < 7 * 60 * 1000; // 7 minutes
}

/**
 * Generate a random nonce for optimistic messages.
 */
export function generateNonce(): string {
  return crypto.randomUUID();
}
