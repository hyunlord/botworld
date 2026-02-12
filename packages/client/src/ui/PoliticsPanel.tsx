/**
 * PoliticsPanel — collapsible overlay showing guilds, settlements, kingdoms,
 * treaties, and wars. Fetched from GET /api/politics/summary.
 */

import { useState, useEffect, useCallback } from 'react'
import { OV, glassPanel, interactive } from './overlay-styles.js'

interface GuildSummary {
  id: string; name: string; type: string; members: number
  leader: string; treasury: number
}

interface SettlementSummary {
  id: string; name: string; type: string; population: number
  leader: string | null; allegiance: string | null
}

interface KingdomSummary {
  id: string; name: string; ruler: string
  settlements: number; diplomacy: Record<string, string>
}

interface PoliticsSummaryData {
  guilds: GuildSummary[]
  settlements: SettlementSummary[]
  kingdoms: KingdomSummary[]
  activeWars: number
  activeTreaties: number
}

interface PoliticsPanelProps {
  agentNames: Map<string, string>
}

type Tab = 'guilds' | 'settlements' | 'kingdoms'

const TAB_ICONS: Record<Tab, string> = {
  guilds: '\u2694\uFE0F',     // crossed swords
  settlements: '\uD83C\uDFD8\uFE0F', // houses
  kingdoms: '\uD83D\uDC51',   // crown
}

const TYPE_ICONS: Record<string, string> = {
  trade: '\uD83D\uDCB0', combat: '\u2694\uFE0F', craft: '\uD83D\uDD28',
  exploration: '\uD83E\uDDED', social: '\uD83E\uDD1D',
  camp: '\u26FA', village: '\uD83C\uDFE0', town: '\uD83C\uDFD8\uFE0F', city: '\uD83C\uDFF0',
}

const DIPLOMACY_COLORS: Record<string, string> = {
  war: '#EF4444', hostile: '#F97316', neutral: '#9CA3AF',
  friendly: '#3B82F6', allied: '#4ADE80', vassal: '#C084FC',
}

export function PoliticsPanel({ agentNames }: PoliticsPanelProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('guilds')
  const [data, setData] = useState<PoliticsSummaryData | null>(null)
  const [loading, setLoading] = useState(false)

  const resolveName = useCallback((id: string | null) => {
    if (!id) return 'None'
    return agentNames.get(id) ?? id.slice(0, 8)
  }, [agentNames])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/politics/summary')
      if (res.ok) setData(await res.json())
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  // Fetch when opened, then every 30s
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
        title="Politics"
      >
        {'\uD83C\uDFDB\uFE0F'}
      </div>
    )
  }

  const hasContent = data && (data.guilds.length > 0 || data.settlements.length > 0 || data.kingdoms.length > 0)

  return (
    <div style={{ ...styles.panel, ...glassPanel, ...interactive }}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.title}>{'\uD83C\uDFDB\uFE0F'} Politics</span>
        {data && (
          <span style={styles.stats}>
            {data.activeWars > 0 && <span style={{ color: OV.red }}>{'\uD83D\uDD25'} {data.activeWars} war{data.activeWars > 1 ? 's' : ''}</span>}
            {data.activeTreaties > 0 && <span style={{ color: OV.blue, marginLeft: data.activeWars > 0 ? 8 : 0 }}>{'\uD83D\uDCDC'} {data.activeTreaties}</span>}
          </span>
        )}
        <span style={styles.closeBtn} onClick={() => setOpen(false)}>{'\u2715'}</span>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {(['guilds', 'settlements', 'kingdoms'] as Tab[]).map(t => (
          <div
            key={t}
            style={{
              ...styles.tab,
              ...(tab === t ? styles.tabActive : {}),
            }}
            onClick={() => setTab(t)}
          >
            {TAB_ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
            {data && <span style={styles.badge}>
              {t === 'guilds' ? data.guilds.length : t === 'settlements' ? data.settlements.length : data.kingdoms.length}
            </span>}
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={styles.content}>
        {loading && !data && <div style={styles.empty}>Loading...</div>}
        {!loading && !hasContent && <div style={styles.empty}>No political entities yet</div>}

        {tab === 'guilds' && data?.guilds.map(g => (
          <div key={g.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <span>{TYPE_ICONS[g.type] ?? '\u2694\uFE0F'} {g.name}</span>
              <span style={styles.cardType}>{g.type}</span>
            </div>
            <div style={styles.cardBody}>
              <span>{'\uD83D\uDC64'} {g.members}</span>
              <span>{'\uD83D\uDC51'} {resolveName(g.leader)}</span>
              <span>{'\uD83D\uDCB0'} {g.treasury}G</span>
            </div>
          </div>
        ))}

        {tab === 'settlements' && data?.settlements.map(s => (
          <div key={s.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <span>{TYPE_ICONS[s.type] ?? '\uD83C\uDFE0'} {s.name}</span>
              <span style={styles.cardType}>{s.type}</span>
            </div>
            <div style={styles.cardBody}>
              <span>{'\uD83D\uDC64'} {s.population}</span>
              <span>{'\uD83D\uDC51'} {resolveName(s.leader)}</span>
              {s.allegiance && <span style={{ color: OV.purple }}>{'\uD83C\uDFF0'} Kingdom</span>}
            </div>
          </div>
        ))}

        {tab === 'kingdoms' && data?.kingdoms.map(k => (
          <div key={k.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <span>{'\uD83D\uDC51'} {k.name}</span>
              <span style={styles.cardType}>{k.settlements} settlements</span>
            </div>
            <div style={styles.cardBody}>
              <span>{'\uD83D\uDC51'} {resolveName(k.ruler)}</span>
            </div>
            {Object.keys(k.diplomacy).length > 0 && (
              <div style={styles.diplomacyRow}>
                {Object.entries(k.diplomacy).map(([otherId, status]) => {
                  const otherK = data.kingdoms.find(x => x.id === otherId)
                  return (
                    <span key={otherId} style={{
                      ...styles.diplomacyTag,
                      background: `${DIPLOMACY_COLORS[status] ?? OV.textMuted}22`,
                      color: DIPLOMACY_COLORS[status] ?? OV.textMuted,
                      borderColor: `${DIPLOMACY_COLORS[status] ?? OV.textMuted}44`,
                    }}>
                      {status} {otherK ? `w/ ${otherK.name}` : ''}
                    </span>
                  )
                })}
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
    top: 80,
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
  },
  panel: {
    position: 'absolute',
    top: 80,
    right: 16,
    zIndex: 150,
    width: 320,
    maxHeight: 'calc(100vh - 180px)',
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
  },
  stats: {
    fontSize: 11,
    flex: 1,
    textAlign: 'right',
  },
  closeBtn: {
    cursor: 'pointer',
    color: OV.textDim,
    fontSize: 14,
    padding: '0 4px',
  },
  tabs: {
    display: 'flex',
    borderBottom: `1px solid ${OV.border}`,
  },
  tab: {
    flex: 1,
    padding: '8px 4px',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: 600,
    color: OV.textDim,
    cursor: 'pointer',
    transition: 'color 0.15s, border-bottom 0.15s',
    borderBottom: '2px solid transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabActive: {
    color: OV.accent,
    borderBottom: `2px solid ${OV.accent}`,
  },
  badge: {
    background: OV.accentDim,
    color: OV.accent,
    borderRadius: 10,
    padding: '1px 6px',
    fontSize: 10,
    fontWeight: 700,
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  empty: {
    color: OV.textMuted,
    fontSize: 12,
    textAlign: 'center',
    padding: 20,
  },
  card: {
    background: OV.bgLight,
    borderRadius: OV.radiusSm,
    border: `1px solid ${OV.border}`,
    padding: '8px 10px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 12,
    fontWeight: 600,
    color: OV.text,
    marginBottom: 4,
  },
  cardType: {
    fontSize: 10,
    color: OV.textDim,
    textTransform: 'capitalize',
  },
  cardBody: {
    display: 'flex',
    gap: 10,
    fontSize: 11,
    color: OV.textDim,
  },
  diplomacyRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  diplomacyTag: {
    fontSize: 10,
    fontWeight: 600,
    padding: '2px 6px',
    borderRadius: 4,
    border: '1px solid',
    textTransform: 'capitalize',
  },
}
