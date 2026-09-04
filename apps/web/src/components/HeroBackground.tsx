import { useEffect, useRef } from 'react';

// Decorative, ambient background for the dashboard: three large soft blobs in the
// Bifrost brand/chill/attn hues, drifting at different rates as the page scrolls
// (fixed + z-index behind every Card, which stays opaque, so it only shows through
// the gaps — data stays the loudest thing on screen). Skips the scroll listener
// entirely under prefers-reduced-motion, leaving a static backdrop.
export default function HeroBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const layers = containerRef.current?.querySelectorAll<HTMLElement>('[data-speed]');
    if (!layers || layers.length === 0) return;

    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        layers!.forEach((layer) => {
          const speed = Number(layer.dataset.speed ?? '0');
          layer.style.transform = `translate3d(0, ${y * speed}px, 0)`;
        });
        ticking = false;
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="hero-background" ref={containerRef} aria-hidden="true">
      <div className="hero-blob hero-blob-brand" data-speed="0.12" />
      <div className="hero-blob hero-blob-chill" data-speed="-0.08" />
      <div className="hero-blob hero-blob-attn" data-speed="0.05" />
    </div>
  );
}
