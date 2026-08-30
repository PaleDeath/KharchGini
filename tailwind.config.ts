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
      },
      borderRadius: {
        card: '14px',
      },
      fontSize: {
        hero: ['2.75rem', { lineHeight: '1', letterSpacing: '-0.03em' }],
      },
      /*
       * Two curves and nothing else.
       *
       * `soft` overshoots nothing but settles late, which is what makes an
       * arrival feel unhurried instead of merely fast. `exit` is the opposite
       * and is always given less time: leaving should never cost the user a
       * wait, only enough frames to see where the thing went.
       */
      transitionTimingFunction: {
        soft: 'cubic-bezier(0.22, 1, 0.36, 1)',
        exit: 'cubic-bezier(0.4, 0, 0.6, 1)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-out': { from: { opacity: '1' }, to: { opacity: '0' } },

        /* Phone: the panel is pinned to the bottom edge and rises off it. */
        'sheet-in': {
          from: { opacity: '0', transform: 'translateY(100%)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'sheet-out': {
          from: { opacity: '1', transform: 'translateY(0)' },
          to: { opacity: '0', transform: 'translateY(100%)' },
        },

        /*
         * Desktop: the panel is centred with translate(-50%, -50%), so these
         * keyframes MUST carry that offset through every frame or the dialog
         * jumps a quarter-screen the moment the animation starts.
         */
        'pop-in': {
          from: { opacity: '0', transform: 'translate(-50%, -48%) scale(0.96)' },
          to: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
        },
        'pop-out': {
          from: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
          to: { opacity: '0', transform: 'translate(-50%, -48%) scale(0.96)' },
        },

        'toast-in': {
          from: { opacity: '0', transform: 'translateY(14px) scale(0.97)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'toast-out': {
          from: { opacity: '1', transform: 'translateY(0) scale(1)' },
          to: { opacity: '0', transform: 'translateY(6px) scale(0.97)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 300ms cubic-bezier(0.22, 1, 0.36, 1)',
        'fade-out': 'fade-out 220ms cubic-bezier(0.4, 0, 0.6, 1) forwards',
        'sheet-in': 'sheet-in 380ms cubic-bezier(0.22, 1, 0.36, 1)',
        'sheet-out': 'sheet-out 260ms cubic-bezier(0.4, 0, 0.6, 1) forwards',
        'pop-in': 'pop-in 240ms cubic-bezier(0.22, 1, 0.36, 1)',
        'pop-out': 'pop-out 180ms cubic-bezier(0.4, 0, 0.6, 1) forwards',
        'toast-in': 'toast-in 300ms cubic-bezier(0.22, 1, 0.36, 1)',
        'toast-out': 'toast-out 200ms cubic-bezier(0.4, 0, 0.6, 1) forwards',
      },
    },
  },
  plugins: [],
};

export default config;
