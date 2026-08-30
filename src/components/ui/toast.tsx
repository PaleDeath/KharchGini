'use client';

import { Check, Info, TriangleAlert, Undo2 } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { cn } from '@/lib/utils';

type Tone = 'good' | 'bad' | 'info';

interface Toast {
  id: number;
  message: string;
  tone: Tone;
  undo?: () => void | Promise<void>;
  /** Set for the length of the exit animation, before the item is removed. */
  leaving?: boolean;
}

interface ToastValue {
  /**
   * `undo` is the reason this exists. A destructive action with a one-tap undo
   * needs no confirmation dialog, which removes a modal from the most common
   * path in the app.
   */
  toast: (message: string, options?: { tone?: Tone; undo?: () => void | Promise<void> }) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

const DURATION = 4500;
/** Must match the `toast-out` animation in tailwind.config.ts. */
const EXIT = 200;

const ICONS: Record<Tone, ReactNode> = {
  good: <Check className="h-4 w-4 text-good" />,
  bad: <TriangleAlert className="h-4 w-4 text-bad" />,
  info: <Info className="h-4 w-4 text-muted" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const nextId = useRef(1);

  /*
   * Two phases, because React will not animate an element it has already
   * unmounted. The toast is first marked as leaving — which swaps the entrance
   * animation for the exit one — and only removed once that has had time to
   * play. Calling this twice for the same toast is harmless; the second filter
   * finds nothing left to do.
   */
  const dismiss = useCallback((id: number) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, leaving: true } : item)),
    );
    setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, EXIT);
  }, []);

  const toast = useCallback<ToastValue['toast']>(
    (message, options) => {
      const id = nextId.current++;
      setItems((current) => [
        ...current.slice(-2),
        { id, message, tone: options?.tone ?? 'info', undo: options?.undo },
      ]);
      setTimeout(() => dismiss(id), DURATION);
    },
    [dismiss],
  );

  const value = useMemo<ToastValue>(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              'flex w-full max-w-sm items-center gap-3 rounded-xl border border-line',
              'bg-surface px-3.5 py-2.5 shadow-lg',
              // A toast on its way out must stop accepting taps, or Undo can be
              // pressed on something the user has already watched leave.
              item.leaving
                ? 'pointer-events-none animate-toast-out'
                : 'pointer-events-auto animate-toast-in',
            )}
          >
            {ICONS[item.tone]}
            <p className="min-w-0 flex-1 text-[13px] text-ink">{item.message}</p>
            {item.undo ? (
              <button
                type="button"
                onClick={() => {
                  void item.undo?.();
                  dismiss(item.id);
                }}
                className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-medium text-accent hover:bg-raised"
              >
                <Undo2 className="h-3.5 w-3.5" />
                Undo
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue['toast'] {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside <ToastProvider>');
  return value.toast;
}
