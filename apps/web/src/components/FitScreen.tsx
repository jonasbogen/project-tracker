import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Keeps a whole game screen inside the visible stage without scrolling.
 * The screen lays itself out at the stage's width (and at least its height);
 * if its natural size is larger than the stage, it is scaled down uniformly.
 */
export function FitScreen({ children, fitKey }: { children: ReactNode; fitKey: string }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const o = outer.current;
    if (!o) return;
    const measure = (): void => setBox({ w: o.clientWidth, h: o.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  useLayoutEffect(() => {
    const i = inner.current;
    if (!i || !box.h) return;
    const fit = (): void => {
      const h = i.scrollHeight;
      const w = i.scrollWidth;
      const s = Math.min(1, box.h / Math.max(1, h), box.w / Math.max(1, w));
      setScale(Number.isFinite(s) ? s : 1);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(i);
    const id = window.setInterval(fit, 500);
    return () => {
      ro.disconnect();
      window.clearInterval(id);
    };
  }, [box, fitKey]);

  return (
    <div ref={outer} className="fit-outer">
      <div
        ref={inner}
        className="fit-inner"
        style={{ width: box.w || undefined, minHeight: box.h || undefined, transform: scale < 0.999 ? `scale(${scale})` : undefined }}
      >
        {children}
      </div>
    </div>
  );
}
