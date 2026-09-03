'use client';

import { Slot } from '@radix-ui/react-slot';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-ink hover:bg-accent/90 shadow-2xs font-medium border border-accent/80 active:scale-[0.98]',
  secondary:
    'bg-raised text-ink hover:bg-raised/80 border border-line/60 active:scale-[0.98] shadow-2xs font-medium',
  ghost: 'text-muted hover:bg-raised hover:text-ink active:scale-[0.98] font-medium',
  danger:
    'bg-bad text-white hover:bg-bad/90 shadow-2xs border border-bad/80 active:scale-[0.98] font-medium',
  outline:
    'border border-line/60 bg-surface/80 text-ink hover:bg-raised hover:border-line active:scale-[0.98] shadow-2xs font-medium',
};

const SIZES: Record<Size, string> = {
  sm: 'h-7.5 px-2.5 text-xs gap-1.5 rounded-lg',
  md: 'h-9 px-3 text-xs gap-2 rounded-lg',
  lg: 'h-10.5 px-4 text-sm gap-2 rounded-lg',
  icon: 'h-8.5 w-8.5 rounded-lg',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'secondary', size = 'md', asChild, type, ...props },
  ref,
) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      ref={ref}
      type={asChild ? undefined : (type ?? 'button')}
      className={cn(
        'inline-flex select-none items-center justify-center transition-all duration-150',
        'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
});
