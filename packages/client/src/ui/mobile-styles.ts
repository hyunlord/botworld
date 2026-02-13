/** Inject mobile-specific CSS overrides */
export function injectMobileStyles(): void {
  if (typeof document === 'undefined') return
  if (document.head.querySelector('style[data-mobile-styles]')) return

  const style = document.createElement('style')
  style.setAttribute('data-mobile-styles', 'true')
  style.textContent = `
    /* Prevent pull-to-refresh and bounce on mobile */
    html, body {
      overscroll-behavior: none;
      -webkit-overflow-scrolling: touch;
    }

    /* Touch targets minimum 44px */
    @media (max-width: 767px) {
      button, [role="button"] {
        min-height: 44px;
        min-width: 44px;
      }

      /* Compact HUD on mobile */
      .bottom-hud {
        padding: 4px 8px !important;
        gap: 4px !important;
      }

      /* Hide non-essential elements */
      .desktop-only {
        display: none !important;
      }

      /* Full-width panels */
      .side-panel {
        width: 100% !important;
        max-width: 100% !important;
        border-radius: 0 !important;
      }
    }

    /* Tablet adjustments */
    @media (min-width: 768px) and (max-width: 1023px) {
      .side-panel {
        max-width: 350px !important;
      }
    }

    /* Viewport meta for proper mobile scaling */
    @media (pointer: coarse) {
      /* Touch device - increase hit areas */
      input[type="range"] {
        height: 20px;
      }
    }
  `
  document.head.appendChild(style)
}
