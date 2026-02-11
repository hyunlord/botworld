import { useState, useEffect, useRef } from 'react'
import type { WorldEvent } from '@botworld/shared'
import { ACTION_ICONS } from './constants.js'

type EntryKind = 'chat' | 'gather' | 'craft' | 'trade' | 'combat' | 'event'

interface ChatEntry {
  agentName: string
  message: string
  kind: EntryKind
  timestamp: number
  position?: { x: number; y: number }
  agentId?: string
}

const KIND_COLORS: Record<EntryKind, string> = {
  chat: '#ccddee',
  gather: '#f1c40f',
  craft: '#e67e22',
  trade: '#2ecc71',
  combat: '#e74c3c',
  event: '#9b59b6',
}

const KIND_ICONS: Record<EntryKind, string> = {
  chat: '\uD83D\uDCAC',
  gather: '\u26CF\uFE0F',
  craft: '\uD83D\uDD28',
  trade: '\uD83E\uDD1D',
  combat: '\u2694\uFE0F',
  event: '\u2728',
}

const FILTER_OPTIONS: { label: string; value: EntryKind | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Chat', value: 'chat' },
  { label: 'Combat', value: 'combat' },
  { label: 'Events', value: 'event' },
  { label: 'Trade', value: 'trade' },
]

function eventToEntry(e: WorldEvent, agentNames: Map<string, string>): ChatEntry | null {
  const name = (id: string) => agentNames.get(id) ?? id.slice(0, 8)
  switch (e.type) {
    case 'agent:spoke':
      return { agentName: name(e.agentId), message: e.message, kind: 'chat', timestamp: e.timestamp, agentId: e.agentId }
    case 'resource:gathered':
      return { agentName: name(e.agentId), message: `gathered ${e.amount} ${e.resourceType}`, kind: 'gather', timestamp: e.timestamp, position: e.position, agentId: e.agentId }
    case 'item:crafted':
      return { agentName: name(e.agentId), message: `crafted ${e.item.name}`, kind: 'craft', timestamp: e.timestamp, agentId: e.agentId }
    case 'trade:completed':
      return { agentName: name(e.buyerId), message: `traded with ${name(e.sellerId)} for ${e.item.name}`, kind: 'trade', timestamp: e.timestamp, agentId: e.buyerId }
    case 'combat:started':
      return { agentName: name(e.agentId), message: `engaged ${e.monsterName} in combat!`, kind: 'combat', timestamp: e.timestamp, position: e.position, agentId: e.agentId }
    case 'combat:ended':
      return {
        agentName: name(e.agentId),
        message: e.outcome === 'victory'
          ? `defeated monster! +${e.xpGained}xp${e.loot.length > 0 ? `, looted ${e.loot.map(l => l.name).join(', ')}` : ''}`
          : e.outcome === 'fled' ? 'fled from combat!' : 'was defeated in combat!',
        kind: 'combat', timestamp: e.timestamp, agentId: e.agentId,
      }
    case 'monster:spawned':
      return { agentName: e.name, message: `Lv${e.level} ${e.monsterType} appeared!`, kind: 'event', timestamp: e.timestamp, position: e.position }
    case 'monster:died':
      return { agentName: name(e.killedBy), message: `slew a ${e.monsterType}`, kind: 'combat', timestamp: e.timestamp, position: e.position }
    case 'world_event:started':
      return { agentName: 'World', message: `${e.title}: ${e.description}`, kind: 'event', timestamp: e.timestamp, position: e.position }
    default:
      return null
  }
}

export function ChatLog({ events, agentNames, onNavigate, onSelectAgent }: {
  events: WorldEvent[]
  agentNames: Map<string, string>
  onNavigate?: (x: number, y: number) => void
  onSelectAgent?: (agentId: string) => void
}) {
  const [entries, setEntries] = useState<ChatEntry[]>([])
  const [filter, setFilter] = useState<EntryKind | 'all'>('all')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const newEntries = events.map(e => eventToEntry(e, agentNames)).filter((e): e is ChatEntry => e !== null)
    if (newEntries.length > 0) {
      setEntries(prev => [...prev, ...newEntries].slice(-200))
    }
  }, [events, agentNames])

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight)
  }, [entries])

  const visible = filter === 'all' ? entries : entries.filter(e => e.kind === filter)

  const handleEntryClick = (entry: ChatEntry) => {
    if (entry.agentId && onSelectAgent) {
      onSelectAgent(entry.agentId)
    } else if (entry.position && onNavigate) {
      onNavigate(entry.position.x, entry.position.y)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Activity Log</h3>
      </div>
      <div style={styles.filters}>
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            style={{
              ...styles.filterBtn,
              background: filter === opt.value ? '#2a3a5e' : 'transparent',
              color: filter === opt.value ? '#ccddee' : '#556677',
            }}
          >
            {opt.value !== 'all' && KIND_ICONS[opt.value as EntryKind]}{' '}{opt.label}
          </button>
        ))}
      </div>
      <div ref={scrollRef} style={styles.messages}>
        {visible.length === 0 && (
          <div style={styles.empty}>Waiting for activity...</div>
        )}
        {visible.map((entry, i) => (
          <div
            key={i}
            style={{
              ...styles.entry,
              cursor: (entry.agentId || entry.position) ? 'pointer' : 'default',
            }}
            onClick={() => handleEntryClick(entry)}
          >
            <span style={{ ...styles.kindIcon, color: KIND_COLORS[entry.kind] }}>
              {KIND_ICONS[entry.kind]}
            </span>
            <span style={styles.name}>{entry.agentName}</span>
            <span style={{ ...styles.text, color: KIND_COLORS[entry.kind] }}>{entry.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#16213e',
    borderRadius: 8,
    padding: 12,
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    margin: 0,
    fontSize: 14,
    color: '#8899aa',
  },
  filters: {
    display: 'flex',
    gap: 2,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  filterBtn: {
    border: 'none',
    borderRadius: 4,
    padding: '2px 6px',
    fontSize: 10,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    fontSize: 12,
    minHeight: 0,
  },
  empty: {
    color: '#556677',
    fontStyle: 'italic',
  },
  entry: {
    marginBottom: 4,
    lineHeight: 1.4,
    display: 'flex',
    alignItems: 'baseline',
    gap: 4,
    padding: '1px 4px',
    borderRadius: 3,
  },
  kindIcon: {
    fontSize: 10,
    flexShrink: 0,
  },
  name: {
    color: '#e2b714',
    fontWeight: 'bold',
    flexShrink: 0,
  },
  text: {
    color: '#ccddee',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
}
