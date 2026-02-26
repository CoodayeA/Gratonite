import { useState, useCallback, createContext, useContext, type ReactNode } from 'react';
import { shouldEnableUiV2Tokens } from '@/theme/initTheme';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string, duration = 5000) => {
    const id = Math.random().toString(36).slice(2);
    const newToast: Toast = { id, type, message, duration };
    setToasts(prev => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  const uiV2TokensEnabled = shouldEnableUiV2Tokens();

  if (toasts.length === 0) return null;

  return (
    <div className={`toast-container ${uiV2TokensEnabled ? 'toast-container-v2' : ''}`}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const icons: Record<ToastType, string> = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  return (
    <div className={`toast toast-${toast.type}`}>
      <span className="toast-icon">{icons[toast.type]}</span>
      <span className="toast-message">{toast.message}</span>
      <button 
        className="toast-close"
        onClick={() => onRemove(toast.id)}
      >
        ×
      </button>
    </div>
  );
}

export function toast(type: ToastType, message: string, duration?: number) {
  const ctx = useContext(ToastContext);
  if (ctx) {
    ctx.addToast(type, message, duration);
  }
}

export const toastSuccess = (message: string, duration?: number) => toast('success', message, duration);
export const toastError = (message: string, duration?: number) => toast('error', message, duration);
export const toastWarning = (message: string, duration?: number) => toast('warning', message, duration);
export const toastInfo = (message: string, duration?: number) => toast('info', message, duration);
