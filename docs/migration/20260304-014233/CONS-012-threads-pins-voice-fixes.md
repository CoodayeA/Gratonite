# CONS-012: Threads, Pinned Messages, and Voice Presence Fixes

**Task ID:** CONS-012  
**Status:** In Progress  
**Owner:** Engineering  
**Timestamp:** 2026-03-04T01:50:00Z

## Issues Identified

### 1. Threads Functionality
**Problems:**
- ThreadPanel component has no backend integration (UI only)
- ForumChannel sends messages with wrong channelId (used threadId instead)
- No real-time thread updates via socket.io
- Backend doesn't accept threadId parameter in message creation

**Root Cause:**
- Missing threadId support in message creation API
- Incorrect API call in ForumChannel component
- Missing socket.io event listeners

### 2. Pinned Messages
**Problems:**
- No real-time updates when other users pin/unpin messages
- Requires manual refresh to see pin changes
- Socket.io event emitted but not consumed

**Root Cause:**
- CHANNEL_PINS_UPDATE event emitted by backend but no frontend listener

### 3. Voice Chat User Presence
**Problems:**
- No UI showing which users are in voice channels
- Voice presence not displayed under channel names
- voice-states API endpoint exists but never called
- VOICE_STATE_UPDATE events not used in UI

**Root Cause:**
- Missing UI component to display voice participants
- No integration between voice-states API and channel display

## Fixes Applied

### Socket.io Event Listeners (apps/web/src/lib/socket.ts)
✓ Added ThreadCreatePayload interface
✓ Added ChannelPinsUpdatePayload interface
✓ Added threadCreateListeners registry
✓ Added channelPinsUpdateListeners registry
✓ Added onThreadCreate() export function
✓ Added onChannelPinsUpdate() export function
✓ Added THREAD_CREATE event listener
✓ Added CHANNEL_PINS_UPDATE event listener

### Thread Message Support
✓ Added threadId to sendMessageSchema (apps/api/src/routes/messages.ts)
✓ Added threadId parameter extraction in POST handler
✓ Added threadId to message insertion values
✓ Added threadId to api.messages.send() signature (apps/web/src/lib/api.ts)
✓ Fixed ForumChannel to use correct channelId with threadId parameter

### Fixes Remaining

#### Pinned Messages Real-Time Updates
- [ ] Add socket listener in ChannelChat component
- [ ] Update pinnedMessages state when CHANNEL_PINS_UPDATE received
- [ ] Test pin/unpin real-time sync

#### Voice Presence Display
- [ ] Create VoicePresence component to show users in voice
- [ ] Fetch voice-states when displaying voice channels
- [ ] Subscribe to VOICE_STATE_UPDATE events
- [ ] Display participant count under voice channel names
- [ ] Update count in real-time when users join/leave

#### Thread Real-Time Updates
- [ ] Add socket listener in ForumChannel/QAChannel
- [ ] Update thread list when THREAD_CREATE received
- [ ] Test thread creation real-time sync

## Files Modified

### Backend
- `apps/api/src/routes/messages.ts` - Added threadId support

### Frontend
- `apps/web/src/lib/socket.ts` - Added event listeners
- `apps/web/src/lib/api.ts` - Added threadId parameter
- `apps/web/src/pages/guilds/ForumChannel.tsx` - Fixed message sending

## Next Steps
1. Complete pinned messages real-time updates
2. Implement voice presence display
3. Add thread real-time updates
4. Test all functionality
5. Document and verify

## Verification Commands
```bash
# Backend
cd apps/api
pnpm run build
pnpm run lint

# Frontend
cd apps/web
pnpm run build
pnpm run lint
```
