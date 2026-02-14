import React, { useState, useEffect } from 'react'
import { OV, glassPanel, interactive, gameButton } from './overlay-styles.js'

interface RankingsPanelProps {
  onClose: () => void
  onSelectAgent?: (agentId: string) => void
  onNavigate?: (x: number, y: number) => void
}

type RankingCategory = 'combat' | 'economy' | 'crafting' | 'exploration' | 'social' | 'overall' | 'items'

interface RankingEntry {
  agentId: string
  agentName: string
  value: number | string
}

interface RankingBoard {
  label: string
  entries: RankingEntry[]
}

interface ItemRankingEntry {
  itemId: string
  name: string
  type: string
  ownerId?: string
  ownerName?: string
  value: number | string
}

interface ItemRankingBoard {
  label: string
  entries: ItemRankingEntry[]
}

interface WorldRecord {
  category: string
  holder?: string
  holderName?: string
  value: number | string
  achievedAt?: number
}

const MEDAL_ICONS = ['🥇', '🥈', '🥉']

const ITEM_TYPE_EMOJI: Record<string, string> = {
  weapon: '⚔️',
  tool: '🔧',
  food: '🍖',
  crafted: '🛠️',
  resource: '🪵',
  treasure: '💎',
}

function RankingBoard({ board, onSelectAgent }: { board: RankingBoard; onSelectAgent?: (id: string) => void }) {
  const entries = Array.isArray(board.entries) ? board.entries : []

  return (
    <div style={{ ...glassPanel, padding: 12, minWidth: 220 }}>
      <h4 style={{ color: OV.accent, margin: '0 0 8px 0', fontSize: 13, fontWeight: 600 }}>
        {board.label}
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {entries.map((entry, i) => (
          <div
            key={entry.agentId}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 8px',
              background: i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent',
              borderRadius: OV.radiusSm,
              cursor: onSelectAgent ? 'pointer' : 'default',
              transition: 'background 0.15s',
            }}
            onClick={() => onSelectAgent?.(entry.agentId)}
            onMouseEnter={(e) => {
              if (onSelectAgent) e.currentTarget.style.background = 'rgba(255,215,0,0.08)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent'
            }}
          >
            <span style={{ color: OV.text, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ minWidth: 24, textAlign: 'center' }}>
                {i < 3 ? MEDAL_ICONS[i] : `#${i + 1}`}
              </span>
              <span>{entry.agentName}</span>
            </span>
            <span style={{ color: OV.accent, fontWeight: 'bold', fontSize: 12 }}>
              {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
            </span>
          </div>
        ))}
      </div>
      {entries.length === 0 && (
        <div style={{ color: OV.textMuted, fontSize: 11, textAlign: 'center', padding: 16 }}>
          No data yet
        </div>
      )}
    </div>
  )
}

function ItemRankingBoard({ board }: { board: ItemRankingBoard }) {
  const entries = Array.isArray(board.entries) ? board.entries : []

  return (
    <div style={{ ...glassPanel, padding: 12, minWidth: 220 }}>
      <h4 style={{ color: OV.accent, margin: '0 0 8px 0', fontSize: 13, fontWeight: 600 }}>
        {board.label}
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {entries.map((entry, i) => (
          <div
            key={entry.itemId}
            style={{
              padding: '6px 8px',
              background: i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent',
              borderRadius: OV.radiusSm,
              fontSize: 11,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <span style={{ color: OV.text, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ minWidth: 20, textAlign: 'center' }}>
                  {i < 3 ? MEDAL_ICONS[i] : `#${i + 1}`}
                </span>
                <span>{ITEM_TYPE_EMOJI[entry.type] || '📦'}</span>
                <span style={{ fontWeight: 500 }}>{entry.name}</span>
              </span>
              <span style={{ color: OV.accent, fontWeight: 'bold', fontSize: 12 }}>
                {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
              </span>
            </div>
            {entry.ownerName && (
              <div style={{ color: OV.textDim, fontSize: 10, paddingLeft: 44 }}>
                Owner: {entry.ownerName}
              </div>
            )}
          </div>
        ))}
      </div>
      {entries.length === 0 && (
        <div style={{ color: OV.textMuted, fontSize: 11, textAlign: 'center', padding: 16 }}>
          No items yet
        </div>
      )}
    </div>
  )
}

function WorldRecordsSection({ records }: { records: WorldRecord[] | null }) {
  if (!records || records.length === 0) {
    return (
      <div style={{ ...glassPanel, padding: 16, marginTop: 16 }}>
        <h3 style={{ color: OV.accent, margin: '0 0 12px 0', fontSize: 16, fontWeight: 600 }}>
          🏆 World Records
        </h3>
        <div style={{ color: OV.textMuted, fontSize: 12, textAlign: 'center', padding: 16 }}>
          No records set yet
        </div>
      </div>
    )
  }

  return (
    <div style={{ ...glassPanel, padding: 16, marginTop: 16 }}>
      <h3 style={{ color: OV.accent, margin: '0 0 12px 0', fontSize: 16, fontWeight: 600 }}>
        🏆 World Records
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {records.map((record, i) => (
          <div
            key={i}
            style={{
              padding: 12,
              background: 'rgba(255,215,0,0.05)',
              border: `1px solid ${OV.borderActive}`,
              borderRadius: OV.radiusSm,
            }}
          >
            <div style={{ color: OV.accent, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              {record.category}
            </div>
            {record.holder ? (
              <>
                <div style={{ color: OV.text, fontSize: 13, fontWeight: 500 }}>
                  {record.holderName || record.holder}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <span style={{ color: OV.accent, fontWeight: 'bold', fontSize: 14 }}>
                    {typeof record.value === 'number' ? record.value.toLocaleString() : record.value}
                  </span>
                  {record.achievedAt && (
                    <span style={{ color: OV.textDim, fontSize: 10 }}>
                      {new Date(record.achievedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div style={{ color: OV.textMuted, fontSize: 11, fontStyle: 'italic' }}>
                No record set
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function RankingsPanel({ onClose, onSelectAgent, onNavigate }: RankingsPanelProps) {
  const [activeTab, setActiveTab] = useState<RankingCategory>('combat')
  const [rankings, setRankings] = useState<any>(null)
  const [itemRankings, setItemRankings] = useState<any>(null)
  const [worldRecords, setWorldRecords] = useState<WorldRecord[] | null>(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null

    const fetchRankings = async () => {
      try {
        const res = await fetch('/api/rankings')
        if (res.ok) {
          const data = await res.json()
          setRankings(data)
          setLoadError(false)
        }
      } catch (err) {
        console.error('Failed to fetch rankings:', err)
      }
    }

    const fetchItemRankings = async () => {
      try {
        const res = await fetch('/api/rankings/items')
        if (res.ok) {
          const data = await res.json()
          setItemRankings(data)
          setLoadError(false)
        }
      } catch (err) {
        console.error('Failed to fetch item rankings:', err)
      }
    }

    const fetchWorldRecords = async () => {
      try {
        const res = await fetch('/api/records')
        if (res.ok) {
          const data = await res.json()
          setWorldRecords(data)
          setLoadError(false)
        }
      } catch (err) {
        console.error('Failed to fetch world records:', err)
      }
    }

    fetchRankings()
    fetchItemRankings()
    fetchWorldRecords()

    timeoutId = setTimeout(() => {
      if (!rankings && !itemRankings && !worldRecords) {
        setLoadError(true)
      }
    }, 5000)

    const interval = setInterval(() => {
      fetchRankings()
      fetchItemRankings()
      fetchWorldRecords()
    }, 10000)

    return () => {
      clearInterval(interval)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const tabs: { id: RankingCategory; label: string; icon: string }[] = [
    { id: 'combat', label: 'Combat', icon: '⚔️' },
    { id: 'economy', label: 'Economy', icon: '💰' },
    { id: 'crafting', label: 'Crafting', icon: '🔨' },
    { id: 'exploration', label: 'Exploration', icon: '🗺️' },
    { id: 'social', label: 'Social', icon: '💬' },
    { id: 'overall', label: 'Overall', icon: '🏆' },
    { id: 'items', label: 'Items', icon: '📦' },
  ]

  const renderTabContent = () => {
    if (loadError) {
      return (
        <div style={{ color: OV.textMuted, textAlign: 'center', padding: 32 }}>
          Unable to connect to server
        </div>
      )
    }

    if (!rankings && activeTab !== 'items') {
      return (
        <div style={{ color: OV.textMuted, textAlign: 'center', padding: 32 }}>
          Loading rankings...
        </div>
      )
    }

    if (activeTab === 'items') {
      if (!itemRankings) {
        return (
          <div style={{ color: OV.textMuted, textAlign: 'center', padding: 32 }}>
            Loading item rankings...
          </div>
        )
      }

      const boards: ItemRankingBoard[] = Object.entries(itemRankings).map(([key, entries]) => ({
        label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        entries: Array.isArray(entries) ? entries as ItemRankingEntry[] : [],
      }))

      return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {boards.map((board, i) => (
            <ItemRankingBoard key={i} board={board} />
          ))}
        </div>
      )
    }

    const categoryData = rankings?.[activeTab]
    if (!categoryData) {
      return (
        <div style={{ color: OV.textMuted, textAlign: 'center', padding: 32 }}>
          No data available for this category
        </div>
      )
    }

    const boards: RankingBoard[] = Object.entries(categoryData).map(([key, entries]) => ({
      label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      entries: Array.isArray(entries) ? entries as RankingEntry[] : [],
    }))

    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {boards.map((board, i) => (
            <RankingBoard key={i} board={board} onSelectAgent={onSelectAgent} />
          ))}
        </div>
        {activeTab === 'overall' && <WorldRecordsSection records={worldRecords} />}
      </>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        ...interactive,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          ...glassPanel,
          width: '100%',
          maxWidth: 1100,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${OV.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: 0, color: OV.accent, fontSize: 20, fontWeight: 700 }}>
            🏆 World Rankings
          </h2>
          <button
            style={{
              ...gameButton,
              padding: '6px 12px',
              fontSize: 14,
            }}
            onClick={onClose}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 215, 0, 0.25)'
              e.currentTarget.style.transform = 'scale(1.05)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 215, 0, 0.15)'
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            ✕ Close
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            padding: '12px 20px',
            borderBottom: `1px solid ${OV.border}`,
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: OV.font,
                border: `1px solid ${activeTab === tab.id ? OV.borderActive : OV.border}`,
                borderRadius: OV.radiusSm,
                background: activeTab === tab.id ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                color: activeTab === tab.id ? OV.accent : OV.textDim,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onClick={() => setActiveTab(tab.id)}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                  e.currentTarget.style.color = OV.text
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'
                  e.currentTarget.style.color = OV.textDim
                }
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 20,
          }}
        >
          {renderTabContent()}
        </div>
      </div>
    </div>
  )
}
