import { useEffect, useRef } from 'react'
import { OV, glassPanel } from './overlay-styles.js'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: TouchEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('touchstart', handler)
    return () => document.removeEventListener('touchstart', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div style={styles.backdrop} onClick={onClose} />
      {/* Sheet */}
      <div ref={sheetRef} style={{ ...glassPanel, ...styles.sheet }}>
        {/* Handle */}
        <div style={styles.handleBar}>
          <div style={styles.handle} />
        </div>
        <div style={styles.header}>
          <span style={styles.title}>{title}</span>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>
        <div style={styles.content}>
          {children}
        </div>
      </div>
    </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    zIndex: 999,
  },
  sheet: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '85vh',
    zIndex: 1000,
    borderRadius: '16px 16px 0 0',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    animation: 'slideUp 0.3s ease-out',
  },
  handleBar: {
    display: 'flex',
    justifyContent: 'center',
    padding: '8px 0 4px',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    background: 'rgba(255,255,255,0.2)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    borderBottom: `1px solid ${OV.border}`,
  },
  title: {
    fontSize: 15,
    fontWeight: 'bold',
    color: OV.text,
    fontFamily: OV.font,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: 24,
    color: OV.textDim,
    cursor: 'pointer',
    lineHeight: 1,
    padding: 0,
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 16px 16px',
  },
}

// Inject slide-up animation
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = `
    @keyframes slideUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }
  `
  if (!document.head.querySelector('style[data-bottomsheet-animations]')) {
    style.setAttribute('data-bottomsheet-animations', 'true')
    document.head.appendChild(style)
  }
}
