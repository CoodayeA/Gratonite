import { useEffect, useRef } from 'react';
import { api } from '../lib/api';

declare global {
  interface Window {
    gratoniteDesktop?: {
      isDesktop: boolean;
      onGameDetected?: (cb: (data: { name: string; startedAt: number }) => void) => (() => void);
      onGameStopped?: (cb: () => void) => (() => void);
    };
  }
}

export function useGameActivity() {
  const cleanupRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    const desktop = window.gratoniteDesktop;
    if (!desktop?.isDesktop || !desktop.onGameDetected || !desktop.onGameStopped) return;

    const unsub1 = desktop.onGameDetected((data) => {
      api.users.setActivity({ type: 'PLAYING', name: data.name }).catch(() => {});
    });

    const unsub2 = desktop.onGameStopped(() => {
      api.users.clearActivity().catch(() => {});
    });

    if (unsub1) cleanupRef.current.push(unsub1);
    if (unsub2) cleanupRef.current.push(unsub2);

    return () => {
      cleanupRef.current.forEach(fn => fn());
      cleanupRef.current = [];
    };
  }, []);
}
