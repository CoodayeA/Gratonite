/**
 * LiveAnnouncer — Hidden ARIA live region for screen reader announcements.
 * Usage: import { announce } from './LiveAnnouncer'; announce('New message from Alice');
 */

import { useEffect, useRef } from 'react';

let announceQueue: string[] = [];
let setMessageFn: ((msg: string) => void) | null = null;

export function announce(message: string): void {
  if (setMessageFn) {
    setMessageFn(message);
  } else {
    announceQueue.push(message);
  }
}

export default function LiveAnnouncer() {
  const regionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessageFn = (msg: string) => {
      if (regionRef.current) {
        // Clear then set to trigger re-announcement
        regionRef.current.textContent = '';
        requestAnimationFrame(() => {
          if (regionRef.current) regionRef.current.textContent = msg;
        });
      }
    };
    // Flush queued announcements
    while (announceQueue.length > 0) {
      const msg = announceQueue.shift();
      if (msg) setMessageFn(msg);
    }
    return () => { setMessageFn = null; };
  }, []);

  return (
    <div
      ref={regionRef}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    />
  );
}
