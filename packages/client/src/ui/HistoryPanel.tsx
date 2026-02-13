/**
 * HistoryPanel — collapsible overlay showing world history timeline.
 * Fetched from GET /api/history.
 */

import { useState, useEffect, useCallback } from 'react'
import { OV, glassPanel, interactive } from './overlay-styles.js'

interface HistoryEntry {
  id: string
  tick: number
  day: number
  season: string
  type: string
  title: string
  description: string
  participants: string[]
  location: string
  significance: number
}

interface HistoryPanelProps {
  onNavigate?: (x: number, y: number) => void
}

const TYPE_ICONS: Record<string, string> = {
  founding: '\uD83C\uDFF0',
  battle: '\u2694\uFE0F',
  alliance: '\uD83E\uDD1D',
  betrayal: '\uD83D\uDDE1\uFE0F',
  discovery: '\uD83D\uDD2D',
  disaster: '\uD83C\uDF0B',
  achievement: '\u2B50',
  election: '\uD83D\uDDF3\uFE0F',
  treaty: '\uD83D\uDCDC',
  cultural: '\uD83C\uDFAD',
}

const SEASON_COLORS: Record<string, string> = {
  spring: '#4ADE80',
  summer: '#FBBF24',
  autumn: '#F97316',
  winter: '#93C5FD',
}

const SIG_COLORS: Record<number, string> = {
  10: '#EF4444',
  9: '#EF4444',
  8: '#F97316',
  7: '#FBBF24',
  6: '#4ADE80',
  5: '#3B82F6',
}

export function HistoryPanel({ onNavigate }: HistoryPanelProps) {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [minSig, setMinSig] = useState(4)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/history?minSignificance=${minSig}&limit=50`)
      if (res.ok) {
        const data = await res.json()
        setEntries(data.entries ?? [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [minSig])

  useEffect(() => {
    if (!open) return
    fetchData()
    const iv = setInterval(fetchData, 30_000)
    return () => clearInterval(iv)
  }, [open, fetchData])

  if (!open) {
    return (
      <div
        style={{ ...styles.toggleBtn, ...interactive }}
        onClick={() => setOpen(true)}
        title="World History"
      >
        {'\uD83D\uDCDC'}
      </div>
    )
  }

  return (
    <div style={{ ...styles.panel, ...glassPanel, ...interactive }}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.title}>{'\uD83D\uDCDC'} World History</span>
        <span style={styles.count}>{entries.length} events</span>
        <span style={styles.closeBtn} onClick={() => setOpen(false)}>{'\u2715'}</span>
      </div>

      {/* Significance filter */}
      <div style={styles.filterRow}>
        <span style={styles.filterLabel}>Min significance:</span>
        {[3, 4, 5, 6, 7].map(s => (
          <span
            key={s}
            style={{
              ...styles.filterChip,
              ...(minSig === s ? styles.filterChipActive : {}),
            }}
            onClick={() => setMinSig(s)}
          >
            {s}+
          </span>
        ))}
      </div>

      {/* Timeline */}
      <div style={styles.content}>
        {loading && entries.length === 0 && <div style={styles.empty}>Loading...</div>}
        {!loading && entries.length === 0 && <div style={styles.empty}>No recorded history yet</div>}

        {entries.map(entry => (
          <div key={entry.id} style={styles.entry}>
            <div style={styles.entryHeader}>
              <span style={styles.entryIcon}>{TYPE_ICONS[entry.type] ?? '\uD83D\uDCDD'}</span>
              <span style={styles.entryTitle}>{entry.title}</span>
              <span style={{
                ...styles.sigBadge,
                background: `${SIG_COLORS[entry.significance] ?? '#6B7280'}22`,
                color: SIG_COLORS[entry.significance] ?? '#6B7280',
                borderColor: `${SIG_COLORS[entry.significance] ?? '#6B7280'}44`,
              }}>
                {entry.significance}
              </span>
            </div>
            <div style={styles.entryMeta}>
              <span style={{
                color: SEASON_COLORS[entry.season] ?? OV.textDim,
              }}>
                {entry.season}
              </span>
              <span> Day {entry.day}</span>
              <span style={styles.entryType}>{entry.type}</span>
            </div>
            <div style={styles.entryDesc}>{entry.description}</div>
            {entry.location && (
              <div
                style={styles.entryLocation}
                onClick={() => {
                  // Try to parse coordinates from location
                  const match = entry.location.match(/\((-?\d+),\s*(-?\d+)\)/)
                  if (match && onNavigate) {
                    onNavigate(parseInt(match[1], 10), parseInt(match[2], 10))
                  }
                }}
              >
                {'\uD83D\uDCCD'} {entry.location}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  toggleBtn: {
    position: 'absolute',
    top: 124,
    right: 16,
    zIndex: 150,
    width: 36,
    height: 36,
    borderRadius: OV.radiusSm,
    background: OV.bg,
    backdropFilter: OV.blur,
    border: `1px solid ${OV.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    cursor: 'pointer',
    boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
    pointerEvents: 'auto',
  },
  panel: {
    position: 'absolute',
    top: 124,
    right: 16,
    zIndex: 150,
    pointerEvents: 'auto' as const,
    width: 360,
    maxHeight: 'calc(100vh - 220px)',
    display: 'flex',
    flexDirection: 'column',
    padding: 0,
    overflow: 'hidden',
    animation: 'fadeSlideIn 0.2s ease-out',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    borderBottom: `1px solid ${OV.border}`,
  },
  title: {
    fontWeight: 700,
    fontSize: 14,
    color: OV.accent,
    flex: 1,
  },
  count: {
    fontSize: 11,
    color: OV.textDim,
  },
  closeBtn: {
    cursor: 'pointer',
    color: OV.textDim,
    fontSize: 14,
    padding: '0 4px',
  },
  filterRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 14px',
    borderBottom: `1px solid ${OV.border}`,
  },
  filterLabel: {
    fontSize: 10,
    color: OV.textDim,
    marginRight: 4,
  },
  filterChip: {
    fontSize: 10,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 10,
    background: OV.bgLight,
    color: OV.textDim,
    cursor: 'pointer',
    border: `1px solid ${OV.border}`,
  },
  filterChipActive: {
    background: OV.accentDim,
    color: OV.accent,
    borderColor: OV.accent,
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  empty: {
    color: OV.textMuted,
    fontSize: 12,
    textAlign: 'center',
    padding: 20,
  },
  entry: {
    background: OV.bgLight,
    borderRadius: OV.radiusSm,
    border: `1px solid ${OV.border}`,
    padding: '8px 10px',
  },
  entryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  entryIcon: {
    fontSize: 14,
  },
  entryTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: 600,
    color: OV.text,
  },
  sigBadge: {
    fontSize: 10,
    fontWeight: 700,
    padding: '1px 6px',
    borderRadius: 4,
    border: '1px solid',
  },
  entryMeta: {
    display: 'flex',
    gap: 8,
    fontSize: 10,
    color: OV.textDim,
    marginBottom: 4,
  },
  entryType: {
    textTransform: 'capitalize',
    fontStyle: 'italic',
  },
  entryDesc: {
    fontSize: 11,
    color: OV.textDim,
    lineHeight: 1.4,
  },
  entryLocation: {
    fontSize: 10,
    color: OV.textMuted,
    marginTop: 4,
    cursor: 'pointer',
  },
}
