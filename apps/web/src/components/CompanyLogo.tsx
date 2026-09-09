import { useEffect, useState } from 'react';

// A curated subset of the "Eksterne logoer/_Kunder" folder the user uploaded,
// copied into apps/web/public/logos (see manifest.json there) — one
// web-renderable file per company, picked automatically (prefers SVG, then
// PNG/JPG, avoids "white"/"negativ" variants when a plainer one exists). Only
// ~63 of the many companies in that folder are real customers of this tool;
// most of the folder (hundreds of unrelated vendor/partner logos) was never
// copied over. Falls back to a generated initials badge when no logo matches.
let manifestPromise: Promise<Record<string, string>> | null = null;

function loadManifest(): Promise<Record<string, string>> {
  if (!manifestPromise) {
    manifestPromise = fetch('/logos/manifest.json')
      .then((res) => (res.ok ? (res.json() as Promise<Record<string, string>>) : {}))
      .catch(() => ({}));
  }
  return manifestPromise;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function commonPrefixLength(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[i] === b[i]) i += 1;
  return i;
}

// Two normalized names are a fuzzy match when they share almost their entire
// length as a common prefix - covers "Entra" <-> "Entra Eiendom" (one is a
// full prefix of the other) and "Aker Securities" <-> "Aker Security" (same
// prefix, differ only in the last couple of letters). A flat "differs by at
// most 2 characters" allowance is too generous for short names ("Norad" would
// match "Norsk Hydro" on their shared "nor-"), so this requires the shared
// prefix to cover most of the shorter name's length, not just come close to
// its absolute end.
function isFuzzyMatch(a: string, b: string): boolean {
  const shorter = Math.min(a.length, b.length);
  if (shorter < 4) return a === b;
  const prefix = commonPrefixLength(a, b);
  return prefix >= 4 && prefix / shorter >= 0.8;
}

// Exact match on the normalized name wins outright; otherwise the first fuzzy
// match (see isFuzzyMatch).
function findLogoFile(name: string, manifest: Record<string, string>): string | null {
  const target = normalize(name);
  if (!target) return null;
  let fuzzy: string | null = null;
  for (const [company, file] of Object.entries(manifest)) {
    const candidate = normalize(company);
    if (candidate === target) return file;
    if (!fuzzy && isFuzzyMatch(candidate, target)) {
      fuzzy = file;
    }
  }
  return fuzzy;
}

const PALETTE = [
  '--bfc-brand-hsl',
  '--bfc-chill-hsl',
  '--bfc-attn-hsl',
  '--bfc-success-hsl',
  '--bfc-warning-hsl',
];

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function CompanyLogo({ name, size = 28 }: { name: string; size?: number }) {
  const [logoFile, setLogoFile] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadManifest().then((manifest) => {
      if (!cancelled) setLogoFile(findLogoFile(name, manifest));
    });
    return () => {
      cancelled = true;
    };
  }, [name]);

  if (logoFile) {
    return (
      <span className="company-logo company-logo-image" style={{ width: size, height: size }} title={name}>
        <img src={`/logos/${logoFile}`} alt="" width={size} height={size} />
      </span>
    );
  }

  const colorVar = PALETTE[hashCode(name) % PALETTE.length];
  return (
    <span
      className="company-logo"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `hsl(var(${colorVar}) / 0.16)`,
        color: `hsl(var(${colorVar}))`,
      }}
      title={name}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
