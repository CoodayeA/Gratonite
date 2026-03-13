import { useCallback } from 'react';
import { announce, announceAssertive } from '../components/ui/LiveAnnouncer';
import { useTheme } from '../components/ui/ThemeProvider';

/**
 * Hook that provides screen-reader announcement functions.
 * Announcements are only emitted when screen reader mode is enabled.
 */
export function useAnnounce() {
  const { screenReaderMode } = useTheme();

  const announcePolite = useCallback(
    (message: string) => { if (screenReaderMode) announce(message); },
    [screenReaderMode],
  );

  const announceUrgent = useCallback(
    (message: string) => { if (screenReaderMode) announceAssertive(message); },
    [screenReaderMode],
  );

  return { announce: announcePolite, announceAssertive: announceUrgent, screenReaderMode };
}
