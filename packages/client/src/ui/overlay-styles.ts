/**
 * Shared design system for all overlay UI components.
 * Game-like aesthetic: dark navy backgrounds with blur,
 * gold accents, vibrant stat colors, and Inter font.
 */

export const OV = {
  // Backgrounds (dark navy, not grey)
  bg: 'rgba(15, 20, 35, 0.85)',
  bgLight: 'rgba(15, 20, 35, 0.6)',
  bgSolid: '#0f1423',
  bgHover: 'rgba(25, 35, 60, 0.9)',

  // Text
  text: '#F0F0F0',
  textDim: '#A0A8B8',
  textMuted: '#5A6478',

  // Accents
  accent: '#FFD700',
  accentDim: 'rgba(255, 215, 0, 0.15)',

  // Borders
  border: 'rgba(255, 255, 255, 0.08)',
  borderActive: 'rgba(255, 215, 0, 0.3)',

  // Stat colors (vibrant with gradient pairs)
  hp: '#EF4444',
  hpGrad: 'linear-gradient(90deg, #EF4444, #DC2626)',
  energy: '#3B82F6',
  energyGrad: 'linear-gradient(90deg, #3B82F6, #2563EB)',
  hunger: '#F59E0B',
  hungerGrad: 'linear-gradient(90deg, #F59E0B, #D97706)',

  // Semantic colors
  green: '#4ADE80',
  blue: '#60A5FA',
  red: '#F87171',
  purple: '#C084FC',

  // Layout
  radius: 12,
  radiusSm: 8,
  blur: 'blur(8px)',

  // Font
  font: "'Inter', system-ui, -apple-system, sans-serif",

  // Category colors (for events)
  category: {
    resource: '#4ADE80',
    social: '#FFD700',
    danger: '#F87171',
    discovery: '#C084FC',
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
  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
  fontFamily: OV.font,
}

/** Game-styled button (gold outline) */
export const gameButton: React.CSSProperties = {
  background: 'rgba(255, 215, 0, 0.15)',
  border: '1px solid rgba(255, 215, 0, 0.3)',
  color: OV.accent,
  borderRadius: OV.radiusSm,
  cursor: 'pointer',
  fontFamily: OV.font,
  fontWeight: 'bold',
  transition: 'background 0.15s, transform 0.1s',
}

/**
 * Injects global CSS for game UI animations and Inter font.
 * Call once on app mount. Idempotent.
 */
let injected = false
export function injectGameStyles() {
  if (injected) return
  injected = true
  const style = document.createElement('style')
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    @keyframes fadeSlideIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; transform: translateY(8px); }
    }
    @keyframes slideInLeft {
      from { opacity: 0; transform: translateX(-20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes eventFlash {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    @keyframes countUp {
      from { transform: translateY(4px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }

    /* Button hover/active feedback */
    button[style*="pointer"]:hover,
    [role="button"]:hover {
      filter: brightness(1.2);
    }
    button[style*="pointer"]:active,
    [role="button"]:active {
      transform: scale(0.96);
    }

    /* Scrollbar styling for panels */
    ::-webkit-scrollbar {
      width: 4px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.25);
    }

    /* Canvas cursor */
    #game-container canvas {
      cursor: grab;
    }
    #game-container canvas:active {
      cursor: grabbing;
    }
  `
  document.head.appendChild(style)
}
