import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { useUiStore } from '@/stores/ui.store';

interface ModalProps {
  id: string;
  title: string;
  children: ReactNode;
  onClose?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

const sizeWidths = {
  sm: 360,
  md: 440,
  lg: 560,
} as const;

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    display: 'grid',
    placeItems: 'center',
    background: 'rgba(0, 0, 0, 0.55)',
    backdropFilter: 'blur(12px) saturate(120%)',
    WebkitBackdropFilter: 'blur(12px) saturate(120%)',
    animation: 'modalOverlayIn 0.15s ease',
  } as React.CSSProperties,
  content: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-xl)',
    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.4)',
    maxHeight: '90vh',
    overflowY: 'auto',
    animation: 'modalContentIn 0.2s ease',
  } as React.CSSProperties,
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px 0',
  } as React.CSSProperties,
  title: {
    fontSize: 18,
    fontWeight: 700,
    margin: 0,
  } as React.CSSProperties,
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: 20,
    width: 32,
    height: 32,
    display: 'grid',
    placeItems: 'center',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'all 0.1s ease',
  } as React.CSSProperties,
  closeBtnHover: {
    background: 'rgba(255, 255, 255, 0.06)',
    color: 'var(--text)',
  } as React.CSSProperties,
  body: {
    padding: '20px 24px 24px',
  } as React.CSSProperties,
};

export function Modal({ id, title, children, onClose, size = 'md' }: ModalProps) {
  const activeModal = useUiStore((s) => s.activeModal);
  const closeModal = useUiStore((s) => s.closeModal);
  const modalRef = useRef<HTMLDivElement>(null);
  const [closeHover, setCloseHover] = useState(false);

  const isOpen = activeModal === id;

  function handleClose() {
    closeModal();
    onClose?.();
  }

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const focusable = modalRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    first?.focus();

    function onTab(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      if (!first || !last) return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onTab);
    return () => document.removeEventListener('keydown', onTab);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={handleClose}>
      <div
        style={{ ...styles.content, width: sizeWidths[size] }}
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`modal-title-${id}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={styles.header}>
          <h2 id={`modal-title-${id}`} style={styles.title}>{title}</h2>
          <button
            style={{
              ...styles.closeBtn,
              ...(closeHover ? styles.closeBtnHover : {}),
            }}
            onClick={handleClose}
            onMouseEnter={() => setCloseHover(true)}
            onMouseLeave={() => setCloseHover(false)}
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <div style={styles.body}>
          {children}
        </div>
      </div>
    </div>
  );
}
