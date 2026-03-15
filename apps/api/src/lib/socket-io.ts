/**
 * lib/socket-io.ts — Shared Socket.io server instance accessor.
 *
 * This module uses a simple setter/getter pattern so that the Socket.io
 * `Server` instance created in `src/index.ts` is available to route handlers
 * that need to emit real-time events (e.g. MESSAGE_CREATE, TYPING_START) without
 * creating circular import chains.
 *
 * Usage:
 *   // In src/index.ts (after creating `io`):
 *   import { setIO } from './lib/socket-io';
 *   setIO(io);
 *
 *   // In any route handler:
 *   import { getIO } from '../lib/socket-io';
 *   getIO().to(`channel:${channelId}`).emit('message:new', payload);
 *
 * Why not just export `io` directly?
 *   The `io` instance is created at runtime after the HTTP server is set up.
 *   A direct export would be `undefined` at module-load time, causing failures
 *   in route handlers that import it before `src/index.ts` has run. The
 *   setter/getter pattern defers the reference until the first emit call,
 *   by which point `io` is always initialised.
 */

import { Server as SocketIOServer } from 'socket.io';
import { logger } from './logger';

/** The single Socket.io server instance, set once at startup. */
let _io: SocketIOServer | null = null;

/**
 * setIO — Store the Socket.io server instance.
 *
 * Must be called once in `src/index.ts` immediately after creating the
 * Socket.io server, before any HTTP requests are handled.
 *
 * @param io - The Socket.io `Server` instance to store.
 */
export function setIO(io: SocketIOServer): void {
  _io = io;
}

/**
 * getIO — Retrieve the Socket.io server instance.
 *
 * Throws if `setIO` has not been called yet, which would indicate a startup
 * ordering bug (route handler invoked before the server was initialised).
 *
 * @returns The Socket.io `Server` instance.
 * @throws  Error if the instance has not been initialised.
 */
export function getIO(): SocketIOServer {
  if (!_io) {
    throw new Error('Socket.io instance has not been initialised. Call setIO() first.');
  }
  return _io;
}

/**
 * emitSafe — Emit a Socket.io event, swallowing any errors with a debug log.
 *
 * Useful in route handlers where socket emit failures should not break the
 * HTTP response flow (e.g. when Socket.io is not initialised in tests, or
 * a room/socket has already disconnected).
 *
 * @param socket  Any object with an `emit` method (Socket.io Server, Room, etc.)
 * @param event   The event name to emit.
 * @param args    Arguments forwarded to `socket.emit`.
 */
export function emitSafe(socket: { emit: (...a: any[]) => any }, event: string, ...args: any[]): void {
  try {
    socket.emit(event, ...args);
  } catch (err) {
    logger.debug({ msg: 'socket emit failed', event, err });
  }
}
