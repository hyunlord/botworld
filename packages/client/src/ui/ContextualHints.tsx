import { useState, useEffect } from 'react'
import { OV } from './overlay-styles.js'

interface Hint {
  text: string
  delay: number // ms after cinematic completes
  duration: number // ms to show
}

const HINTS: Hint[] = [
  { text: 'Click any agent to see their story', delay: 2000, duration: 6000 },
  { text: 'Events appear in the feed — click to jump to the action', delay: 30000, duration: 6000 },
  { text: 'Star your favorite agents to track them', delay: 180000, duration: 6000 },
]

export function ContextualHints({ active }: { active: boolean }) {
  const [currentHint, setCurrentHint] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!active) return

    const timers: ReturnType<typeof setTimeout>[] = []

    HINTS.forEach((hint, i) => {
      if (dismissed.has(i)) return

      const showTimer = setTimeout(() => {
        setCurrentHint(hint.text)

        const hideTimer = setTimeout(() => {
          setCurrentHint(prev => prev === hint.text ? null : prev)
          setDismissed(prev => new Set([...prev, i]))
        }, hint.duration)
        timers.push(hideTimer)
      }, hint.delay)
      timers.push(showTimer)
    })

    return () => timers.forEach(t => clearTimeout(t))
  }, [active, dismissed])

  if (!currentHint) return null

  return (
    <div
      style={styles.container}
      onClick={() => setCurrentHint(null)}
    >
      <div style={styles.hint}>
        {currentHint}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    bottom: 80,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 900,
    cursor: 'pointer',
    animation: 'fadeInUp 0.5s ease-out',
  },
  hint: {
    background: 'rgba(15, 20, 35, 0.85)',
    border: `1px solid ${OV.border}`,
    borderRadius: 8,
    padding: '10px 20px',
    color: OV.textMuted,
    fontSize: '13px',
    fontFamily: OV.font,
    backdropFilter: 'blur(8px)',
    whiteSpace: 'nowrap' as const,
  },
}
