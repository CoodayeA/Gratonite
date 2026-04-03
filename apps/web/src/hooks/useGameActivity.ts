import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

export function useGameActivity() {
  const cleanupRef = useRef<Array<() => void>>([]);
  const [showGameActivity, setShowGameActivity] = useState(() => {
    return localStorage.getItem('gratonite_show_game_activity') !== 'false';
  });

  useEffect(() => {
    const desktop = window.gratoniteDesktop;
    if (!desktop?.isDesktop || !desktop.onGameDetected || !desktop.onGameStopped) return;

    // Task #104: Respect game activity toggle
    if (!showGameActivity) {
      desktop.setGameActivityEnabled?.(false);
      return;
    }

    desktop.setGameActivityEnabled?.(true);

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
  }, [showGameActivity]);

  const toggleGameActivity = (enabled: boolean) => {
    setShowGameActivity(enabled);
    localStorage.setItem('gratonite_show_game_activity', String(enabled));
  };

  return { showGameActivity, toggleGameActivity };
}
