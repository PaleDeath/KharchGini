'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A number that travels to its new value instead of teleporting.
 *
 * This exists for one moment in particular: you record a ₹280 chai, the sheet
 * closes, and Safe to Spend falls by ₹280. If that figure simply swaps, the
 * connection between the thing you did and the number that matters is left for
 * you to infer. If it *moves*, the causality is felt rather than deduced, and
 * that feeling is most of why anyone keeps recording anything.
 *
 * Two deliberate refusals:
 *
 *  - It does not animate on mount. Counting up from zero every time a tab is
 *    opened is a dashboard flourish; it says nothing, and by the fourth visit
 *    it is just latency you have added on purpose.
 *  - It does not animate a change of one or two paise, which would be a
 *    shimmer with no information in it.
 */
export function useCountUp(value: number, enabled = true, duration = 500): number {
  const [shown, setShown] = useState(value);
  const previous = useRef(value);
  const frame = useRef<number>();

  useEffect(() => {
    if (!enabled) {
      previous.current = value;
      setShown(value);
      return;
    }

    if (value === previous.current) return;

    const from = previous.current;
    previous.current = value;

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced || Math.abs(value - from) < 2) {
      setShown(value);
      return;
    }

    const started = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - started) / duration);
      // Cubic ease-out: most of the distance early, the last rupees slowly.
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (t < 1) frame.current = requestAnimationFrame(step);
    };

    frame.current = requestAnimationFrame(step);

    return () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    };
  }, [value, enabled, duration]);

  return shown;
}
