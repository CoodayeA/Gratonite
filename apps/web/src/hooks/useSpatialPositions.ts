import { useEffect, useRef, useCallback, useState } from 'react';
import {
  getSocket,
  onSpatialPositionUpdate,
  onSpatialPositionsSync,
  SpatialPositionUpdatePayload,
  SpatialPositionsSyncPayload,
} from '../lib/socket';

/** Simple deterministic hash from string → 0–1 */
function hashToUnit(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % 10000) / 10000;
}

function initialPosition(userId: string): { x: number; y: number } {
  // Place users in the inner 60% of the canvas (0.2–0.8)
  const hx = hashToUnit(userId + '_x');
  const hy = hashToUnit(userId + '_y');
  return { x: 0.2 + hx * 0.6, y: 0.2 + hy * 0.6 };
}

export interface UseSpatialPositionsReturn {
  positions: Map<string, { x: number; y: number }>;
  localPosition: { x: number; y: number };
  updateLocalPosition: (x: number, y: number) => void;
}

export function useSpatialPositions(
  channelId: string | undefined,
  localUserId: string | undefined,
  enabled: boolean,
): UseSpatialPositionsReturn {
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const localPosRef = useRef<{ x: number; y: number }>(
    localUserId ? initialPosition(localUserId) : { x: 0.5, y: 0.5 },
  );
  const [localPosition, setLocalPosition] = useState(localPosRef.current);
  const lastEmitRef = useRef(0);
  const lastEmittedRef = useRef<{ x: number; y: number }>({ x: -1, y: -1 });

  // When localUserId changes, recalculate initial position
  useEffect(() => {
    if (localUserId) {
      const pos = initialPosition(localUserId);
      localPosRef.current = pos;
      setLocalPosition(pos);
    }
  }, [localUserId]);

  // Request all positions on mount / when enabled
  useEffect(() => {
    if (!enabled || !channelId) return;
    const socket = getSocket();
    if (socket) {
      socket.emit('SPATIAL_POSITIONS_REQUEST', { channelId });
    }
  }, [enabled, channelId]);

  // Listen for position updates from other users
  useEffect(() => {
    if (!enabled || !channelId) return;

    const offUpdate = onSpatialPositionUpdate((data: SpatialPositionUpdatePayload) => {
      if (data.channelId !== channelId) return;
      setPositions(prev => {
        const next = new Map(prev);
        next.set(data.userId, { x: data.x, y: data.y });
        return next;
      });
    });

    const offSync = onSpatialPositionsSync((data: SpatialPositionsSyncPayload) => {
      if (data.channelId !== channelId) return;
      const map = new Map<string, { x: number; y: number }>();
      for (const [uid, pos] of Object.entries(data.positions)) {
        map.set(uid, pos);
      }
      setPositions(map);
    });

    return () => {
      offUpdate();
      offSync();
    };
  }, [enabled, channelId]);

  // Throttled local position emitter
  const updateLocalPosition = useCallback((x: number, y: number) => {
    localPosRef.current = { x, y };
    setLocalPosition({ x, y });

    if (!channelId) return;

    const now = Date.now();
    // Throttle to 66ms (15 updates/sec)
    if (now - lastEmitRef.current < 66) return;

    // Only emit if position changed by > 0.5%
    const dx = Math.abs(x - lastEmittedRef.current.x);
    const dy = Math.abs(y - lastEmittedRef.current.y);
    if (dx < 0.005 && dy < 0.005) return;

    lastEmitRef.current = now;
    lastEmittedRef.current = { x, y };

    const socket = getSocket();
    if (socket) {
      socket.emit('SPATIAL_POSITION_UPDATE', { channelId, x, y });
    }
  }, [channelId]);

  return { positions, localPosition, updateLocalPosition };
}
