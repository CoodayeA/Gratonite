import { useState, useEffect, useCallback } from 'react';
import { X, Lightbulb } from 'lucide-react';

const STORAGE_KEY = 'gratonite:dismissed-tips';

function getDismissedTips(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function dismissTip(id: string): void {
  try {
    const current = getDismissedTips();
    current.add(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...current]));
  } catch { /* no-op */ }
}

export function useFeatureTip(id: string): { show: boolean; dismiss: () => void } {
  const [show, setShow] = useState<boolean>(() => !getDismissedTips().has(id));

  const dismiss = useCallback(() => {
    setShow(false);
    dismissTip(id);
  }, [id]);

  return { show, dismiss };
}

interface FeatureTipProps {
  id: string;
  message: string;
  /** Optional delay in ms before showing the tip (default 1500) */
  delay?: number;
  position?: 'top' | 'bottom';
}

/** Contextual first-visit tip that auto-dismisses on interaction and stores state in localStorage. */
export function FeatureTip({ id, message, delay = 1500, position = 'bottom' }: FeatureTipProps) {
  const { show, dismiss } = useFeatureTip(id);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [show, delay]);

  if (!show || !visible) return null;

  const isBottom = position === 'bottom';

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'absolute',
        [isBottom ? 'top' : 'bottom']: 'calc(100% + 8px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--accent-primary)',
        borderRadius: '10px',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        maxWidth: '260px',
        whiteSpace: 'normal',
        animation: 'fadeInUp 0.25s ease-out',
        pointerEvents: 'all',
      }}
    >
      <Lightbulb size={14} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '1px' }} />
      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', flex: 1 }}>{message}</span>
      <button
        onClick={dismiss}
        aria-label="Dismiss tip"
        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0', flexShrink: 0, display: 'flex' }}
      >
        <X size={12} />
      </button>
    </div>
  );
}

export default FeatureTip;
