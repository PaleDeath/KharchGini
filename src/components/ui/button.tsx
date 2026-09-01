'use client';

import { Slot } from '@radix-ui/react-slot';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-accent to-emerald-600 text-accent-ink hover:opacity-95 shadow-sm shadow-accent/20 border border-white/20',
  secondary:
    'bg-raised/90 text-ink hover:bg-line/80 border border-line/70 active:bg-line shadow-2xs',
  ghost: 'text-muted hover:bg-raised/70 hover:text-ink',
  danger:
    'bg-gradient-to-r from-bad to-red-600 text-white hover:opacity-95 shadow-sm shadow-bad/20 border border-white/20',
  outline:
    'border border-line bg-surface/90 text-ink hover:bg-raised/70 shadow-2xs',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-xl font-semibold',
  md: 'h-10 px-4 text-sm gap-2 rounded-2xl font-semibold',
  lg: 'h-12 px-5 text-[15px] gap-2.5 rounded-2xl font-bold',
  icon: 'h-9 w-9 rounded-xl',
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
