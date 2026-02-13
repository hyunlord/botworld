import { useState, useEffect, useRef } from 'react'
import type { WorldEvent } from '@botworld/shared'
import { OV, glassPanel, interactive } from './overlay-styles.js'
import { soundManager } from '../game/audio/sound-manager.js'

type EntryKind = 'chat' | 'gather' | 'craft' | 'trade' | 'combat' | 'event' | 'political' | 'social'

interface FeedEntry {
  agentName: string
  message: string
  kind: EntryKind
  timestamp: number
  position?: { x: number; y: number }
  agentId?: string
}

const KIND_ICONS: Record<EntryKind, string> = {
  chat: '🗣️',
  gather: '🎒',
  craft: '🔨',
  trade: '🤝',
  combat: '⚔️',
  event: '🏆',
  political: '👑',
  social: '👥',
}

const KIND_COLORS: Record<EntryKind, string> = {
  chat: '#60A5FA',
  gather: '#FFD700',
  craft: '#F59E0B',
  trade: '#4ADE80',
  combat: '#F87171',
  event: '#C084FC',
  political: '#A78BFA',
  social: '#34D399',
}

function eventToEntry(e: WorldEvent, agentNames: Map<string, string>): FeedEntry | null {
  const name = (id: string) => agentNames.get(id) ?? id.slice(0, 8)
  switch (e.type) {
    case 'agent:spoke':
      return { agentName: name(e.agentId), message: `"${e.message}"`, kind: 'chat', timestamp: e.timestamp, agentId: e.agentId }
    case 'resource:gathered':
      return { agentName: name(e.agentId), message: `gathered ${e.amount} ${e.resourceType}`, kind: 'gather', timestamp: e.timestamp, position: e.position, agentId: e.agentId }
    case 'item:crafted':
      return { agentName: name(e.agentId), message: `crafted ${e.item.name}`, kind: 'craft', timestamp: e.timestamp, agentId: e.agentId }
    case 'trade:completed':
      return { agentName: name(e.sellerId), message: `sold ${e.item.name} to ${name(e.buyerId)} for ${e.price}G`, kind: 'trade', timestamp: e.timestamp, agentId: e.buyerId }
    case 'combat:started':
      return { agentName: name(e.agentId), message: `engaged ${e.monsterName}!`, kind: 'combat', timestamp: e.timestamp, position: e.position, agentId: e.agentId }
    case 'combat:ended': {
      let msg: string
      if (e.outcome === 'victory') {
        const lootStr = e.loot.length > 0 ? `, ${e.loot.map(l => l.name).join(', ')}` : ''
        msg = `defeated monster! +${e.xpGained}xp${lootStr}`
      } else if (e.outcome === 'fled') {
        msg = 'fled from combat!'
      } else {
        msg = 'was defeated!'
      }
      return { agentName: name(e.agentId), message: msg, kind: 'combat', timestamp: e.timestamp, agentId: e.agentId }
    }
    case 'monster:spawned':
      return { agentName: e.name, message: `Lv${e.level} ${e.monsterType} appeared!`, kind: 'event', timestamp: e.timestamp, position: e.position }
    case 'monster:died':
      return { agentName: name(e.killedBy), message: `slew a ${e.monsterType}`, kind: 'combat', timestamp: e.timestamp, position: e.position }
    case 'world_event:started':
      return { agentName: 'World', message: `${e.title}`, kind: 'event', timestamp: e.timestamp, position: e.position }
    default:
      return null
  }
}

interface EventFeedProps {
  events: WorldEvent[]
  agentNames: Map<string, string>
  onNavigate?: (x: number, y: number) => void
  onSelectAgent?: (agentId: string) => void
}

export function EventFeed({ events, agentNames, onNavigate, onSelectAgent }: EventFeedProps) {
  const [expanded, setExpanded] = useState(false)
  const [entries, setEntries] = useState<FeedEntry[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [importanceFilter, setImportanceFilter] = useState<string>('all')
  const [searchText, setSearchText] = useState('')
  const lastCountRef = useRef(0)
  const lastNotifRef = useRef(0)

  useEffect(() => {
    const newEntries = events.map(e => eventToEntry(e, agentNames)).filter((e): e is FeedEntry => e !== null)
    if (newEntries.length > 0) {
      setEntries(prev => [...prev, ...newEntries].slice(-50))
      if (!expanded) {
        setUnreadCount(prev => prev + newEntries.length)
        const now = Date.now()
        if (now - lastNotifRef.current > 5000) {
          lastNotifRef.current = now
          soundManager.playUINotification()
        }
      }
    }
  }, [events, agentNames])

  useEffect(() => {
    if (expanded) setUnreadCount(0)
  }, [expanded])

  // Filter entries
  let filtered = entries
  if (categoryFilter !== 'all') {
    filtered = filtered.filter(e => e.kind === categoryFilter)
  }
  if (importanceFilter === 'important') {
    filtered = filtered.filter(e => isImportant(e))
  }
  if (importanceFilter === 'historic') {
    filtered = filtered.filter(e => isHistoric(e))
  }
  if (searchText) {
    const lower = searchText.toLowerCase()
    filtered = filtered.filter(e =>
      e.agentName.toLowerCase().includes(lower) ||
      e.message.toLowerCase().includes(lower)
    )
  }

  const visible = filtered.slice(-5)

  const handleEntryClick = (entry: FeedEntry) => {
    if (entry.agentId && onSelectAgent) {
      onSelectAgent(entry.agentId)
    } else if (entry.position && onNavigate) {
      onNavigate(entry.position.x, entry.position.y)
    }
  }

  const handleNavigate = (entry: FeedEntry) => {
    if (entry.position && onNavigate) {
      soundManager.playUIClick()
      onNavigate(entry.position.x, entry.position.y)
    }
  }

  // Collapsed: just a chat icon with badge
  if (!expanded) {
    return (
      <div style={styles.wrapper}>
        <button
          style={{ ...glassPanel, ...interactive, ...styles.toggleBtn }}
          onClick={() => { soundManager.playUIOpen(); setExpanded(true) }}
          title="Show event feed"
        >
          <span style={styles.toggleIcon}>💬</span>
          {unreadCount > 0 && (
            <span style={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </button>
      </div>
    )
  }

  return (
    <div style={styles.wrapper}>
      <div style={{ ...glassPanel, ...interactive, ...styles.panel }}>
        <div style={styles.header}>
          <span style={styles.headerTitle}>Live Feed</span>
          <button style={styles.collapseBtn} onClick={() => { soundManager.playUIClose(); setExpanded(false) }}>▼</button>
        </div>

        {/* Filters */}
        <div style={styles.filters}>
          {/* Category filter */}
          <div style={styles.filterRow}>
            {['all', 'combat', 'trade', 'craft', 'chat', 'gather', 'event'].map(cat => (
              <button
                key={cat}
                style={filterPill(categoryFilter === cat)}
                onClick={() => { soundManager.playUIClick(); setCategoryFilter(cat) }}
              >
                {cat === 'all' ? 'All' : KIND_ICONS[cat as EntryKind]}
              </button>
            ))}
          </div>

          {/* Importance filter */}
          <div style={styles.filterRow}>
            {['all', 'important', 'historic'].map(imp => (
              <button
                key={imp}
                style={filterPill(importanceFilter === imp)}
                onClick={() => { soundManager.playUIClick(); setImportanceFilter(imp) }}
              >
                {imp === 'all' ? 'All' : imp === 'important' ? '⚡' : '🏛️'}
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            type="text"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Search..."
            style={styles.searchInput}
          />
        </div>

        <div style={styles.entries}>
          {visible.length === 0 && (
            <div style={styles.empty}>
              {entries.length === 0 ? 'Waiting for activity...' : 'No matching events'}
            </div>
          )}
          {visible.map((entry, i) => (
            <div
              key={`${entry.timestamp}-${i}`}
              style={{
                ...styles.entry,
                cursor: (entry.agentId || entry.position) ? 'pointer' : 'default',
                opacity: i < 2 ? 0.6 : 1,  // older entries fade
              }}
              onClick={() => { soundManager.playUIClick(); handleEntryClick(entry) }}
            >
              <span style={{ color: KIND_COLORS[entry.kind] }}>{KIND_ICONS[entry.kind]}</span>
              <span style={styles.entryName}>{entry.agentName}:</span>
              <span style={{ ...styles.entryMsg, color: KIND_COLORS[entry.kind] }}>{entry.message}</span>
              <span style={styles.entryTime}>{formatTimeAgo(entry.timestamp)}</span>
              {entry.position && (
                <button
                  style={styles.goBtn}
                  onClick={(e) => { e.stopPropagation(); handleNavigate(entry) }}
                  title="Go to location"
                >
                  🗺️
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function isImportant(entry: FeedEntry): boolean {
  if (entry.kind === 'combat') return true
  if (entry.kind === 'trade' && entry.message.includes('for ')) {
    const priceMatch = entry.message.match(/for (\d+)G/)
    if (priceMatch && parseInt(priceMatch[1]) >= 100) return true
  }
  if (entry.message.includes('legendary') || entry.message.includes('masterwork')) return true
  if (entry.message.includes('defeated') || entry.message.includes('slew')) return true
  return false
}

function isHistoric(entry: FeedEntry): boolean {
  return entry.kind === 'event' || entry.kind === 'political'
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 10) return 'now'
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

const filterPill = (active: boolean): React.CSSProperties => ({
  padding: '2px 8px',
  fontSize: 10,
  borderRadius: 10,
  border: `1px solid ${active ? OV.accent : OV.border}`,
  background: active ? 'rgba(255,215,0,0.15)' : 'transparent',
  color: active ? OV.accent : OV.textMuted,
  cursor: 'pointer',
  transition: 'all 0.15s',
})

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: 'absolute',
    bottom: 64,
    right: 12,
    zIndex: 100,
    pointerEvents: 'none',
  },
  toggleBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    cursor: 'pointer',
    position: 'relative',
    border: `1px solid ${OV.border}`,
    marginLeft: 'auto',
  },
  toggleIcon: {
    fontSize: 20,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    background: OV.hp,
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
    borderRadius: 10,
    padding: '1px 5px',
    minWidth: 16,
    textAlign: 'center' as const,
  },
  panel: {
    width: 320,
    padding: 10,
    animation: 'fadeSlideIn 0.2s ease-out',
    maxHeight: '60vh',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: OV.textDim,
  },
  collapseBtn: {
    background: 'none',
    border: 'none',
    color: OV.textMuted,
    fontSize: 12,
    cursor: 'pointer',
    padding: '0 4px',
  },
  filters: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottom: `1px solid ${OV.border}`,
  },
  filterRow: {
    display: 'flex',
    gap: 4,
    flexWrap: 'wrap' as const,
  },
  searchInput: {
    width: '100%',
    padding: '4px 6px',
    fontSize: 10,
    background: 'rgba(255, 255, 255, 0.05)',
    border: `1px solid ${OV.border}`,
    borderRadius: 6,
    color: OV.text,
    fontFamily: OV.font,
    outline: 'none',
  },
  entries: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
    overflowY: 'auto' as const,
    flex: 1,
  },
  empty: {
    color: OV.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center' as const,
    padding: 8,
  },
  entry: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    lineHeight: 1.5,
    padding: '2px 4px',
    borderRadius: 4,
    transition: 'opacity 0.3s',
    animation: 'slideInLeft 0.2s ease-out',
    position: 'relative' as const,
  },
  entryName: {
    color: OV.accent,
    fontWeight: 'bold',
    flexShrink: 0,
  },
  entryMsg: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    flex: 1,
  },
  entryTime: {
    fontSize: 9,
    color: OV.textMuted,
    flexShrink: 0,
  },
  goBtn: {
    background: 'none',
    border: 'none',
    fontSize: 10,
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
  },
}
