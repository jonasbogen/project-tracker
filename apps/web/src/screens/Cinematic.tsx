import { useEffect, useRef, useState } from 'react';
import { audio, type MusicName, type SfxName } from '../audio/engine';
import { Confetti } from '../components/Confetti';

interface Scene {
  id: string;
  duration: number;
  music: MusicName;
  sfx: [SfxName, number][];
  kicker: string;
  caption: string;
}

const SCENES: Scene[] = [
  { id: 'dawn', duration: 6000, music: 'cinema', sfx: [['snore', 300], ['snore', 1300], ['engine', 2500]], kicker: 'Riihimäki, Finland · lørdag 06:40', caption: 'Du våkner i en lastebil hos NG Nordic. Hodet er tungt. Helgen har vært lang.' },
  { id: 'esko', duration: 5000, music: 'cinema', sfx: [['ding', 1100]], kicker: 'Lasterampen · NG Nordic', caption: 'Esko står der med kaffen. Han takker for en fin helg og ønsker deg god tur hjem.' },
  { id: 'bike', duration: 5500, music: 'cinema', sfx: [['bell', 500], ['bell', 3000]], kicker: 'Riksvei 3 · retning Helsinki-Vantaa', caption: 'Ingen buss. Ingen taxi. Du sykler til flyplassen.' },
  { id: 'flight', duration: 5500, music: 'cinema', sfx: [['rocket', 600], ['whoosh', 2800]], kicker: 'HEL → OSL · 10 000 fot', caption: 'Et sete ved vinduet, Oslo om en time. Endelig litt ro.' },
  { id: 'train', duration: 7000, music: 'cinema', sfx: [['train', 300], ['buzz', 3000], ['fail', 4300]], kicker: 'Flytoget · Gardermoen – Oslo S', caption: 'Du ser at Flytoget er Intility-kunde. Så forsvinner dekningen. «Forbanna Edvard…» tenker du.' },
  { id: 'party', duration: 0, music: 'victory', sfx: [['cheer', 300], ['fanfare', 1200]], kicker: 'Oslo · 19:30', caption: 'Du kommer frem til vors – klar for festiviteter med Management Gradsa!' },
];

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function Forest({ y, count, minH, maxH, color, seed, width = 3200 }: { y: number; count: number; minH: number; maxH: number; color: string; seed: number; width?: number }) {
  const r = rng(seed);
  const trees = Array.from({ length: count }).map((_, i) => {
    const x = (i / count) * width + r() * (width / count);
    const h = minH + r() * (maxH - minH);
    const w = h * 0.32;
    return (
      <g key={i}>
        <polygon points={`${x},${y - h} ${x - w},${y} ${x + w},${y}`} fill={color} />
        <polygon points={`${x},${y - h * 0.72} ${x - w * 0.8},${y - h * 0.3} ${x + w * 0.8},${y - h * 0.3}`} fill={color} />
        <polygon points={`${x},${y - h * 0.45} ${x - w * 0.55},${y - h * 0.08} ${x + w * 0.55},${y - h * 0.08}`} fill={color} />
      </g>
    );
  });
  return <g>{trees}</g>;
}

function Stars({ count, seed }: { count: number; seed: number }) {
  const r = rng(seed);
  return (
    <g>
      {Array.from({ length: count }).map((_, i) => (
        <circle key={i} cx={r() * 1600} cy={r() * 450} r={0.8 + r() * 1.6} fill="#fff" className="twinkle" style={{ animationDelay: `${r() * 3}s` }} />
      ))}
    </g>
  );
}

function Cloud({ x, y, s = 1, o = 0.95 }: { x: number; y: number; s?: number; o?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={o} filter="url(#soft)">
      <ellipse cx={0} cy={0} rx={120} ry={46} fill="#fff" />
      <ellipse cx={-70} cy={12} rx={70} ry={34} fill="#fff" />
      <ellipse cx={75} cy={14} rx={80} ry={36} fill="#fff" />
      <ellipse cx={10} cy={-30} rx={70} ry={40} fill="#fff" />
    </g>
  );
}

function Truck({ x, y, lights, smoke }: { x: number; y: number; lights?: boolean; smoke?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="truck-g">
      <ellipse cx={330} cy={238} rx={360} ry={16} fill="#000" opacity={0.35} />
      <rect x={0} y={0} width={520} height={200} rx={12} fill="url(#trailer)" stroke="#9aa3b5" strokeWidth={3} />
      <rect x={0} y={150} width={520} height={14} fill="#0b3a8a" opacity={0.85} />
      <text x={260} y={120} textAnchor="middle" fontSize={64} fontWeight={900} fill="#0b3a8a" fontFamily="Segoe UI, Arial, sans-serif" letterSpacing={2}>
        NG Nordic
      </text>
      <rect x={530} y={50} width={175} height={150} rx={16} fill="url(#cab)" stroke="#072a66" strokeWidth={3} />
      <rect x={556} y={70} width={122} height={62} rx={8} fill="#cfe8ff" opacity={0.92} />
      <rect x={556} y={70} width={60} height={62} rx={8} fill="#fff" opacity={0.35} />
      <rect x={535} y={28} width={12} height={28} fill="#444" />
      <rect x={520} y={138} width={8} height={40} fill="#ddd" />
      <circle cx={700} cy={170} r={9} fill={lights ? '#fff6c0' : '#665'} className={lights ? 'headlight' : ''} />
      {lights && <ellipse cx={760} cy={172} rx={90} ry={26} fill="url(#beam)" className="headlight" />}
      {[70, 150, 440, 650].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy={220} r={36} fill="#15161c" stroke="#2c2f3a" strokeWidth={6} />
          <circle cx={cx} cy={220} r={13} fill="#8d94a5" />
        </g>
      ))}
      {smoke &&
        [0, 1, 2, 3].map((i) => (
          <circle key={i} cx={540} cy={20} r={12 + i * 3} fill="#cfd3dc" opacity={0.5} className="smoke" style={{ animationDelay: `${i * 0.5}s` }} />
        ))}
      </g>
    </g>
  );
}

function Person({ x, y, vest, helmet, beard, hoodie, wave, bag, className }: { x: number; y: number; vest?: boolean; helmet?: boolean; beard?: boolean; hoodie?: boolean; wave?: boolean; bag?: boolean; className?: string }) {
  const body = vest ? '#ff7a1a' : hoodie ? '#4a5568' : '#2b6cb0';
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={className}>
      <ellipse cx={0} cy={232} rx={56} ry={10} fill="#000" opacity={0.3} />
      <rect x={-22} y={120} width={18} height={110} rx={6} fill="#1e2a4a" />
      <rect x={6} y={120} width={18} height={110} rx={6} fill="#1e2a4a" />
      {bag && <rect x={-48} y={40} width={30} height={80} rx={10} fill="#8a3b12" />}
      <rect x={-34} y={30} width={68} height={100} rx={18} fill={body} />
      {vest && (
        <>
          <rect x={-34} y={62} width={68} height={10} fill="#ffe36b" />
          <rect x={-34} y={90} width={68} height={10} fill="#ffe36b" />
        </>
      )}
      <rect x={-54} y={40} width={18} height={80} rx={9} fill={body} />
      {wave ? (
        <g className="wave-arm">
          <rect x={36} y={-30} width={18} height={80} rx={9} fill={body} />
          <circle cx={45} cy={-34} r={12} fill="#f1c9a5" />
        </g>
      ) : (
        <g>
          <rect x={36} y={40} width={18} height={80} rx={9} fill={body} />
          <circle cx={45} cy={124} r={11} fill="#f1c9a5" />
        </g>
      )}
      <circle cx={0} cy={0} r={30} fill="#f1c9a5" />
      {beard && <path d="M-26 6 Q0 44 26 6 Q14 24 0 22 Q-14 24 -26 6Z" fill="#7a5a3a" />}
      <circle cx={-10} cy={-4} r={3} fill="#222" />
      <circle cx={10} cy={-4} r={3} fill="#222" />
      <path d="M-10 10 Q0 18 10 10" stroke="#222" strokeWidth={3} fill="none" strokeLinecap="round" />
      {helmet ? (
        <>
          <path d="M-34 -8 A34 34 0 0 1 34 -8 Z" fill="#ffd21f" />
          <rect x={-40} y={-10} width={80} height={8} rx={4} fill="#e6b800" />
        </>
      ) : (
        <path d="M-32 -6 A32 32 0 0 1 32 -6 L32 -2 L-32 -2 Z" fill="#2d3748" />
      )}
      </g>
    </g>
  );
}

function Defs() {
  return (
    <defs>
      <linearGradient id="night" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#04061a" />
        <stop offset="1" stopColor="#1c2150" />
      </linearGradient>
      <linearGradient id="dawn" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#1b2a6b" />
        <stop offset="0.55" stopColor="#b5497c" />
        <stop offset="1" stopColor="#ffb36b" />
      </linearGradient>
      <linearGradient id="morning" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#3f7fd6" />
        <stop offset="0.7" stopColor="#bfe0ff" />
        <stop offset="1" stopColor="#ffe6c2" />
      </linearGradient>
      <linearGradient id="day" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2f7fe0" />
        <stop offset="1" stopColor="#bfe6ff" />
      </linearGradient>
      <linearGradient id="high" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#0d2a6e" />
        <stop offset="0.6" stopColor="#3c86e0" />
        <stop offset="1" stopColor="#dbeeff" />
      </linearGradient>
      <linearGradient id="evening" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#0f1338" />
        <stop offset="0.6" stopColor="#5b2a63" />
        <stop offset="1" stopColor="#f08a4b" />
      </linearGradient>
      <linearGradient id="room" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#120a24" />
        <stop offset="1" stopColor="#2a0f3c" />
      </linearGradient>
      <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#6fb6ff" />
        <stop offset="1" stopColor="#2a62b8" />
      </linearGradient>
      <linearGradient id="trailer" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#cfd5e0" />
      </linearGradient>
      <linearGradient id="cab" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2b6fe0" />
        <stop offset="1" stopColor="#0b3a8a" />
      </linearGradient>
      <linearGradient id="trainbody" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#e9ecf2" />
        <stop offset="0.5" stopColor="#aeb5c2" />
        <stop offset="1" stopColor="#5b6372" />
      </linearGradient>
      <linearGradient id="plane" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#c8d0dc" />
      </linearGradient>
      <radialGradient id="sunglow">
        <stop offset="0" stopColor="#fff6cc" stopOpacity="1" />
        <stop offset="0.35" stopColor="#ffb347" stopOpacity="0.55" />
        <stop offset="1" stopColor="#ffb347" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="beam">
        <stop offset="0" stopColor="#fff6c0" stopOpacity="0.7" />
        <stop offset="1" stopColor="#fff6c0" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="bokeh">
        <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
      <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" />
      </filter>
      <filter id="blur12" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="12" />
      </filter>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="14" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <pattern id="mirror" width="14" height="14" patternUnits="userSpaceOnUse">
        <rect width="14" height="14" fill="#9fb3c8" />
        <rect width="12" height="12" x="1" y="1" fill="#e8f1fa" />
      </pattern>
    </defs>
  );
}

function SceneDawn() {
  return (
    <svg className="cine-svg" viewBox="0 100 1600 700" preserveAspectRatio="xMidYMid slice">
      <Defs />
      <rect width="1600" height="900" fill="url(#night)" />
      <rect width="1600" height="900" fill="url(#dawn)" className="fade-in-7" />
      <g className="fade-out-7">
        <Stars count={70} seed={7} />
      </g>
      <g className="sun-rise-g">
        <circle cx={1120} cy={620} r={260} fill="url(#sunglow)" />
        <circle cx={1120} cy={620} r={64} fill="#fff1b8" />
      </g>
      <polygon points="0,560 200,470 420,520 640,440 900,500 1150,430 1400,490 1600,450 1600,640 0,640" fill="#2a2f5e" />
      <g className="drift-slow">
        <Forest y={590} count={40} minH={80} maxH={150} color="#1c2347" seed={3} />
      </g>
      <g className="drift-slower">
        <Forest y={640} count={34} minH={130} maxH={230} color="#10152e" seed={11} />
      </g>
      <rect x={0} y={636} width={1600} height={300} fill="#191b27" />
      <rect x={0} y={636} width={1600} height={6} fill="#2a2d3d" />
      <g className="fog-drift" opacity={0.5}>
        <ellipse cx={400} cy={650} rx={520} ry={40} fill="#c9d4ff" filter="url(#blur12)" />
        <ellipse cx={1300} cy={670} rx={420} ry={34} fill="#c9d4ff" filter="url(#blur12)" />
      </g>
      <g transform="translate(250 420)">
        <rect x={0} y={0} width={10} height={220} fill="#3a3f55" />
        <rect x={-150} y={0} width={310} height={70} rx={8} fill="#0b3a8a" stroke="#fff" strokeWidth={3} />
        <text x={5} y={30} textAnchor="middle" fontSize={22} fontWeight={800} fill="#fff" fontFamily="Segoe UI, Arial, sans-serif">
          NG NORDIC
        </text>
        <text x={5} y={56} textAnchor="middle" fontSize={18} fontWeight={600} fill="#cfe8ff" fontFamily="Segoe UI, Arial, sans-serif">
          Riihimäki · Terminaali 2
        </text>
      </g>
      <Truck x={480} y={420} lights smoke />
      <g className="zzz-g">
        <text x={1070} y={420} fontSize={36} fontWeight={900} fill="#dfe8ff" className="zz" style={{ animationDelay: '0s' }}>z</text>
        <text x={1100} y={390} fontSize={46} fontWeight={900} fill="#dfe8ff" className="zz" style={{ animationDelay: '0.5s' }}>z</text>
        <text x={1140} y={350} fontSize={60} fontWeight={900} fill="#dfe8ff" className="zz" style={{ animationDelay: '1s' }}>Z</text>
      </g>
    </svg>
  );
}

function SceneEsko() {
  return (
    <svg className="cine-svg" viewBox="0 100 1600 700" preserveAspectRatio="xMidYMid slice">
      <Defs />
      <rect width="1600" height="900" fill="url(#morning)" />
      <circle cx={1350} cy={160} r={240} fill="url(#sunglow)" />
      <circle cx={1350} cy={160} r={56} fill="#fff6d0" />
      <g className="drift-slow">
        <Forest y={420} count={48} minH={60} maxH={120} color="#3f5f8a" seed={21} />
      </g>
      <rect x={0} y={300} width={1600} height={360} fill="#6b7384" />
      <rect x={0} y={300} width={1600} height={28} fill="#4a5160" />
      <rect x={0} y={328} width={1600} height={6} fill="#8b93a4" />
      {[80, 420, 1180].map((x) => (
        <g key={x}>
          <rect x={x} y={400} width={220} height={260} fill="#3b4150" />
          <rect x={x + 8} y={408} width={204} height={244} fill="#2a2f3a" />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={x + 8} y={408 + i * 61} width={204} height={4} fill="#4a5160" />
          ))}
        </g>
      ))}
      <rect x={760} y={400} width={220} height={260} fill="#3b4150" />
      <rect x={768} y={408} width={204} height={244} fill="#ffe3a8" opacity={0.9} />
      <rect x={768} y={408} width={204} height={244} fill="url(#beam)" />
      <rect x={100} y={330} width={520} height={100} rx={8} fill="#0b3a8a" stroke="#fff" strokeWidth={4} />
      <text x={360} y={398} textAnchor="middle" fontSize={64} fontWeight={900} fill="#fff" fontFamily="Segoe UI, Arial, sans-serif" letterSpacing={4}>
        NG NORDIC
      </text>
      <rect x={0} y={656} width={1600} height={260} fill="#2b2d38" />
      <rect x={0} y={656} width={1600} height={8} fill="#5a5e70" />
      <g transform="translate(-520 420) scale(0.9)">
        <Truck x={0} y={0} />
      </g>
      <Person x={1010} y={520} vest helmet beard wave className="bob" />
      <g className="walk-in">
        <Person x={640} y={520} hoodie bag className="bob-walk" />
      </g>
      <g className="bubble-pop" style={{ transformOrigin: '1010px 420px' }}>
        <rect x={840} y={330} width={420} height={96} rx={26} fill="#fff" stroke="#0b3a8a" strokeWidth={3} />
        <polygon points="1000,424 1030,424 1012,462" fill="#fff" stroke="#0b3a8a" strokeWidth={3} />
        <rect x={1003} y={418} width={25} height={10} fill="#fff" />
        <text x={1050} y={370} textAnchor="middle" fontSize={30} fontWeight={800} fill="#111" fontFamily="Segoe UI, Arial, sans-serif">
          Kiitos for en fin helg!
        </text>
        <text x={1050} y={406} textAnchor="middle" fontSize={26} fontWeight={700} fill="#0b3a8a" fontFamily="Segoe UI, Arial, sans-serif">
          God tur hjem!
        </text>
      </g>
    </svg>
  );
}

function SceneBike() {
  return (
    <svg className="cine-svg" viewBox="0 100 1600 700" preserveAspectRatio="xMidYMid slice">
      <Defs />
      <rect width="1600" height="900" fill="url(#day)" />
      <circle cx={1300} cy={150} r={220} fill="url(#sunglow)" />
      <circle cx={1300} cy={150} r={50} fill="#fff8d6" />
      <g className="drift-30">
        <Cloud x={200} y={140} s={0.9} />
        <Cloud x={900} y={90} s={1.1} />
        <Cloud x={1500} y={170} s={0.8} />
        <Cloud x={1800} y={140} s={0.9} />
        <Cloud x={2500} y={90} s={1.1} />
        <Cloud x={3100} y={170} s={0.8} />
      </g>
      <g className="drift-40">
        <polygon points="0,470 220,400 420,440 700,360 980,430 1250,370 1600,440 1900,390 2200,450 2500,380 2800,440 3200,400 3200,560 0,560" fill="#7aa8d8" />
      </g>
      <g className="drift-20">
        <Forest y={540} count={44} minH={60} maxH={130} color="#2f6b3f" seed={5} />
      </g>
      <rect x={0} y={530} width={1600} height={90} fill="url(#water)" />
      <g className="drift-12" opacity={0.6}>
        {[100, 500, 900, 1300, 1700, 2100, 2500, 2900].map((x, i) => (
          <rect key={x} x={x} y={560 + (i % 3) * 14} width={120 + (i % 2) * 60} height={4} rx={2} fill="#fff" />
        ))}
      </g>
      <g className="drift-9">
        <Forest y={636} count={30} minH={110} maxH={190} color="#1e4f2c" seed={9} />
      </g>
      <rect x={0} y={620} width={1600} height={60} fill="#4f8f3d" />
      <rect x={0} y={678} width={1600} height={240} fill="#3a3d46" />
      <rect x={0} y={678} width={1600} height={6} fill="#6f7380" />
      <line x1={0} y1={745} x2={1600} y2={745} stroke="#f2e6b0" strokeWidth={8} strokeDasharray="90 90" className="dash-run" />
      <g className="drift-5">
        {[200, 700, 1200, 1700, 2200, 2700].map((x) => (
          <g key={x}>
            <rect x={x} y={600} width={10} height={80} fill="#ddd" />
            <rect x={x - 4} y={596} width={18} height={10} fill="#e53e3e" />
          </g>
        ))}
      </g>
      <g className="plane-far">
        <path d="M0 0 L60 0 L75 -6 L62 -2 L30 -2 L24 10 L18 10 L20 -2 L8 -2 L0 6 Z" fill="#fff" opacity={0.85} />
        <line x1={-200} y1={0} x2={0} y2={0} stroke="#fff" strokeWidth={4} opacity={0.4} />
      </g>
      <g transform="translate(0 -60)">
      <g className="cyclist-g">
        <ellipse cx={720} cy={850} rx={170} ry={14} fill="#000" opacity={0.3} />
        <g transform="translate(620 790)">
          <circle r={52} fill="none" stroke="#111" strokeWidth={10} />
          <g className="spin">
            {[0, 30, 60, 90, 120, 150].map((a) => (
              <line key={a} x1={-48} y1={0} x2={48} y2={0} stroke="#aaa" strokeWidth={2} transform={`rotate(${a})`} />
            ))}
          </g>
          <circle r={7} fill="#333" />
        </g>
        <g transform="translate(830 790)">
          <circle r={52} fill="none" stroke="#111" strokeWidth={10} />
          <g className="spin">
            {[0, 30, 60, 90, 120, 150].map((a) => (
              <line key={a} x1={-48} y1={0} x2={48} y2={0} stroke="#aaa" strokeWidth={2} transform={`rotate(${a})`} />
            ))}
          </g>
          <circle r={7} fill="#333" />
        </g>
        <polyline points="620,790 700,700 790,700 830,790 720,790 700,700" fill="none" stroke="#e63946" strokeWidth={9} strokeLinejoin="round" />
        <line x1={720} y1={790} x2={790} y2={700} stroke="#e63946" strokeWidth={9} />
        <line x1={690} y1={690} x2={712} y2={690} stroke="#222" strokeWidth={10} strokeLinecap="round" />
        <line x1={790} y1={700} x2={800} y2={672} stroke="#222" strokeWidth={10} strokeLinecap="round" />
        <g className="pedal" style={{ transformOrigin: '720px 790px' }}>
          <line x1={720} y1={790} x2={720} y2={760} stroke="#222" strokeWidth={6} />
          <line x1={720} y1={790} x2={720} y2={820} stroke="#222" strokeWidth={6} />
        </g>
        <g className="rider">
          <line x1={700} y1={690} x2={740} y2={760} stroke="#1e2a4a" strokeWidth={22} strokeLinecap="round" />
          <line x1={740} y1={760} x2={722} y2={812} stroke="#1e2a4a" strokeWidth={20} strokeLinecap="round" className="leg-a" style={{ transformOrigin: '740px 760px' }} />
          <line x1={740} y1={760} x2={728} y2={770} stroke="#1e2a4a" strokeWidth={20} strokeLinecap="round" className="leg-b" style={{ transformOrigin: '740px 760px' }} />
          <line x1={700} y1={690} x2={790} y2={640} stroke="#4a5568" strokeWidth={30} strokeLinecap="round" />
          <line x1={790} y1={640} x2={800} y2={678} stroke="#4a5568" strokeWidth={14} strokeLinecap="round" />
          <circle cx={815} cy={612} r={30} fill="#f1c9a5" />
          <path d="M783 606 A33 33 0 0 1 848 606 L848 612 L783 612 Z" fill="#e53e3e" />
          <rect x={775} y={640} width={34} height={60} rx={10} fill="#8a3b12" />
        </g>
      </g>
      </g>
      <g className="sign-in-right">
        <rect x={1380} y={520} width={14} height={160} fill="#555" />
        <rect x={1260} y={500} width={260} height={80} rx={10} fill="#0b3a8a" stroke="#fff" strokeWidth={4} />
        <text x={1390} y={534} textAnchor="middle" fontSize={26} fontWeight={800} fill="#fff" fontFamily="Segoe UI, Arial, sans-serif">
          ✈ Helsinki-Vantaa
        </text>
        <text x={1390} y={566} textAnchor="middle" fontSize={24} fontWeight={700} fill="#cfe8ff" fontFamily="Segoe UI, Arial, sans-serif">
          2 km →
        </text>
      </g>
    </svg>
  );
}

function SceneFlight() {
  return (
    <svg className="cine-svg" viewBox="0 100 1600 700" preserveAspectRatio="xMidYMid slice">
      <Defs />
      <rect width="1600" height="900" fill="url(#high)" />
      <circle cx={260} cy={230} r={300} fill="url(#sunglow)" opacity={0.9} />
      <circle cx={260} cy={230} r={60} fill="#fffbe6" />
      <circle cx={520} cy={300} r={40} fill="#fff" opacity={0.12} />
      <circle cx={700} cy={420} r={70} fill="#ffd27a" opacity={0.08} />
      <g className="drift-40" opacity={0.9}>
        <Cloud x={300} y={300} s={0.7} o={0.7} />
        <Cloud x={1100} y={260} s={0.6} o={0.6} />
        <Cloud x={1900} y={300} s={0.7} o={0.7} />
        <Cloud x={2700} y={260} s={0.6} o={0.6} />
      </g>
      <g className="drift-20">
        <Cloud x={200} y={560} s={1.4} />
        <Cloud x={900} y={640} s={1.2} />
        <Cloud x={1500} y={580} s={1.5} />
        <Cloud x={1800} y={560} s={1.4} />
        <Cloud x={2500} y={640} s={1.2} />
        <Cloud x={3100} y={580} s={1.5} />
      </g>
      <g className="plane-g">
        <g transform="translate(560 420)">
          <line x1={-900} y1={30} x2={-90} y2={30} stroke="#fff" strokeWidth={10} opacity={0.35} strokeLinecap="round" />
          <line x1={-900} y1={52} x2={-60} y2={52} stroke="#fff" strokeWidth={8} opacity={0.3} strokeLinecap="round" />
          <polygon points="120,-20 330,-20 430,-90 380,-96 80,-30" fill="#c5cdd9" stroke="#9aa6b8" strokeWidth={2} />
          <polygon points="60,20 300,20 420,110 360,118 20,70" fill="#aeb8c8" />
          <path d="M-120 0 Q-120 -40 -60 -44 L420 -44 Q520 -44 580 0 Q520 44 420 44 L-60 44 Q-120 40 -120 0 Z" fill="url(#plane)" stroke="#9aa6b8" strokeWidth={3} />
          <rect x={-60} y={6} width={560} height={14} fill="#1f5fd1" opacity={0.9} />
          <path d="M-40 -44 L-130 -140 L-30 -140 L60 -44 Z" fill="#1f5fd1" />
          <path d="M470 -36 Q540 -40 575 -4" fill="none" stroke="#5a6b86" strokeWidth={3} />
          <path d="M490 -40 L560 -40 L575 -8 L500 -8 Z" fill="#9fd3ff" opacity={0.9} />
          {Array.from({ length: 14 }).map((_, i) => (
            <rect key={i} x={-20 + i * 32} y={-26} width={16} height={18} rx={4} fill="#9fd3ff" />
          ))}
          <rect x={150} y={44} width={110} height={40} rx={20} fill="#7c8aa0" stroke="#55657d" strokeWidth={2} />
          <ellipse cx={152} cy={64} rx={10} ry={20} fill="#1f2630" />
          <ellipse cx={152} cy={64} rx={5} ry={12} fill="#3a4556" />
          <rect x={300} y={40} width={90} height={34} rx={17} fill="#8d9ab0" stroke="#55657d" strokeWidth={2} />
          <ellipse cx={302} cy={57} rx={8} ry={17} fill="#1f2630" />
        </g>
      </g>
      <g className="board-pop">
        <rect x={1060} y={140} width={470} height={150} rx={14} fill="#0e1016" stroke="#2a2f3a" strokeWidth={4} />
        <text x={1090} y={190} fontSize={30} fontWeight={800} fill="#ffd86b" fontFamily="Courier New, monospace">HEL → OSL   FINN 653</text>
        <text x={1090} y={230} fontSize={26} fontWeight={700} fill="#cfd6e0" fontFamily="Courier New, monospace">Gate 12     11:05</text>
        <text x={1090} y={270} fontSize={26} fontWeight={800} fill="#3ddc84" fontFamily="Courier New, monospace" className="blink">BOARDING</text>
      </g>
    </svg>
  );
}

function SceneTrain() {
  const r = rng(42);
  const buildings = Array.from({ length: 40 }).map((_, i) => ({ x: i * 64, w: 44 + r() * 30, h: 90 + r() * 220 }));
  return (
    <svg className="cine-svg" viewBox="0 100 1600 700" preserveAspectRatio="xMidYMid slice">
      <Defs />
      <rect width="1600" height="900" fill="url(#evening)" />
      <Stars count={30} seed={77} />
      <circle cx={1200} cy={560} r={240} fill="url(#sunglow)" opacity={0.7} />
      <g className="drift-slower">
        {buildings.map((b, i) => (
          <g key={i}>
            <rect x={b.x} y={560 - b.h} width={b.w} height={b.h} fill="#141a33" />
            {Array.from({ length: Math.floor(b.h / 28) }).map((_, j) => (
              <rect key={j} x={b.x + 8} y={570 - b.h + j * 28} width={10} height={12} fill="#ffd27a" opacity={(i + j) % 3 === 0 ? 0.9 : 0.25} />
            ))}
          </g>
        ))}
      </g>
      <rect x={0} y={560} width={1600} height={60} fill="#17204a" />
      <rect x={0} y={560} width={1600} height={60} fill="url(#water)" opacity={0.35} />
      <rect x={0} y={620} width={1600} height={300} fill="#1c1a22" />
      <g className="drift-3">
        {Array.from({ length: 40 }).map((_, i) => (
          <rect key={i} x={i * 84} y={760} width={40} height={14} fill="#5a4a3a" />
        ))}
      </g>
      <line x1={0} y1={756} x2={1600} y2={756} stroke="#8d94a5" strokeWidth={6} />
      <line x1={0} y1={782} x2={1600} y2={782} stroke="#8d94a5" strokeWidth={6} />
      <g className="train-in">
        <g className="rumble">
          <ellipse cx={700} cy={790} rx={760} ry={16} fill="#000" opacity={0.4} />
          <path d="M-80 640 L1180 640 Q1330 640 1400 720 Q1420 760 1380 760 L-80 760 Z" fill="url(#trainbody)" stroke="#3b4150" strokeWidth={3} />
          <rect x={-80} y={660} width={1380} height={44} fill="#1b2130" />
          {Array.from({ length: 16 }).map((_, i) => (
            <rect key={i} x={-40 + i * 84} y={666} width={60} height={32} rx={6} fill="#ffe6b0" opacity={0.9} />
          ))}
          <path d="M1300 664 Q1370 670 1392 730 L1300 730 Z" fill="#9fd3ff" opacity={0.9} />
          <rect x={-80} y={708} width={1380} height={10} fill="#c8102e" />
          <text x={560} y={748} textAnchor="middle" fontSize={34} fontWeight={900} fill="#1b2130" fontFamily="Segoe UI, Arial, sans-serif" letterSpacing={6}>
            FLYTOGET
          </text>
          <rect x={860} y={722} width={300} height={30} rx={6} fill="#fff" />
          <text x={1010} y={744} textAnchor="middle" fontSize={20} fontWeight={800} fill="#0b3a8a" fontFamily="Segoe UI, Arial, sans-serif">
            Stolt Intility-kunde
          </text>
          <circle cx={1392} cy={742} r={8} fill="#fff6c0" filter="url(#glow)" />
          {[60, 180, 700, 820, 1180, 1290].map((cx) => (
            <rect key={cx} x={cx - 40} y={760} width={80} height={22} rx={4} fill="#2b2f3a" />
          ))}
        </g>
      </g>
      <g className="phone-pop" style={{ transformOrigin: '1300px 330px' }}>
        <g className="phone-shake" style={{ transformOrigin: '1300px 330px' }}>
          <rect x={1190} y={120} width={220} height={420} rx={32} fill="#0e0f14" stroke="#3a3f4b" strokeWidth={6} />
          <rect x={1204} y={134} width={192} height={392} rx={22} fill="#15203a" />
          <rect x={1204} y={134} width={192} height={392} rx={22} fill="url(#beam)" opacity={0.3} />
          <text x={1222} y={162} fontSize={16} fontWeight={700} fill="#fff" fontFamily="Segoe UI, Arial, sans-serif">16:42</text>
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={1320 + i * 12} y={160 - i * 4} width={8} height={8 + i * 4} rx={1} fill="#3ddc84" className={`sig sig-${i}`} />
          ))}
          <text x={1300} y={300} textAnchor="middle" fontSize={22} fontWeight={900} fill="#ff4d6d" fontFamily="Segoe UI, Arial, sans-serif" className="no-signal-t">
            Ingen dekning
          </text>
          <text x={1300} y={330} textAnchor="middle" fontSize={15} fontWeight={600} fill="#9aa3c7" fontFamily="Segoe UI, Arial, sans-serif" className="no-signal-t">
            Søker etter nettverk…
          </text>
          <g className="thought-t">
            <rect x={1216} y={400} width={168} height={70} rx={16} fill="#fff" />
            <text x={1300} y={430} textAnchor="middle" fontSize={18} fontWeight={800} fill="#111" fontFamily="Segoe UI, Arial, sans-serif">Forbanna</text>
            <text x={1300} y={456} textAnchor="middle" fontSize={18} fontWeight={800} fill="#111" fontFamily="Segoe UI, Arial, sans-serif">Edvard…</text>
          </g>
        </g>
      </g>
    </svg>
  );
}

function SceneParty() {
  const r = rng(99);
  const colors = ['#ff4d6d', '#ffc53d', '#3ddc84', '#4da3ff', '#b388ff', '#ff9f43'];
  return (
    <svg className="cine-svg" viewBox="0 100 1600 700" preserveAspectRatio="xMidYMid slice">
      <Defs />
      <rect width="1600" height="900" fill="url(#room)" />
      <rect x={0} y={640} width={1600} height={300} fill="#1a0c2a" />
      <g className="rays" style={{ transformOrigin: '800px 170px' }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <polygon key={i} points="800,170 -200,900 300,1000" fill={colors[i % colors.length]} opacity={0.14} transform={`rotate(${i * 36} 800 170)`} />
        ))}
      </g>
      <line x1={800} y1={0} x2={800} y2={90} stroke="#999" strokeWidth={3} />
      <circle cx={800} cy={170} r={80} fill="url(#mirror)" stroke="#fff" strokeWidth={3} className="ball-spin" style={{ transformOrigin: '800px 170px' }} />
      <circle cx={800} cy={170} r={110} fill="url(#bokeh)" opacity={0.35} />
      <g>
        {Array.from({ length: 26 }).map((_, i) => (
          <circle key={i} cx={r() * 1600} cy={300 + r() * 600} r={12 + r() * 36} fill={colors[i % colors.length]} opacity={0.35} filter="url(#blur12)" className="float-up" style={{ animationDelay: `${r() * 8}s`, animationDuration: `${7 + r() * 8}s` }} />
        ))}
      </g>
      <rect x={300} y={660} width={1000} height={30} rx={6} fill="#3a2a4a" />
      <rect x={340} y={690} width={30} height={110} fill="#2a1a3a" />
      <rect x={1230} y={690} width={30} height={110} fill="#2a1a3a" />
      {[420, 520, 1080, 1180].map((x, i) => (
        <g key={x}>
          <rect x={x} y={560} width={34} height={100} rx={8} fill={i % 2 ? '#1f6f3a' : '#6b2d12'} />
          <rect x={x + 10} y={530} width={14} height={40} fill={i % 2 ? '#1f6f3a' : '#6b2d12'} />
          <rect x={x + 4} y={580} width={26} height={40} fill="#fff" opacity={0.85} />
        </g>
      ))}
      {[640, 720, 860, 940].map((x) => (
        <g key={x}>
          <path d={`M${x} 600 L${x + 40} 600 L${x + 30} 650 L${x + 10} 650 Z`} fill="#ffe08a" opacity={0.9} />
          <rect x={x + 17} y={650} width={6} height={10} fill="#ddd" />
        </g>
      ))}
      <text x={800} y={430} textAnchor="middle" fontSize={190} fontWeight={900} fill="#ffc53d" fontFamily="Segoe UI, Arial, sans-serif" letterSpacing={18} filter="url(#glow)" className="title-pop" style={{ transformOrigin: '800px 400px' }}>
        VORS
      </text>
      <text x={800} y={500} textAnchor="middle" fontSize={44} fontWeight={800} fill="#fff" fontFamily="Segoe UI, Arial, sans-serif" letterSpacing={4} className="fade-in-late">
        Management Gradsa
      </text>
    </svg>
  );
}

export const SCENE_VIEW: Record<string, () => JSX.Element> = {
  dawn: SceneDawn,
  esko: SceneEsko,
  bike: SceneBike,
  flight: SceneFlight,
  train: SceneTrain,
  party: SceneParty,
};

export function Cinematic({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(-1);
  const [prev, setPrev] = useState<number | null>(null);
  const prevTimer = useRef<number | null>(null);
  const scene = index >= 0 ? SCENES[index] : null;
  const last = index === SCENES.length - 1;

  const goTo = (i: number): void => {
    setPrev(index);
    setIndex(i);
    if (prevTimer.current) window.clearTimeout(prevTimer.current);
    prevTimer.current = window.setTimeout(() => setPrev(null), 1100);
  };

  useEffect(() => {
    if (!scene) return;
    audio.playMusic(scene.music);
    const timers = scene.sfx.map(([name, delay]) => window.setTimeout(() => audio.sfx(name), delay));
    if (scene.duration > 0) timers.push(window.setTimeout(() => goTo(index + 1), scene.duration));
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const finish = (): void => {
    audio.sfx('whoosh');
    onDone();
  };

  if (index < 0) {
    return (
      <div
        className="cine cine-gate"
        onClick={() => {
          audio.ensure();
          audio.sfx('click');
          goTo(0);
        }}
      >
        <div className="grain" />
        <div className="cine-gate-inner">
          <div className="cine-gate-kicker">Sosial Grunnmur presenterer</div>
          <h1 className="cine-gate-title">Veien hjem</h1>
          <div className="cine-gate-sub">En kortfilm om en lørdag i oktober</div>
          <button className="btn btn-primary btn-xl" data-primary onClick={(e) => { e.stopPropagation(); audio.ensure(); audio.sfx('click'); goTo(0); }}>
            ▶ Trykk for å starte
          </button>
          <button className="btn btn-ghost btn-sm cine-skip" onClick={(e) => { e.stopPropagation(); finish(); }}>
            Hopp over filmen
          </button>
        </div>
      </div>
    );
  }

  const View = SCENE_VIEW[scene!.id];
  const PrevView = prev !== null && prev >= 0 ? SCENE_VIEW[SCENES[prev].id] : null;

  return (
    <div className="cine">
      <Confetti active={last} />
      <div className="cine-stage">
        {PrevView && (
          <div className="cine-scene cine-exit" key={`prev-${prev}`}>
            <PrevView />
          </div>
        )}
        <div className={`cine-scene cine-enter scene-${scene!.id}`} key={`cur-${index}`}>
          <View />
        </div>
        <div className="vignette" />
        <div className="grain" />
      </div>

      <div className="letterbox letterbox-top">
        <div className="cine-progress">
          {SCENES.map((s, i) => (
            <span key={s.id} className={i <= index ? 'on' : ''} />
          ))}
        </div>
      </div>
      <div className="letterbox letterbox-bottom">
        <div className="cine-caption" key={`cap-${index}`}>
          <div className="cine-kicker">{scene!.kicker}</div>
          <div className="cine-text">{scene!.caption}</div>
        </div>
      </div>

      {last ? (
        <button className="btn btn-primary btn-xl cine-cta" data-primary onClick={finish}>
          La spillene begynne →
        </button>
      ) : (
        <div className="cine-controls">
          <button className="btn btn-ghost btn-sm" data-primary onClick={() => goTo(index + 1)}>
            Neste →
          </button>
          <button className="btn btn-ghost btn-sm" onClick={finish}>
            Hopp over
          </button>
        </div>
      )}
    </div>
  );
}
