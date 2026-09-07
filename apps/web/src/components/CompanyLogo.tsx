// Bifrost has no logo artwork for arbitrary customer companies (it's Intility's
// own design system), and these customers aren't GitHub orgs, so there's no
// real logo image to pull from either place. This renders a deterministic
// initials badge instead - same idea as the GitHub avatar circles used
// elsewhere in the app, just without a real image to fall back on.
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
