import type { CSSProperties } from 'react';

// A single pulsing placeholder block. Compose a few of these into a shape
// that roughly matches the real content (see Dashboard's loading state)
// instead of a single centered spinner - reads as "this is about to become
// your data" rather than a blank pause.
export default function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return <div className={`skeleton${className ? ` ${className}` : ''}`} style={style} />;
}
