import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function Card({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl border border-line/60 bg-surface/80 shadow-2xs transition-colors',
          className,
        )}
        {...props}
      />
    );
  },
);

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-4 pt-3.5', className)}>
      <div className="min-w-0">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
          {title}
        </h2>
        {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4', className)} {...props} />;
}

/** A hairline between rows inside a card. Lists read better than boxes-in-boxes. */
export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px bg-line/50', className)} />;
}

export function Section({
  title,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-2', className)}>
      {title || action ? (
        <div className="flex items-center justify-between gap-3 px-1">
          {title ? (
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              {title}
            </h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Empty({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-8 text-center">
      {icon ? (
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-line/60 bg-raised/50 text-muted shadow-2xs">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-semibold text-ink tracking-tight">{title}</p>
      {hint ? <p className="max-w-xs text-xs leading-relaxed text-muted">{hint}</p> : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
