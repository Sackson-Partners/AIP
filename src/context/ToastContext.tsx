'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useState,
  ReactNode,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ────────────────────────────────────────────────────────────────────

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextType {
  toast: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// ── Styling ──────────────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<ToastVariant, { bar: string; bg: string; icon: string }> = {
  success: { bar: 'bg-green-500',  bg: 'bg-white border-green-200',  icon: '✓' },
  error:   { bar: 'bg-red-500',    bg: 'bg-white border-red-200',    icon: '✕' },
  warning: { bar: 'bg-yellow-400', bg: 'bg-white border-yellow-200', icon: '!' },
  info:    { bar: 'bg-blue-500',   bg: 'bg-white border-blue-200',   icon: 'i' },
};

const ICON_COLORS: Record<ToastVariant, string> = {
  success: 'text-green-500',
  error:   'text-red-500',
  warning: 'text-yellow-500',
  info:    'text-blue-500',
};

// ── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, variant }]);
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  const success = useCallback((msg: string) => toast(msg, 'success'), [toast]);
  const error   = useCallback((msg: string) => toast(msg, 'error'),   [toast]);
  const warning = useCallback((msg: string) => toast(msg, 'warning'), [toast]);
  const info    = useCallback((msg: string) => toast(msg, 'info'),    [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}

      {/* ── Toast stack ── */}
      <div
        className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 items-end pointer-events-none"
        aria-live="polite"
        aria-atomic="false"
      >
        <AnimatePresence initial={false}>
          {toasts.map(t => {
            const styles = VARIANT_STYLES[t.variant];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, x: 60, scale: 0.95 }}
                animate={{ opacity: 1, x: 0,  scale: 1    }}
                exit={{    opacity: 0, x: 60, scale: 0.95 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className={`pointer-events-auto flex items-start gap-3 min-w-[260px] max-w-sm rounded-xl border shadow-lg overflow-hidden ${styles.bg}`}
              >
                {/* Accent bar */}
                <div className={`w-1 self-stretch shrink-0 ${styles.bar}`} />

                {/* Icon */}
                <div className={`pt-3 text-sm font-bold ${ICON_COLORS[t.variant]}`}>
                  {styles.icon}
                </div>

                {/* Message */}
                <p className="flex-1 py-3 pr-2 text-sm text-gray-800 leading-snug">
                  {t.message}
                </p>

                {/* Dismiss */}
                <button
                  onClick={() => dismiss(t.id)}
                  className="pr-3 pt-3 text-gray-300 hover:text-gray-500 transition-colors text-lg leading-none"
                  aria-label="Dismiss"
                >
                  ×
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
