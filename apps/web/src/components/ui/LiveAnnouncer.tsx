/**
 * LiveAnnouncer — Hidden ARIA live region for screen reader announcements.
 * Usage: import { announce, announceAssertive } from './LiveAnnouncer';
 *   announce('New message from Alice');          // polite
 *   announceAssertive('Error: connection lost'); // assertive (interrupts)
 */

import { useEffect, useRef } from 'react';

type QueuedMsg = { text: string; priority: 'polite' | 'assertive' };
let queue: QueuedMsg[] = [];
let setPolite: ((msg: string) => void) | null = null;
let setAssertive: ((msg: string) => void) | null = null;

function enqueue(text: string, priority: 'polite' | 'assertive') {
  const setter = priority === 'assertive' ? setAssertive : setPolite;
  if (setter) {
    setter(text);
  } else {
    queue.push({ text, priority });
  }
}

/** Announce politely — screen reader reads after current speech */
export function announce(message: string): void {
  enqueue(message, 'polite');
}

/** Announce assertively — interrupts current speech (use for errors) */
export function announceAssertive(message: string): void {
  enqueue(message, 'assertive');
}

const srOnly: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

function makeUpdater(ref: React.RefObject<HTMLDivElement | null>) {
  return (msg: string) => {
    if (ref.current) {
      ref.current.textContent = '';
      requestAnimationFrame(() => {
        if (ref.current) ref.current.textContent = msg;
      });
    }
  };
}

export default function LiveAnnouncer() {
  const politeRef = useRef<HTMLDivElement>(null);
  const assertiveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPolite = makeUpdater(politeRef);
    setAssertive = makeUpdater(assertiveRef);

    // Flush queued announcements
    while (queue.length > 0) {
      const item = queue.shift()!;
      (item.priority === 'assertive' ? setAssertive : setPolite)(item.text);
    }

    return () => { setPolite = null; setAssertive = null; };
  }, []);

  return (
    <>
      <div ref={politeRef} role="status" aria-live="polite" aria-atomic="true" style={srOnly} />
      <div ref={assertiveRef} role="alert" aria-live="assertive" aria-atomic="true" style={srOnly} />
    </>
  );
}
