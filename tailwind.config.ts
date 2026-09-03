import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'hsl(var(--bg))',
        surface: 'hsl(var(--surface))',
        raised: 'hsl(var(--raised))',
        line: 'hsl(var(--line))',
        ink: 'hsl(var(--ink))',
        muted: 'hsl(var(--muted))',
        faint: 'hsl(var(--faint))',
        accent: 'hsl(var(--accent))',
        'accent-ink': 'hsl(var(--accent-ink))',
        good: 'hsl(var(--good))',
        warn: 'hsl(var(--warn))',
        bad: 'hsl(var(--bad))',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      borderRadius: {
        card: '12px',
        '2xl': '16px',
        '3xl': '20px',
      },
      boxShadow: {
        '2xs': '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
        elevated: '0 4px 12px -2px rgba(0, 0, 0, 0.06), 0 2px 6px -1px rgba(0, 0, 0, 0.04)',
        'glow-accent': '0 0 24px -4px rgba(16, 185, 129, 0.35)',
        'glow-bad': '0 0 24px -4px rgba(239, 68, 68, 0.35)',
      },
      fontSize: {
        hero: ['clamp(2.25rem, 5vw, 3rem)', { lineHeight: '1.05', letterSpacing: '-0.035em' }],
        display: ['clamp(1.75rem, 3.5vw, 2.25rem)', { lineHeight: '1.15', letterSpacing: '-0.03em' }],
      },
      transitionTimingFunction: {
        soft: 'cubic-bezier(0.23, 1, 0.32, 1)',
        spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.15)',
        exit: 'cubic-bezier(0.4, 0, 0.6, 1)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-out': { from: { opacity: '1' }, to: { opacity: '0' } },
        'sheet-in': {
          from: { opacity: '0', transform: 'translateY(16px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'sheet-out': {
          from: { opacity: '1', transform: 'translateY(0) scale(1)' },
          to: { opacity: '0', transform: 'translateY(16px) scale(0.98)' },
        },
        'pop-in': {
          from: { opacity: '0', transform: 'translate(-50%, -48%) scale(0.95)' },
          to: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
        },
        'pop-out': {
          from: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
          to: { opacity: '0', transform: 'translate(-50%, -48%) scale(0.95)' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(12px) scale(0.95)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'toast-out': {
          from: { opacity: '1', transform: 'translateY(0) scale(1)' },
          to: { opacity: '0', transform: 'translateY(6px) scale(0.96)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms cubic-bezier(0.23, 1, 0.32, 1)',
        'fade-out': 'fade-out 150ms cubic-bezier(0.4, 0, 0.6, 1) forwards',
        'sheet-in': 'sheet-in 280ms cubic-bezier(0.23, 1, 0.32, 1)',
        'sheet-out': 'sheet-out 180ms cubic-bezier(0.4, 0, 0.6, 1) forwards',
        'pop-in': 'pop-in 220ms cubic-bezier(0.23, 1, 0.32, 1)',
        'pop-out': 'pop-out 160ms cubic-bezier(0.4, 0, 0.6, 1) forwards',
        'toast-in': 'toast-in 220ms cubic-bezier(0.23, 1, 0.32, 1)',
        'toast-out': 'toast-out 160ms cubic-bezier(0.4, 0, 0.6, 1) forwards',
      },
    },
  },
  plugins: [],
};

export default config;
