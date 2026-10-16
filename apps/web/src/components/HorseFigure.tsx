/**
 * The four race horses, each in costume. Side view, running to the right.
 *
 *   ♠  Bling   – gold chains and sunglasses
 *   ♥  Smoking – tuxedo, bow tie and top hat
 *   ♦  Spons   – Intility sponsor blanket and a start number
 *   ♣  Kostyme – quite clearly two people in a horse costume (two pairs of
 *                human legs in different trousers, a zip down the middle and
 *                a face peeking out of the neck)
 *
 * Legs carry the class hf-leg so the gallop animation can swing them.
 */
export type HorseSuit = '♠' | '♥' | '♦' | '♣';

export const HORSE_NAME: Record<HorseSuit, string> = {
  '♠': 'Bling',
  '♥': 'Smoking',
  '♦': 'Sponsen',
  '♣': 'Kostymet',
};

const COAT: Record<HorseSuit, { body: string; dark: string; mane: string }> = {
  '♠': { body: '#3b2416', dark: '#24150c', mane: '#120a05' },
  '♥': { body: '#b5542a', dark: '#7d3417', mane: '#4a1d0a' },
  '♦': { body: '#d9d4cc', dark: '#a8a198', mane: '#f3f0ea' },
  '♣': { body: '#8a5a3a', dark: '#5f3b22', mane: '#3c2314' },
};

export function HorseFigure({ suit, className = '' }: { suit: HorseSuit; className?: string }) {
  const c = COAT[suit];
  const costume = suit === '♣';
  return (
    <svg className={`hf hf-${suit === '♠' ? 'bling' : suit === '♥' ? 'tux' : suit === '♦' ? 'spons' : 'kostyme'} ${className}`} viewBox="0 0 130 96" aria-hidden="true">
      {/* tail */}
      <path d="M14 42 C 4 46, 2 60, 10 70 C 8 60, 12 52, 20 48 Z" fill={c.mane} />
      {/* back legs */}
      <g className="hf-leg hf-leg-back">
        {costume ? (
          <>
            <rect x="24" y="56" width="9" height="26" rx="3" fill="#2b2b33" />
            <rect x="36" y="56" width="9" height="26" rx="3" fill="#2b2b33" />
            <path d="M21 80 h14 a4 4 0 0 1 4 4 v2 h-20 v-3 a3 3 0 0 1 2 -3 z" fill="#c8102e" />
            <path d="M33 80 h14 a4 4 0 0 1 4 4 v2 h-20 v-3 a3 3 0 0 1 2 -3 z" fill="#c8102e" />
          </>
        ) : (
          <>
            <path d="M26 56 l-4 26 h7 l5 -26 z" fill={c.dark} />
            <path d="M38 56 l-2 26 h7 l3 -26 z" fill={c.body} />
            <rect x="21" y="80" width="8" height="5" rx="1.5" fill="#222" />
            <rect x="35" y="80" width="8" height="5" rx="1.5" fill="#222" />
          </>
        )}
      </g>
      {/* body */}
      <ellipse cx="52" cy="46" rx="34" ry="19" fill={c.body} />
      <ellipse cx="60" cy="52" rx="24" ry="11" fill={c.dark} opacity="0.35" />
      {/* front legs */}
      <g className="hf-leg hf-leg-front">
        {costume ? (
          <>
            <rect x="62" y="56" width="9" height="26" rx="3" fill="#3a6fb5" />
            <rect x="74" y="56" width="9" height="26" rx="3" fill="#3a6fb5" />
            <path d="M59 80 h14 a4 4 0 0 1 4 4 v2 h-20 v-3 a3 3 0 0 1 2 -3 z" fill="#f4f4f4" stroke="#999" strokeWidth="0.8" />
            <path d="M71 80 h14 a4 4 0 0 1 4 4 v2 h-20 v-3 a3 3 0 0 1 2 -3 z" fill="#f4f4f4" stroke="#999" strokeWidth="0.8" />
          </>
        ) : (
          <>
            <path d="M64 56 l-1 26 h7 l3 -26 z" fill={c.dark} />
            <path d="M76 56 l2 26 h7 l-1 -26 z" fill={c.body} />
            <rect x="62" y="80" width="8" height="5" rx="1.5" fill="#222" />
            <rect x="77" y="80" width="8" height="5" rx="1.5" fill="#222" />
          </>
        )}
      </g>
      {/* neck and head */}
      <path d="M74 36 C 78 24, 86 16, 96 14 L 104 26 C 98 30, 90 38, 84 46 Z" fill={c.body} />
      <path d="M78 30 C 84 22, 90 17, 97 15 L 92 13 C 86 14, 80 20, 76 28 Z" fill={c.mane} />
      <path d="M94 14 L 110 12 C 118 12, 124 18, 124 24 L 122 30 C 120 34, 114 34, 110 32 L 104 28 Z" fill={c.body} />
      <path d="M108 29 l 8 2 c 3 1, 5 -1, 5 -3 l -2 -3 z" fill={c.dark} />
      <circle cx="120" cy="25" r="1.6" fill="#111" />
      <path d="M100 13 l -2 -7 l 6 5 z" fill={c.body} />
      <path d="M106 12 l 1 -8 l 4 7 z" fill={c.body} />
      {!costume && <circle cx="111" cy="20" r="2.4" fill="#111" />}

      {/* ---------- costumes ---------- */}
      {suit === '♠' && (
        <>
          {/* gold chains around the neck with a dollar pendant */}
          <path d="M80 30 C 86 38, 90 44, 96 46" fill="none" stroke="#f2c84b" strokeWidth="2.6" strokeDasharray="2.6 1.6" strokeLinecap="round" />
          <path d="M83 26 C 90 34, 94 40, 100 42" fill="none" stroke="#ffd96a" strokeWidth="2.2" strokeDasharray="2.2 1.4" strokeLinecap="round" />
          <circle cx="97" cy="48" r="5" fill="#f2c84b" stroke="#b8860b" strokeWidth="1" />
          <text x="97" y="50.5" textAnchor="middle" fontSize="7" fontWeight="900" fill="#6b4a00">$</text>
          {/* sunglasses */}
          <rect x="105" y="16.5" width="11" height="6.5" rx="2" fill="#111" />
          <rect x="117.5" y="17" width="6" height="5.5" rx="2" fill="#111" />
          <path d="M116 19.5 h1.5" stroke="#111" strokeWidth="1.5" />
          <path d="M105 19 L 98 16" stroke="#111" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M107 18 l 3 1" stroke="#7fd3ff" strokeWidth="1" opacity="0.8" />
        </>
      )}

      {suit === '♥' && (
        <>
          {/* tuxedo jacket on the chest, white shirt, bow tie */}
          <path d="M70 32 C 84 36, 88 48, 84 62 L 70 62 C 66 50, 66 40, 70 32 Z" fill="#141418" />
          <path d="M73 36 L 80 48 L 73 60 Z" fill="#fff" />
          <path d="M76 40 l 5 -3 v 6 z M76 40 l -5 -3 v 6 z" fill="#c8102e" />
          <circle cx="76" cy="40" r="1.3" fill="#8a0b1e" />
          <path d="M60 30 C 64 44, 64 56, 60 64" stroke="#141418" strokeWidth="3" fill="none" />
          {/* top hat */}
          <rect x="99" y="-2" width="14" height="12" rx="1.5" fill="#141418" />
          <rect x="96" y="8.5" width="20" height="3.5" rx="1.5" fill="#141418" />
          <rect x="99" y="5" width="14" height="2.5" fill="#c8102e" />
          {/* monocle */}
          <circle cx="111" cy="20" r="4" fill="none" stroke="#f2c84b" strokeWidth="1.2" />
          <path d="M114 23 l 3 6" stroke="#f2c84b" strokeWidth="0.9" />
        </>
      )}

      {suit === '♦' && (
        <>
          {/* sponsor blanket on the side */}
          <path d="M28 34 h44 a6 6 0 0 1 6 6 v16 a6 6 0 0 1 -6 6 h-44 a6 6 0 0 1 -6 -6 v-16 a6 6 0 0 1 6 -6 z" fill="#0e1726" stroke="#19d27a" strokeWidth="2" />
          <text x="50" y="46.5" textAnchor="middle" fontSize="9.5" fontWeight="900" fill="#fff" letterSpacing="0.6">INTILITY</text>
          <text x="50" y="56" textAnchor="middle" fontSize="4.6" fontWeight="700" fill="#19d27a" letterSpacing="0.2">OFFISIELL SPONSOR</text>
          {/* start number on the neck and a little flag */}
          <rect x="84" y="28" width="12" height="11" rx="2" fill="#fff" />
          <text x="90" y="36.5" textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#0e1726">7</text>
          <path d="M20 30 v -16 l 12 4 l -12 4" fill="#19d27a" stroke="#19d27a" strokeWidth="1.5" strokeLinejoin="round" />
        </>
      )}

      {suit === '♣' && (
        <>
          {/* the seam and zip of a two-person costume */}
          <path d="M52 28 L 52 64" stroke="#3c2314" strokeWidth="2" strokeDasharray="3 2" />
          <path d="M50 30 h4 M50 34 h4 M50 38 h4 M50 42 h4 M50 46 h4 M50 50 h4 M50 54 h4 M50 58 h4" stroke="#d9d4cc" strokeWidth="1.2" />
          <rect x="49.5" y="60" width="5" height="4" rx="1" fill="#d9d4cc" />
          {/* a patch and a sagging back */}
          <rect x="30" y="38" width="12" height="9" rx="2" fill="#a86e48" stroke="#3c2314" strokeWidth="1" strokeDasharray="2 1.5" />
          <path d="M40 30 C 48 36, 56 36, 64 30" stroke="#5f3b22" strokeWidth="1.5" fill="none" />
          {/* a human face peeking out of the neck hole */}
          <ellipse cx="88" cy="36" rx="7" ry="8" fill="#5f3b22" />
          <circle cx="88" cy="36" r="5.5" fill="#f1c9a5" />
          <circle cx="86" cy="35" r="0.9" fill="#222" />
          <circle cx="90" cy="35" r="0.9" fill="#222" />
          <path d="M86 38.5 q 2 1.8 4 0" stroke="#a0522d" strokeWidth="0.9" fill="none" />
          {/* googly cardboard horse eye */}
          <circle cx="111" cy="20" r="3.4" fill="#fff" stroke="#222" strokeWidth="0.8" />
          <circle cx="112.2" cy="21" r="1.6" fill="#111" />
          <path d="M94 15 l 10 -3" stroke="#3c2314" strokeWidth="1" strokeDasharray="2 1.5" />
        </>
      )}
    </svg>
  );
}
