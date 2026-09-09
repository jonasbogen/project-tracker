import { useEffect, useRef, useState } from 'react';

// Counts up from 0 to `value` once, on mount/whenever value first arrives -
// the stat tiles' "arriving on the page" moment doubles as confirmation that
// the number is live, not just a static readout.
export default function CountUp({ value, durationMs = 900 }: { value: number; durationMs?: number }) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef<number>();

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const from = 0;

    function tick(now: number) {
      const progress = Math.min(1, (now - start) / durationMs);
      // ease-out: fast start, settles into place instead of a linear tick.
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <>{display}</>;
}
