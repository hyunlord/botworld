import { useState, useEffect } from 'react'
import type { ActiveWorldEvent } from '@botworld/shared'

interface EventBannerProps {
  activeEvents: ActiveWorldEvent[]
  onNavigate?: (x: number, y: number) => void
}

const CATEGORY_COLORS: Record<string, string> = {
  resource: '#2ecc71',
  social: '#f1c40f',
  danger: '#e74c3c',
  discovery: '#9b59b6',
}

const CATEGORY_ICONS: Record<string, string> = {
  resource: '\uD83C\uDF3F',
  social: '\uD83C\uDF89',
  danger: '\u26A0\uFE0F',
  discovery: '\uD83D\uDDFA\uFE0F',
}

export function EventBanner({ activeEvents, onNavigate }: EventBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [flash, setFlash] = useState<Set<string>>(new Set())

  // Flash new events
  useEffect(() => {
    const newIds = activeEvents
      .filter(e => !flash.has(e.id))
      .map(e => e.id)

    if (newIds.length > 0) {
      setFlash(prev => {
        const next = new Set(prev)
        for (const id of newIds) next.add(id)
        return next
      })

      // Remove flash after animation
      const timer = setTimeout(() => {
        setFlash(prev => {
          const next = new Set(prev)
          for (const id of newIds) next.delete(id)
          return next
        })
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [activeEvents.map(e => e.id).join(',')])

  const visible = activeEvents.filter(e => !dismissed.has(e.id))
  if (visible.length === 0) return null

  return (
    <div style={styles.container}>
      {visible.map(event => {
        const color = CATEGORY_COLORS[event.category] ?? '#888'
        const icon = CATEGORY_ICONS[event.category] ?? ''
        const isFlashing = flash.has(event.id)

        return (
          <div
            key={event.id}
            style={{
              ...styles.banner,
              borderLeftColor: color,
              animation: isFlashing ? 'eventFlash 0.5s ease-in-out 3' : undefined,
            }}
            onClick={() => onNavigate?.(event.position.x, event.position.y)}
          >
            <div style={styles.bannerHeader}>
              <span style={styles.icon}>{icon}</span>
              <span style={{ ...styles.title, color }}>{event.title}</span>
              <button
                style={styles.closeBtn}
                onClick={(e) => { e.stopPropagation(); setDismissed(prev => new Set(prev).add(event.id)) }}
              >
                x
              </button>
            </div>
            <div style={styles.description}>{event.description}</div>
            <div style={styles.meta}>
              <span style={styles.metaItem}>
                ({event.position.x}, {event.position.y})
              </span>
              <span style={styles.metaItem}>
                {Math.ceil(event.ticksRemaining / 60)}m remaining
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    top: 8,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 200,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    maxWidth: 400,
    width: '90%',
    pointerEvents: 'auto',
  },
  banner: {
    background: 'rgba(13, 17, 23, 0.92)',
    borderRadius: 8,
    borderLeft: '4px solid #888',
    padding: '8px 12px',
    cursor: 'pointer',
    backdropFilter: 'blur(8px)',
    transition: 'opacity 0.3s',
  },
  bannerHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  icon: {
    fontSize: 14,
  },
  title: {
    flex: 1,
    fontSize: 13,
    fontWeight: 'bold',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#667788',
    fontSize: 12,
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
  },
  description: {
    fontSize: 11,
    color: '#aabbcc',
    marginTop: 4,
    lineHeight: 1.4,
  },
  meta: {
    display: 'flex',
    gap: 12,
    marginTop: 4,
  },
  metaItem: {
    fontSize: 10,
    color: '#667788',
  },
}
