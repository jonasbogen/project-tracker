import { useEffect, useRef, useState } from 'react';

/**
 * Counts down from `seconds` while `armed` is true and then calls `onDone`
 * once. Disarming (for example undoing a pick) cancels and resets the count.
 * Returns the seconds left, or null while not armed.
 */
export function useAutoAdvance(armed: boolean, seconds: number, onDone: () => void): number | null {
  const [left, setLeft] = useState<number | null>(null);
  const cb = useRef(onDone);
  cb.current = onDone;

  useEffect(() => {
    if (!armed) {
      setLeft(null);
      return;
    }
    let n = seconds;
    setLeft(n);
    const id = window.setInterval(() => {
      n -= 1;
      if (n <= 0) {
        window.clearInterval(id);
        setLeft(0);
        cb.current();
      } else {
        setLeft(n);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [armed, seconds]);

  return left;
}
