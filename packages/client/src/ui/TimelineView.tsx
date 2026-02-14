import { useState, useEffect, useRef } from 'react'
import { OV, glassPanel, interactive, gameButton } from './overlay-styles.js'
import { soundManager } from '../game/audio/sound-manager.js'

interface TimelineViewProps {
  onClose: () => void
  onNavigate?: (x: number, y: number) => void
  onSelectAgent?: (agentId: string) => void
}

interface TimelineEvent {
  id: string
  day: number
  tick: number
  category: string
  title: string
  description: string
  agentIds: string[]
  agentNames: string[]
  position?: { x: number; y: number }
}

const CATEGORY_COLORS: Record<string, string> = {
  nation_founded: '#60A5FA',
  war: '#F87171',
  legendary_item: '#FFD700',
  boss_kill: '#C084FC',
  election: '#4ADE80',
  disaster: '#F59E0B',
  record_broken: '#06B6D4',
  discovery: '#14B8A6',
}

const DAY_WIDTH_LEVELS = [4, 8, 16, 32, 64]

export function TimelineView({ onClose, onNavigate, onSelectAgent }: TimelineViewProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null)
  const [zoomLevel, setZoomLevel] = useState(2) // index into DAY_WIDTH_LEVELS
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    soundManager.playUIOpen()

    // ESC key handler
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        soundManager.playUIClose()
        onClose()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  // Fetch timeline data
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null

    setLoading(true)
    setError(null)

    fetch('/api/timeline')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch timeline')
        return res.json()
      })
      .then(data => {
        setEvents(data.events || [])
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })

    timeoutId = setTimeout(() => {
      if (loading && events.length === 0) {
        setError('Unable to connect to server')
        setLoading(false)
      }
    }, 5000)

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [])

  const handleCloseClick = () => {
    soundManager.playUIClose()
    onClose()
  }

  const handleZoomIn = () => {
    soundManager.playUIClick()
    setZoomLevel(prev => Math.min(DAY_WIDTH_LEVELS.length - 1, prev + 1))
  }

  const handleZoomOut = () => {
    soundManager.playUIClick()
    setZoomLevel(prev => Math.max(0, prev - 1))
  }

  const handleCategoryToggle = (category: string) => {
    soundManager.playUIClick()
    setCategoryFilter(prev => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  const handleEventClick = (event: TimelineEvent) => {
    soundManager.playUIClick()
    setSelectedEvent(event)
  }

  const handleAgentClick = (agentId: string) => {
    soundManager.playUIClick()
    if (onSelectAgent) {
      onSelectAgent(agentId)
    }
  }

  const handleNavigateClick = () => {
    soundManager.playUIClick()
    if (selectedEvent?.position && onNavigate) {
      onNavigate(selectedEvent.position.x, selectedEvent.position.y)
    }
  }

  // Filter events
  const filteredEvents = categoryFilter.size === 0
    ? events
    : events.filter(e => categoryFilter.has(e.category))

  // Calculate timeline dimensions
  const maxDay = Math.max(...events.map(e => e.day), 1)
  const dayWidth = DAY_WIDTH_LEVELS[zoomLevel]
  const timelineWidth = maxDay * dayWidth + 100 // padding

  // Get unique categories
  const categories = Array.from(new Set(events.map(e => e.category)))

  // Category vertical positions
  const categoryYPositions: Record<string, number> = {}
  categories.forEach((cat, idx) => {
    categoryYPositions[cat] = 40 + idx * 24
  })

  return (
    <div style={styles.backdrop} onClick={handleCloseClick}>
      <div style={{ ...glassPanel, ...interactive, ...styles.modal }} onClick={(e) => e.stopPropagation()}>
        <button style={styles.closeBtn} onClick={handleCloseClick}>✕</button>

        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>World Timeline</h2>
          <div style={styles.controls}>
            <button style={styles.zoomBtn} onClick={handleZoomOut} disabled={zoomLevel === 0}>
              🔍−
            </button>
            <button style={styles.zoomBtn} onClick={handleZoomIn} disabled={zoomLevel === DAY_WIDTH_LEVELS.length - 1}>
              🔍+
            </button>
          </div>
        </div>

        {/* Category filters */}
        <div style={styles.filterRow}>
          {categories.map(cat => {
            const active = categoryFilter.size === 0 || categoryFilter.has(cat)
            return (
              <button
                key={cat}
                onClick={() => handleCategoryToggle(cat)}
                style={{
                  ...styles.categoryBtn,
                  background: active ? `${CATEGORY_COLORS[cat]}20` : 'rgba(255,255,255,0.05)',
                  borderColor: active ? CATEGORY_COLORS[cat] : 'rgba(255,255,255,0.1)',
                  color: active ? CATEGORY_COLORS[cat] : OV.textMuted,
                }}
              >
                {cat.replace(/_/g, ' ')}
              </button>
            )
          })}
        </div>

        {/* Timeline container */}
        <div style={styles.timelineContainer} ref={scrollRef}>
          {loading && <div style={styles.emptyText}>Loading timeline...</div>}
          {error && <div style={styles.errorText}>Error: {error}</div>}
          {!loading && !error && filteredEvents.length === 0 && (
            <div style={styles.emptyText}>No historical events recorded yet</div>
          )}
          {!loading && !error && filteredEvents.length > 0 && (
            <div style={styles.timelineCanvas}>
              {/* Day axis labels */}
              <div style={styles.dayAxis}>
                {Array.from({ length: Math.ceil(maxDay / 10) + 1 }, (_, i) => i * 10).map(day => (
                  <div
                    key={day}
                    style={{
                      ...styles.dayLabel,
                      left: day * dayWidth,
                    }}
                  >
                    Day {day}
                  </div>
                ))}
              </div>

              {/* Category lanes */}
              <svg style={{ width: timelineWidth, height: categories.length * 24 + 60, overflow: 'visible' }}>
                {/* Grid lines */}
                {Array.from({ length: Math.ceil(maxDay / 10) + 1 }, (_, i) => i * 10).map(day => (
                  <line
                    key={day}
                    x1={day * dayWidth}
                    y1={20}
                    x2={day * dayWidth}
                    y2={categories.length * 24 + 40}
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth={1}
                  />
                ))}

                {/* Category lane lines */}
                {categories.map((cat, idx) => (
                  <line
                    key={cat}
                    x1={0}
                    y1={40 + idx * 24}
                    x2={timelineWidth}
                    y2={40 + idx * 24}
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                ))}

                {/* Event nodes */}
                {filteredEvents.map((event, idx) => {
                  const x = event.day * dayWidth
                  const y = categoryYPositions[event.category] || 40
                  const isSelected = selectedEvent?.id === event.id
                  const color = CATEGORY_COLORS[event.category] || '#888'

                  return (
                    <g key={event.id}>
                      {isSelected && (
                        <circle
                          cx={x}
                          cy={y}
                          r={16}
                          fill="none"
                          stroke={color}
                          strokeWidth={2}
                          opacity={0.5}
                        />
                      )}
                      <circle
                        cx={x}
                        cy={y}
                        r={6}
                        fill={color}
                        stroke={isSelected ? '#fff' : color}
                        strokeWidth={isSelected ? 2 : 1}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleEventClick(event)}
                      />
                    </g>
                  )
                })}
              </svg>

              {/* Category labels (fixed on left) */}
              <div style={styles.categoryLabels}>
                {categories.map((cat, idx) => (
                  <div
                    key={cat}
                    style={{
                      ...styles.categoryLabel,
                      top: 40 + idx * 24 - 8,
                      color: CATEGORY_COLORS[cat],
                    }}
                  >
                    {cat.replace(/_/g, ' ')}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Selected event detail panel */}
        {selectedEvent && (
          <div style={styles.detailPanel}>
            <div style={styles.detailHeader}>
              <h3 style={styles.detailTitle}>{selectedEvent.title}</h3>
              <button style={styles.detailClose} onClick={() => setSelectedEvent(null)}>✕</button>
            </div>
            <div style={styles.detailBody}>
              <p style={styles.detailDesc}>{selectedEvent.description}</p>
              <div style={styles.detailMeta}>
                <span style={styles.detailMetaItem}>
                  📅 Day {selectedEvent.day} (Tick {selectedEvent.tick})
                </span>
                <span style={styles.detailMetaItem}>
                  🏷️ {selectedEvent.category.replace(/_/g, ' ')}
                </span>
              </div>
              {selectedEvent.agentNames.length > 0 && (
                <div style={styles.agentsSection}>
                  <div style={styles.agentsHeader}>Agents Involved:</div>
                  <div style={styles.agentsList}>
                    {selectedEvent.agentNames.map((name, idx) => (
                      <button
                        key={selectedEvent.agentIds[idx]}
                        style={styles.agentBtn}
                        onClick={() => handleAgentClick(selectedEvent.agentIds[idx])}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {selectedEvent.position && (
                <button style={{ ...gameButton, ...styles.navBtn }} onClick={handleNavigateClick}>
                  📍 Navigate to Location
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(4px)',
    animation: 'fadeSlideIn 0.2s ease-out',
  },
  modal: {
    width: '90vw',
    maxWidth: 1200,
    height: '85vh',
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflowY: 'auto',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    background: 'none',
    border: 'none',
    color: OV.textMuted,
    fontSize: 20,
    cursor: 'pointer',
    padding: '4px 8px',
    transition: 'color 0.15s',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: OV.accent,
    margin: 0,
  },
  controls: {
    display: 'flex',
    gap: 8,
  },
  zoomBtn: {
    background: 'rgba(255,215,0,0.1)',
    border: '1px solid rgba(255,215,0,0.3)',
    borderRadius: 6,
    color: OV.accent,
    fontSize: 14,
    cursor: 'pointer',
    padding: '6px 12px',
    fontFamily: OV.font,
    transition: 'all 0.15s',
  },
  filterRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: `1px solid ${OV.border}`,
  },
  categoryBtn: {
    border: '1px solid',
    borderRadius: 6,
    padding: '6px 12px',
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: OV.font,
    textTransform: 'capitalize',
    transition: 'all 0.15s',
    fontWeight: '600',
  },
  timelineContainer: {
    flex: 1,
    overflowX: 'auto',
    overflowY: 'hidden',
    position: 'relative',
    background: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  timelineCanvas: {
    position: 'relative',
    minHeight: 300,
  },
  dayAxis: {
    position: 'relative',
    height: 30,
    marginBottom: 10,
  },
  dayLabel: {
    position: 'absolute',
    top: 0,
    fontSize: 10,
    color: OV.textDim,
    whiteSpace: 'nowrap',
  },
  categoryLabels: {
    position: 'absolute',
    left: 0,
    top: 30,
    width: 120,
    pointerEvents: 'none',
  },
  categoryLabel: {
    position: 'absolute',
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  detailPanel: {
    background: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    border: `1px solid ${OV.border}`,
    padding: 16,
  },
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: OV.accent,
    margin: 0,
  },
  detailClose: {
    background: 'none',
    border: 'none',
    color: OV.textMuted,
    fontSize: 16,
    cursor: 'pointer',
    padding: 4,
  },
  detailBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  detailDesc: {
    fontSize: 13,
    color: OV.text,
    lineHeight: 1.6,
    margin: 0,
  },
  detailMeta: {
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap',
  },
  detailMetaItem: {
    fontSize: 11,
    color: OV.textDim,
  },
  agentsSection: {
    marginTop: 4,
  },
  agentsHeader: {
    fontSize: 12,
    color: OV.textDim,
    fontWeight: '600',
    marginBottom: 8,
  },
  agentsList: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  agentBtn: {
    background: 'rgba(255,215,0,0.1)',
    border: '1px solid rgba(255,215,0,0.2)',
    borderRadius: 4,
    color: OV.accent,
    fontSize: 11,
    padding: '4px 10px',
    cursor: 'pointer',
    fontFamily: OV.font,
    transition: 'all 0.15s',
  },
  navBtn: {
    padding: '10px 16px',
    fontSize: 13,
    width: '100%',
  },
  emptyText: {
    fontSize: 14,
    color: OV.textMuted,
    textAlign: 'center',
    padding: 40,
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 14,
    color: OV.red,
    textAlign: 'center',
    padding: 40,
  },
}
