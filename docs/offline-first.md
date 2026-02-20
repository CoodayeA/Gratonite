# Offline-First Strategy (Phase 7)

This document captures the offline data strategy for mobile (WatermelonDB) and desktop caching.

## Mobile (WatermelonDB)

### Cached entities

- User, settings, presence (last known)
- Guilds, channels, roles
- Channel memberships and unread state
- Last N messages per channel (configurable)
- Pinned messages
- Drafts, uploads queue

### Sync boundaries

- Messages: incremental by channel + last message id
- Reactions: incremental by message
- Threads: lazy load per parent channel
- Presence/typing: live only (not persisted)

### Conflict resolution

- Drafts are local-only until send
- Message edits use server timestamps as source of truth
- Reactions are last-write-wins

## Desktop

- Cache last N messages and channel metadata for quick load
- Sync on focus restore

## UX Guidelines

- Show “Offline” banner + retry status
- Queue outgoing actions and surface send failures
- Minimize sync spinners; show subtle status pills
