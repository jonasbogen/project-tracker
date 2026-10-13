import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders children directly under <body>. Full-screen overlays must live
 * outside the scaled screen wrapper (see FitScreen), because a CSS transform
 * turns position: fixed descendants into descendants of the transformed box.
 */
export function Portal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
