import React, { useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Toast notification system
// ---------------------------------------------------------------------------

export interface ToastMessage {
  id: string;
  text: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
  isDark: boolean;
}

const ICONS: Record<string, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
};

const BG_COLORS: Record<string, string> = {
  success: '#10b981',
  error: '#ef4444',
  info: '#3b82f6',
  warning: '#f59e0b',
};

export function NcToastContainer({ toasts, removeToast, isDark }: ToastContainerProps) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      zIndex: 2000,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} isDark={isDark} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss, isDark }: { toast: ToastMessage; onDismiss: () => void; isDark: boolean }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const dur = toast.duration || 3000;
    const exitTimer = setTimeout(() => setExiting(true), dur - 300);
    const removeTimer = setTimeout(onDismiss, dur);
    return () => { clearTimeout(exitTimer); clearTimeout(removeTimer); };
  }, [toast.duration, onDismiss]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 16px',
        borderRadius: 4,
        background: isDark ? 'rgba(30,30,40,0.95)' : 'rgba(255,255,255,0.95)',
        border: `1px solid ${BG_COLORS[toast.type]}40`,
        boxShadow: `0 4px 20px rgba(0,0,0,0.2), 0 0 0 1px ${BG_COLORS[toast.type]}20`,
        backdropFilter: 'blur(12px)',
        minWidth: 260,
        maxWidth: 400,
        fontSize: 13,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        animation: exiting ? 'toastOut 0.3s ease forwards' : 'toastIn 0.3s ease',
        cursor: 'pointer',
      }}
      onClick={onDismiss}
    >
      <span style={{
        width: 24, height: 24, borderRadius: 4,
        background: BG_COLORS[toast.type],
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 700,
        flexShrink: 0,
      }}>
        {ICONS[toast.type]}
      </span>
      <span style={{ color: isDark ? '#fff' : '#111', fontWeight: 500 }}>
        {toast.text}
      </span>
    </div>
  );
}

// Hook for managing toasts
export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (text: string, type: ToastMessage['type'] = 'info', duration = 3000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts(prev => [...prev, { id, text, type, duration }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return { toasts, addToast, removeToast };
}
