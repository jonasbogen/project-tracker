import { useEffect, useRef } from 'react';

// Decorative, ambient background for the dashboard: three large soft blobs in the
// Bifrost brand/chill/attn hues (fixed + z-index behind every Card, which stays
// opaque, so it only shows through the gaps — data stays the loudest thing on
// screen). Each blob continuously drifts/pulses on its own (CSS animation, always
// running) *and* parallax-shifts at a different rate as the page scrolls (JS, on
// a separate wrapper element so the two transforms don't fight over the same
// property). Skips the scroll listener under prefers-reduced-motion; the CSS
// animation itself is disabled there too (see index.css).
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
      <div className="hero-blob-wrap hero-blob-wrap-brand" data-speed="0.12">
        <div className="hero-blob hero-blob-brand" />
      </div>
      <div className="hero-blob-wrap hero-blob-wrap-chill" data-speed="-0.08">
        <div className="hero-blob hero-blob-chill" />
      </div>
      <div className="hero-blob-wrap hero-blob-wrap-attn" data-speed="0.05">
        <div className="hero-blob hero-blob-attn" />
      </div>
    </div>
  );
}
