'use client';

import { cn } from '@/lib/utils';

/**
 * The official KharchGini logo insignia matching public/icon.svg and favicon.
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
      className={cn('shrink-0 shadow-sm shadow-accent/20', rounded, className)}
      role="img"
      aria-label="KharchGini"
    >
      <rect width="64" height="64" rx="14" fill="#1d8660" />
      <g
        transform="translate(14 14) scale(1.5)"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.2"
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
