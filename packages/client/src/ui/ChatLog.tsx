import { useState, useEffect, useRef } from 'react'
import type { WorldEvent } from '@botworld/shared'

type EntryKind = 'speech' | 'gather' | 'craft' | 'trade' | 'system'

interface ChatEntry {
  agentName: string
  message: string
  kind: EntryKind
  timestamp: number
}

const KIND_COLORS: Record<EntryKind, string> = {
  speech: '#ccddee',
  gather: '#f1c40f',
  craft: '#e67e22',
  trade: '#2ecc71',
  system: '#8899aa',
}

const FILTER_OPTIONS: { label: string; value: EntryKind | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Speech', value: 'speech' },
  { label: 'Gather', value: 'gather' },
  { label: 'Craft', value: 'craft' },
  { label: 'Trade', value: 'trade' },
]

function eventToEntry(e: WorldEvent, agentNames: Map<string, string>): ChatEntry | null {
  const name = (id: string) => agentNames.get(id) ?? id
  switch (e.type) {
    case 'agent:spoke':
      return { agentName: name(e.agentId), message: e.message, kind: 'speech', timestamp: e.timestamp }
    case 'resource:gathered':
      return { agentName: name(e.agentId), message: `gathered ${e.amount} ${e.resourceType}`, kind: 'gather', timestamp: e.timestamp }
    case 'item:crafted':
      return { agentName: name(e.agentId), message: `crafted ${e.item.name}`, kind: 'craft', timestamp: e.timestamp }
    case 'trade:completed':
      return { agentName: name(e.buyerId), message: `traded with ${name(e.sellerId)} for ${e.item.name}`, kind: 'trade', timestamp: e.timestamp }
    default:
      return null
  }
}

export function ChatLog({ events, agentNames }: {
  events: WorldEvent[]
  agentNames: Map<string, string>
}) {
  const [entries, setEntries] = useState<ChatEntry[]>([])
  const [filter, setFilter] = useState<EntryKind | 'all'>('all')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const newEntries = events.map(e => eventToEntry(e, agentNames)).filter((e): e is ChatEntry => e !== null)
    if (newEntries.length > 0) {
      setEntries(prev => [...prev, ...newEntries].slice(-150))
    }
  }, [events, agentNames])

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight)
  }, [entries])

  const visible = filter === 'all' ? entries : entries.filter(e => e.kind === filter)

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Activity Log</h3>
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
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div ref={scrollRef} style={styles.messages}>
        {visible.length === 0 && (
          <div style={styles.empty}>Waiting for activity...</div>
        )}
        {visible.map((entry, i) => (
          <div key={i} style={styles.entry}>
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
    height: 280,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    margin: 0,
    fontSize: 14,
    color: '#8899aa',
  },
  filters: {
    display: 'flex',
    gap: 2,
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
  },
  empty: {
    color: '#556677',
    fontStyle: 'italic',
  },
  entry: {
    marginBottom: 4,
    lineHeight: 1.4,
  },
  name: {
    color: '#e2b714',
    fontWeight: 'bold',
    marginRight: 6,
  },
  text: {
    color: '#ccddee',
  },
}
