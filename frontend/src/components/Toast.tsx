import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { Icon } from './Icon';
import { cn } from '../lib/utils';

type ToastType = 'success' | 'error' | 'warn' | 'info';

interface Toast {
  id: number;
  title: string;
  message?: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (title: string, message?: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const typeConfig: Record<ToastType, { color: string; icon: string }> = {
  success: { color: 'border-emerald-500 text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30', icon: 'check' },
  error: { color: 'border-red-500 text-red-500 bg-red-50 dark:bg-red-950/30', icon: 'alert' },
  warn: { color: 'border-amber-500 text-amber-500 bg-amber-50 dark:bg-amber-950/30', icon: 'alert' },
  info: { color: 'border-blue-500 text-blue-500 bg-blue-50 dark:bg-blue-950/30', icon: 'sparkle' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((title: string, message?: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => {
      const duplicate = prev.some(
        (item) => item.title === title && item.message === message && item.type === type,
      );
      return duplicate ? prev : [...prev.slice(-2), { id, title, message, type }];
    });

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 left-4 right-4 z-[100] flex flex-col items-stretch gap-3 sm:left-auto sm:w-full sm:max-w-sm">
        {toasts.map((t) => {
          const cfg = typeConfig[t.type];
          return (
            <div
              key={t.id}
              className={cn(
                'w-full min-w-0 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border-l-4 p-4 pr-10 flex gap-3 animate-slide-up relative',
                cfg.color,
              )}
            >
              <div className="flex-shrink-0 mt-0.5">
                <Icon name={cfg.icon} size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <h5 className="break-words text-sm font-semibold text-slate-900 dark:text-white">{t.title}</h5>
                {t.message && (
                  <p className="break-words text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.message}</p>
                )}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="absolute top-3 right-3 w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Icon name="x" size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}