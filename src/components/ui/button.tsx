'use client';

import { Slot } from '@radix-ui/react-slot';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:opacity-90 active:opacity-80',
  secondary: 'bg-raised text-ink hover:bg-line active:bg-line',
  ghost: 'text-muted hover:bg-raised hover:text-ink',
  danger: 'bg-bad text-white hover:opacity-90',
  outline: 'border border-line bg-surface text-ink hover:bg-raised',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-xl',
  icon: 'h-9 w-9 rounded-lg',
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
      // Buttons inside forms default to submit and cause surprise navigations.
      type={asChild ? undefined : (type ?? 'button')}
      className={cn(
        // `transition` rather than `transition-colors`: the press-scale below
        // needs transform to be animated too, and Tailwind only honours the
        // last transition-property utility on an element.
        'inline-flex select-none items-center justify-center font-medium transition',
        // Touch has no hover. Without this, every button in the app is
        // completely inert under a thumb until the action it triggers lands.
        'active:scale-[0.97]',
        'disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
});
