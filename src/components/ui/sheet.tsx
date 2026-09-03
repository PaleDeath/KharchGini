'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * One modal component for the whole app. On a phone it rises from the bottom
 * where the thumb already is; on a desktop it centres. Everything that would
 * otherwise be a separate page — add, edit, filter, confirm — happens here, so
 * the user never loses their place in the list behind it.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-40 bg-black/50 backdrop-blur-sm',
            'data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out',
          )}
        />
        <Dialog.Content
          className={cn(
            'fixed z-50 flex flex-col bg-surface border border-line shadow-2xl outline-none',
            'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl',
            'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[86dvh] sm:w-full',
            'sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card',
            wide ? 'sm:max-w-2xl' : 'sm:max-w-md',
            'will-change-transform',
            'data-[state=open]:animate-sheet-in data-[state=closed]:animate-sheet-out',
            'sm:data-[state=open]:animate-pop-in sm:data-[state=closed]:animate-pop-out',
          )}
        >
          {/* Grab handle: the native iOS/Android affordance that says "you can drag me away". */}
          <div className="mx-auto mt-3 h-1.5 w-11 shrink-0 rounded-full bg-line sm:hidden" />

          <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-3 sm:pt-5">
            <div className="min-w-0">
              <Dialog.Title className="text-base font-bold tracking-tight text-ink">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-xs text-muted">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close
              className="-mr-1 -mt-1 rounded-xl p-2 text-faint transition-all hover:bg-raised hover:text-ink active:scale-95"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>

          {footer ? (
            <div className="safe-bottom flex gap-2 border-t border-line/80 bg-surface/90 backdrop-blur-md px-5 py-3.5">{footer}</div>
          ) : (
            <div className="safe-bottom sm:hidden" />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const SheetClose = Dialog.Close;
