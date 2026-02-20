import { useEffect, useRef, type ReactNode } from 'react';
import { useUiStore } from '@/stores/ui.store';

interface ModalProps {
  id: string;
  title: string;
  children: ReactNode;
  onClose?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ id, title, children, onClose, size = 'md' }: ModalProps) {
  const activeModal = useUiStore((s) => s.activeModal);
  const closeModal = useUiStore((s) => s.closeModal);
  const modalRef = useRef<HTMLDivElement>(null);

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
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className={`modal-content modal-${size}`}
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`modal-title-${id}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id={`modal-title-${id}`} className="modal-title">{title}</h2>
          <button className="modal-close" onClick={handleClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}
