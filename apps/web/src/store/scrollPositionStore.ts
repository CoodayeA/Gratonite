// ---------------------------------------------------------------------------
// Scroll Position Memory
// Saves and restores scroll position per channel so users return to where
// they left off when switching channels.
// ---------------------------------------------------------------------------

const positions = new Map<string, number>();

/** Save scroll position for a channel. */
export function saveScrollPosition(channelId: string, scrollTop: number) {
  positions.set(channelId, scrollTop);
}

/** Retrieve (and optionally clear) the saved scroll position. */
export function getScrollPosition(channelId: string): number | null {
  const pos = positions.get(channelId);
  return pos ?? null;
}

/** Remove saved position (e.g. when the channel is fully read). */
export function clearScrollPosition(channelId: string) {
  positions.delete(channelId);
}
