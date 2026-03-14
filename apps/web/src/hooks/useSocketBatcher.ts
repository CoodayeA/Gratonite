/**
 * useSocketBatcher.ts — Batches rapid-fire WebSocket events (typing, presence)
 * into single React state updates using requestAnimationFrame to avoid thrashing.
 *
 * Phase 9, Item 153: WebSocket message batching
 */

import { useEffect, useRef, useCallback } from 'react';

type EventCallback<T> = (events: T[]) => void;

/**
 * Batches incoming events and delivers them in a single callback per animation frame.
 * Useful for high-frequency events like typing indicators and presence updates.
 */
export function useSocketBatcher<T>(callback: EventCallback<T>): (event: T) => void {
  const bufferRef = useRef<T[]>([]);
  const rafRef = useRef<number | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const flush = useCallback(() => {
    rafRef.current = null;
    if (bufferRef.current.length > 0) {
      const batch = bufferRef.current;
      bufferRef.current = [];
      callbackRef.current(batch);
    }
  }, []);

  const enqueue = useCallback((event: T) => {
    bufferRef.current.push(event);
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(flush);
    }
  }, [flush]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return enqueue;
}

/**
 * Non-hook version for use outside React components.
 * Creates a batcher that collects events and flushes once per rAF.
 */
export function createEventBatcher<T>(callback: EventCallback<T>) {
  let buffer: T[] = [];
  let rafId: number | null = null;

  function flush() {
    rafId = null;
    if (buffer.length > 0) {
      const batch = buffer;
      buffer = [];
      callback(batch);
    }
  }

  function enqueue(event: T) {
    buffer.push(event);
    if (rafId === null) {
      rafId = requestAnimationFrame(flush);
    }
  }

  function destroy() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    buffer = [];
  }

  return { enqueue, destroy };
}
