import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Text, StyleSheet, Pressable } from 'react-native';
import Animated, { SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const insets = useSafeAreaInsets();
  const { colors, spacing, fontSize } = useTheme();

  const show = useCallback((message: string, type: ToastType) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2500);
  }, []);

  const success = useCallback((msg: string) => show(msg, 'success'), [show]);
  const error = useCallback((msg: string) => show(msg, 'error'), [show]);
  const info = useCallback((msg: string) => show(msg, 'info'), [show]);

  const bgMap: Record<ToastType, string> = {
    success: colors.success ?? '#22c55e',
    error: colors.error,
    info: colors.bgElevated,
  };

  const textMap: Record<ToastType, string> = {
    success: '#fff',
    error: '#fff',
    info: colors.textPrimary,
  };

  return (
    <ToastContext.Provider value={{ success, error, info }}>
      {children}
      {toasts.map((toast) => (
        <Animated.View
          key={toast.id}
          entering={SlideInUp.duration(250)}
          exiting={SlideOutUp.duration(200)}
          style={[
            styles.toast,
            {
              top: insets.top + spacing.sm,
              backgroundColor: bgMap[toast.type],
            },
          ]}
        >
          <Pressable onPress={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}>
            <Text style={[styles.text, { color: textMap[toast.type], fontSize: fontSize.sm }]}>
              {toast.message}
            </Text>
          </Pressable>
        </Animated.View>
      ))}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 1000,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
});
