/**
 * Shared design system for all overlay UI components.
 * Consistent glassmorphism aesthetic: semi-transparent dark backgrounds
 * with blur, gold accents, and soft borders.
 */

export const OV = {
  // Colors
  bg: 'rgba(15, 20, 30, 0.85)',
  bgSolid: '#0f141e',
  bgHover: 'rgba(30, 40, 60, 0.9)',
  text: '#E8E8E8',
  textDim: '#9AA0B0',
  textMuted: '#5A6070',
  accent: '#FFD700',
  accentDim: 'rgba(255, 215, 0, 0.2)',
  border: 'rgba(255, 255, 255, 0.1)',
  borderActive: 'rgba(255, 215, 0, 0.3)',

  // Stat colors
  hp: '#e74c3c',
  energy: '#3498db',
  hunger: '#f39c12',
  green: '#2ecc71',
  purple: '#9b59b6',

  // Layout
  radius: 8,
  radiusSm: 6,
  blur: 'blur(12px)',

  // Category colors (for events)
  category: {
    resource: '#2ecc71',
    social: '#f1c40f',
    danger: '#e74c3c',
    discovery: '#9b59b6',
  } as Record<string, string>,
} as const

/** Common overlay container style (no pointer events, positioned absolute) */
export const overlayBase: React.CSSProperties = {
  position: 'absolute',
  pointerEvents: 'none',
  zIndex: 100,
}

/** Interactive element style (re-enable pointer events) */
export const interactive: React.CSSProperties = {
  pointerEvents: 'auto',
}

/** Glassmorphism panel style */
export const glassPanel: React.CSSProperties = {
  background: OV.bg,
  backdropFilter: OV.blur,
  WebkitBackdropFilter: OV.blur,
  border: `1px solid ${OV.border}`,
  borderRadius: OV.radius,
}
