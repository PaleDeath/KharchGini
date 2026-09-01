'use client';

import { cn } from '@/lib/utils';

/**
 * The official KharchGini logo insignia with an elevated gradient and specular shine.
 */
export function BrandLogo({
  className,
  size = 32,
  rounded = 'rounded-xl',
}: {
  className?: string;
  size?: number;
  rounded?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn('shrink-0 shadow-md shadow-accent/20 transition-transform duration-200 hover:scale-105', rounded, className)}
      role="img"
      aria-label="KharchGini"
    >
      <defs>
        <linearGradient id="kgBrandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#kgBrandGrad)" />
      <rect
        width="62"
        height="62"
        x="1"
        y="1"
        rx="15"
        fill="none"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="1.5"
      />
      <g
        transform="translate(14 14) scale(1.5)"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 3h12" />
        <path d="M6 8h12" />
        <path d="M6 13h3" />
        <path d="M9 13c6.667 0 6.667-10 0-10" />
        <path d="M6 13l8.5 8" />
      </g>
    </svg>
  );
}
