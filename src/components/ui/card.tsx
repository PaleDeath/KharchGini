import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function Card({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl border border-line bg-surface/95 shadow-card transition-all',
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
    <div className={cn('flex items-start justify-between gap-3 px-4 pt-4', className)}>
      <div className="min-w-0">
        <h2 className="text-[12px] font-bold uppercase tracking-wider text-muted">
          {title}
        </h2>
        {subtitle ? <p className="mt-0.5 text-xs text-faint">{subtitle}</p> : null}
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
  return <div className={cn('h-px bg-line/75', className)} />;
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
    <section className={cn('space-y-2.5', className)}>
      {title || action ? (
        <div className="flex items-center justify-between gap-3 px-1">
          {title ? (
            <h2 className="text-[12px] font-bold uppercase tracking-wider text-muted">
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
    <div className="flex flex-col items-center justify-center gap-2.5 px-6 py-10 text-center">
      {icon ? (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-line/60 bg-raised/50 text-faint shadow-2xs">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-bold text-ink tracking-tight">{title}</p>
      {hint ? <p className="max-w-xs text-[13px] leading-relaxed text-muted">{hint}</p> : null}
      {action ? <div className="pt-1.5">{action}</div> : null}
    </div>
  );
}
