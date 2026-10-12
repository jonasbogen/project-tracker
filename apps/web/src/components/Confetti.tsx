import { useEffect, useRef } from 'react';

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  vr: number;
  color: string;
}

const COLORS = ['#ff4d6d', '#4da3ff', '#3ddc84', '#ffc53d', '#ffffff', '#b388ff'];

export function Confetti({ active, colors = COLORS, burst = false }: { active: boolean; colors?: string[]; burst?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    const onResize = (): void => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    const pieces: Piece[] = [];
    const spawn = (n: number, fromCenter: boolean): void => {
      for (let i = 0; i < n; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = fromCenter ? 6 + Math.random() * 10 : 0;
        pieces.push({
          x: fromCenter ? w / 2 : Math.random() * w,
          y: fromCenter ? h / 2 : -20 - Math.random() * h * 0.3,
          vx: fromCenter ? Math.cos(angle) * speed : (Math.random() - 0.5) * 2,
          vy: fromCenter ? Math.sin(angle) * speed - 4 : 2 + Math.random() * 3,
          w: 6 + Math.random() * 8,
          h: 8 + Math.random() * 10,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.3,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    };
    spawn(burst ? 220 : 160, burst);

    let raf = 0;
    let last = performance.now();
    let spawnAcc = 0;
    const loop = (now: number): void => {
      const dt = Math.min(40, now - last) / 16.67;
      last = now;
      ctx.clearRect(0, 0, w, h);
      if (!burst) {
        spawnAcc += dt;
        if (spawnAcc > 6) {
          spawn(4, false);
          spawnAcc = 0;
        }
      }
      for (let i = pieces.length - 1; i >= 0; i--) {
        const p = pieces[i];
        p.vy += 0.12 * dt;
        p.vx *= 0.99;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (p.y > h + 30) {
          pieces.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 2)));
        ctx.restore();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      ctx.clearRect(0, 0, w, h);
    };
  }, [active, colors, burst]);

  if (!active) return null;
  return <canvas ref={ref} className="confetti" aria-hidden="true" />;
}
