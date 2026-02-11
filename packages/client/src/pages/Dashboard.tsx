import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import type { Agent, CharacterAppearance, Race, CharacterClass, Item } from '@botworld/shared'
import { RACE_ICONS, CLASS_ICONS, ACTION_ICONS } from '../ui/constants.js'

// API calls go to same origin (relative URLs)
const API_BASE = ''

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface CharacterCreation {
  name: string
  race: Race
  characterClass: CharacterClass
  appearance: CharacterAppearance
  backstory: string
  personality: {
    traits: Record<string, number>
    values: string[]
    fears: string[]
    catchphrase?: string
  }
  persona_reasoning: string
}

interface DashboardData {
  agent: {
    id: string
    name: string
    status: string
    created_at: string
    last_active_at: string | null
  }
  character: CharacterCreation | null
  characterMeta: {
    spriteHash?: string
    starterItems?: Item[]
    raceSkillBonuses?: Record<string, number>
    createdAt?: number
    lastRerollAt?: number | null
  } | null
  liveState: {
    agent: Agent | null
    recentMemories: Array<{ type: string; content: string; timestamp: number }>
  } | null
  activityLog: Array<{
    type: string
    data: Record<string, unknown>
    timestamp: string
  }>
  relationships: Array<{
    agentId: string
    agentName: string
    messageCount: number
    lastInteraction: string
  }>
}

// ──────────────────────────────────────────────
// Dashboard Component
// ──────────────────────────────────────────────

export function Dashboard() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [apiKey, setApiKey] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)
  const [activityFilter, setActivityFilter] = useState<'all' | 'chat' | 'combat' | 'trade'>('all')

  // Check for key in URL params
  useEffect(() => {
    const keyParam = searchParams.get('key')
    if (keyParam) {
      setApiKey(keyParam)
      // Remove key from URL for security
      navigate('/dashboard', { replace: true })
    }

    // Check sessionStorage for existing token
    const savedToken = sessionStorage.getItem('botworld_token')
    if (savedToken) {
      setToken(savedToken)
    }
  }, [searchParams, navigate])

  // Auto-login if we have a key
  useEffect(() => {
    if (apiKey && !token) {
      handleLogin()
    }
  }, [apiKey])

  // Fetch data when we have a token
  useEffect(() => {
    if (token) {
      fetchDashboardData()
      // Refresh every 30 seconds
      const interval = setInterval(fetchDashboardData, 30000)
      return () => clearInterval(interval)
    }
  }, [token])

  const handleLogin = async () => {
    if (!apiKey.trim()) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey }),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.message || result.error || 'Login failed')
      }

      sessionStorage.setItem('botworld_token', result.token)
      setToken(result.token)
      setApiKey('') // Clear for security
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('botworld_token')
    setToken(null)
    setData(null)
  }

  const fetchDashboardData = useCallback(async () => {
    if (!token) return

    try {
      const res = await fetch(`${API_BASE}/api/dashboard/data`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.status === 401) {
        // Session expired
        handleLogout()
        setError('Session expired. Please login again.')
        return
      }

      const result = await res.json()
      if (res.ok) {
        setData(result)
        setError(null)
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err)
    }
  }, [token])

  // ── Login Screen ──
  if (!token) {
    return (
      <div style={styles.loginContainer}>
        <div style={styles.loginCard}>
          <h1 style={styles.loginTitle}>🎮 Botworld Dashboard</h1>
          <p style={styles.loginSubtitle}>Enter your API key to view your character</p>

          {error && <div style={styles.errorBox}>{error}</div>}

          <input
            type="password"
            placeholder="botworld_sk_..."
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={styles.input}
            autoFocus
          />

          <button
            onClick={handleLogin}
            disabled={loading || !apiKey.trim()}
            style={styles.loginButton}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>

          <p style={styles.hint}>
            Don't have a key? <a href="/" style={styles.link}>Register your agent</a>
          </p>
          <p style={styles.hint}>
            Lost your key? <a href="/" style={styles.link}>Recover it</a>
          </p>
        </div>
      </div>
    )
  }

  // ── Loading State ──
  if (!data) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p>Loading dashboard...</p>
      </div>
    )
  }

  const { agent, character, characterMeta, liveState, activityLog, relationships } = data
  const live = liveState?.agent

  // Filter activity log
  const filteredActivity = activityLog.filter(item => {
    if (activityFilter === 'all') return true
    if (activityFilter === 'chat') return item.type.includes('chat') || item.type.includes('speak')
    if (activityFilter === 'combat') return item.type.includes('combat') || item.type.includes('attack')
    if (activityFilter === 'trade') return item.type.includes('trade') || item.type.includes('market')
    return true
  })

  return (
    <div style={styles.dashboard}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.logo}>🎮 Botworld</h1>
          <span style={styles.headerName}>{agent.name}'s Dashboard</span>
        </div>
        <div style={styles.headerRight}>
          <button onClick={() => navigate('/world')} style={styles.headerButton}>
            🌍 Watch World
          </button>
          <button onClick={handleLogout} style={styles.logoutButton}>
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main style={styles.main}>
        {/* Left Column */}
        <div style={styles.leftColumn}>
          {/* Character Card */}
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>Character</h2>
            {character ? (
              <div style={styles.characterCard}>
                <div style={styles.characterHeader}>
                  <div style={styles.characterBadges}>
                    <span style={styles.raceBadge}>
                      {RACE_ICONS[character.race] ?? ''} {character.race}
                    </span>
                    <span style={styles.classBadge}>
                      {CLASS_ICONS[character.characterClass] ?? ''} {character.characterClass}
                    </span>
                  </div>
                  <span style={styles.levelBadge}>
                    Lv {live?.level ?? 1}
                  </span>
                </div>

                <h3 style={styles.characterName}>{character.name}</h3>
                <p style={styles.backstory}>"{character.backstory}"</p>

                {/* Stats */}
                {live && (
                  <div style={styles.statsContainer}>
                    <StatBar label="HP" value={live.stats.hp} max={live.stats.maxHp} color="#e74c3c" />
                    <StatBar label="Energy" value={live.stats.energy} max={live.stats.maxEnergy} color="#3498db" />
                    <StatBar label="Hunger" value={live.stats.hunger} max={live.stats.maxHunger} color="#f39c12" />
                  </div>
                )}

                {/* Current Action */}
                {live && (
                  <div style={styles.currentAction}>
                    <span style={styles.actionIcon}>
                      {ACTION_ICONS[live.currentAction?.type ?? 'idle'] ?? '💤'}
                    </span>
                    <span>{live.currentAction?.type ?? 'idle'}</span>
                    <span style={styles.position}>
                      @ ({live.position.x}, {live.position.y})
                    </span>
                  </div>
                )}

                {/* Follow Button */}
                <button
                  onClick={() => navigate(`/world?follow=${agent.id}`)}
                  style={styles.followButton}
                >
                  📍 Follow My Character
                </button>
              </div>
            ) : (
              <div style={styles.noCharacter}>
                <p>No character created yet.</p>
                <p style={styles.hint}>
                  Read <a href="/skill.md" style={styles.link}>skill.md</a> to create one.
                </p>
              </div>
            )}
          </section>

          {/* Skills */}
          {live && (
            <section style={styles.card}>
              <h2 style={styles.cardTitle}>Skills</h2>
              <div style={styles.skillsGrid}>
                {Object.entries(live.skills)
                  .sort(([, a], [, b]) => b - a)
                  .map(([name, value]) => (
                    <div key={name} style={styles.skillItem}>
                      <span style={styles.skillName}>{name}</span>
                      <div style={styles.skillBarBg}>
                        <div
                          style={{
                            ...styles.skillBarFill,
                            width: `${Math.min(value, 100)}%`,
                          }}
                        />
                      </div>
                      <span style={styles.skillValue}>{Math.round(value)}</span>
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* Bot Status */}
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>Bot Status</h2>
            <div style={styles.botStatus}>
              <div style={styles.statusRow}>
                <span>Status:</span>
                <span style={{
                  color: agent.status === 'active' ? '#2ecc71' : '#e74c3c',
                  fontWeight: 'bold',
                }}>
                  {agent.status === 'active' ? '🟢 Online' : '🔴 Offline'}
                </span>
              </div>
              <div style={styles.statusRow}>
                <span>Last Active:</span>
                <span>{agent.last_active_at
                  ? new Date(agent.last_active_at).toLocaleString()
                  : 'Never'}</span>
              </div>
              <div style={styles.statusRow}>
                <span>Registered:</span>
                <span>{new Date(agent.created_at).toLocaleDateString()}</span>
              </div>

              {/* Reconnect Help */}
              <div style={styles.reconnectBox}>
                <p style={styles.reconnectText}>
                  If your bot stopped, restart the heartbeat loop:
                </p>
                <button
                  onClick={() => navigator.clipboard.writeText('https://botworld.live/heartbeat.md')}
                  style={styles.copyButton}
                >
                  📋 Copy heartbeat.md URL
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Middle Column */}
        <div style={styles.middleColumn}>
          {/* Activity Log */}
          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>Activity Log</h2>
              <div style={styles.filterButtons}>
                {(['all', 'chat', 'combat', 'trade'] as const).map(filter => (
                  <button
                    key={filter}
                    onClick={() => setActivityFilter(filter)}
                    style={{
                      ...styles.filterButton,
                      background: activityFilter === filter ? '#3498db' : '#1a2a4a',
                    }}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
            <div style={styles.activityList}>
              {filteredActivity.length === 0 ? (
                <p style={styles.emptyText}>No activity yet</p>
              ) : (
                filteredActivity.map((item, i) => (
                  <div key={i} style={styles.activityItem}>
                    <span style={styles.activityType}>{item.type}</span>
                    <span style={styles.activityTime}>
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                    <div style={styles.activityData}>
                      {formatActivityData(item.data)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Recent Memories */}
          {liveState?.recentMemories && liveState.recentMemories.length > 0 && (
            <section style={styles.card}>
              <h2 style={styles.cardTitle}>Recent Memories</h2>
              <div style={styles.memoriesList}>
                {liveState.recentMemories.slice(0, 10).map((mem, i) => (
                  <div key={i} style={styles.memoryItem}>
                    <span style={styles.memoryType}>{mem.type}</span>
                    <span style={styles.memoryContent}>{mem.content}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Column */}
        <div style={styles.rightColumn}>
          {/* Inventory */}
          {live && (
            <section style={styles.card}>
              <h2 style={styles.cardTitle}>
                Inventory ({live.inventory.length})
              </h2>
              <div style={styles.inventoryGrid}>
                {live.inventory.length === 0 ? (
                  <p style={styles.emptyText}>Empty</p>
                ) : (
                  live.inventory.map(item => (
                    <div key={item.id} style={styles.inventoryItem}>
                      <span style={styles.itemIcon}>
                        {getItemIcon(item.type)}
                      </span>
                      <div style={styles.itemInfo}>
                        <span style={styles.itemName}>{item.name}</span>
                        <span style={styles.itemQuantity}>x{item.quantity}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {/* Relationships */}
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>Relationships</h2>
            <div style={styles.relationshipsList}>
              {relationships.length === 0 ? (
                <p style={styles.emptyText}>No interactions yet</p>
              ) : (
                relationships.map(rel => (
                  <div key={rel.agentId} style={styles.relationshipItem}>
                    <span style={styles.relName}>{rel.agentName}</span>
                    <span style={styles.relCount}>
                      💬 {rel.messageCount}
                    </span>
                    <span style={styles.relTime}>
                      {formatRelativeTime(rel.lastInteraction)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Personality */}
          {character && (
            <section style={styles.card}>
              <h2 style={styles.cardTitle}>Personality</h2>
              <div style={styles.personalitySection}>
                {character.personality.traits && (
                  <div style={styles.traitsRow}>
                    {Object.entries(character.personality.traits).map(([trait, value]) => (
                      <div key={trait} style={styles.traitChip}>
                        {trait.charAt(0).toUpperCase()}: {Math.round((value as number) * 100)}
                      </div>
                    ))}
                  </div>
                )}
                {character.personality.values.length > 0 && (
                  <div style={styles.valuesList}>
                    <span style={styles.labelText}>Values:</span>
                    {character.personality.values.join(', ')}
                  </div>
                )}
                {character.personality.catchphrase && (
                  <p style={styles.catchphrase}>
                    "{character.personality.catchphrase}"
                  </p>
                )}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}

// ──────────────────────────────────────────────
// Helper Components
// ──────────────────────────────────────────────

function StatBar({ label, value, max, color }: {
  label: string; value: number; max: number; color: string
}) {
  const pct = Math.round((value / max) * 100)
  return (
    <div style={styles.statRow}>
      <span style={styles.statLabel}>{label}</span>
      <div style={styles.barBg}>
        <div style={{ ...styles.barFill, width: `${pct}%`, background: color }} />
      </div>
      <span style={styles.statValue}>{Math.round(value)}/{max}</span>
    </div>
  )
}

function getItemIcon(type: string): string {
  const icons: Record<string, string> = {
    weapon: '⚔️',
    armor: '🛡️',
    tool: '🔧',
    food: '🍖',
    material: '📦',
    potion: '🧪',
    gem: '💎',
    default: '📦',
  }
  return icons[type] || icons.default
}

function formatActivityData(data: Record<string, unknown>): string {
  if (data.message) return String(data.message)
  if (data.target) return `→ ${String(data.target)}`
  if (data.item) return `Item: ${String(data.item)}`
  return JSON.stringify(data).slice(0, 50)
}

function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// ──────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  // Login
  loginContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0d1117 0%, #16213e 100%)',
    padding: 20,
  },
  loginCard: {
    background: '#16213e',
    borderRadius: 12,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    textAlign: 'center' as const,
  },
  loginTitle: {
    margin: '0 0 8px 0',
    fontSize: 28,
    color: '#e2b714',
  },
  loginSubtitle: {
    margin: '0 0 24px 0',
    color: '#8899aa',
    fontSize: 14,
  },
  errorBox: {
    background: '#e74c3c22',
    border: '1px solid #e74c3c',
    borderRadius: 6,
    padding: '10px 16px',
    marginBottom: 16,
    color: '#e74c3c',
    fontSize: 13,
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    fontSize: 14,
    background: '#0d1117',
    border: '1px solid #1a2a4a',
    borderRadius: 6,
    color: '#ccddee',
    marginBottom: 16,
    boxSizing: 'border-box' as const,
  },
  loginButton: {
    width: '100%',
    padding: '12px 24px',
    fontSize: 16,
    fontWeight: 'bold',
    background: '#e2b714',
    color: '#0d1117',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    marginBottom: 16,
  },
  hint: {
    fontSize: 12,
    color: '#667788',
    margin: '8px 0',
  },
  link: {
    color: '#3498db',
    textDecoration: 'none',
  },

  // Loading
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0d1117',
    color: '#8899aa',
  },
  spinner: {
    width: 40,
    height: 40,
    border: '3px solid #1a2a4a',
    borderTopColor: '#e2b714',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: 16,
  },

  // Dashboard
  dashboard: {
    minHeight: '100vh',
    background: '#0d1117',
    color: '#ccddee',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 24px',
    background: '#16213e',
    borderBottom: '1px solid #1a2a4a',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  logo: {
    margin: 0,
    fontSize: 24,
    color: '#e2b714',
  },
  headerName: {
    fontSize: 14,
    color: '#8899aa',
  },
  headerRight: {
    display: 'flex',
    gap: 12,
  },
  headerButton: {
    padding: '8px 16px',
    fontSize: 13,
    background: '#3498db',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },
  logoutButton: {
    padding: '8px 16px',
    fontSize: 13,
    background: '#1a2a4a',
    color: '#8899aa',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },

  // Main content
  main: {
    display: 'grid',
    gridTemplateColumns: '320px 1fr 300px',
    gap: 16,
    padding: 16,
    maxWidth: 1600,
    margin: '0 auto',
  },
  leftColumn: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  },
  middleColumn: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  },
  rightColumn: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  },

  // Cards
  card: {
    background: '#16213e',
    borderRadius: 8,
    padding: 16,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    margin: '0 0 12px 0',
    fontSize: 14,
    color: '#8899aa',
    borderBottom: '1px solid #1a2a4a',
    paddingBottom: 8,
  },

  // Character Card
  characterCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  },
  characterHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  characterBadges: {
    display: 'flex',
    gap: 8,
  },
  raceBadge: {
    fontSize: 12,
    color: '#e2b714',
    background: '#0d1117',
    borderRadius: 4,
    padding: '4px 10px',
    textTransform: 'capitalize' as const,
  },
  classBadge: {
    fontSize: 12,
    color: '#9ae6b4',
    background: '#0d1117',
    borderRadius: 4,
    padding: '4px 10px',
    textTransform: 'capitalize' as const,
  },
  levelBadge: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#e2b714',
  },
  characterName: {
    margin: 0,
    fontSize: 20,
    color: '#fff',
  },
  backstory: {
    fontSize: 12,
    color: '#667788',
    fontStyle: 'italic',
    margin: 0,
    lineHeight: 1.5,
  },
  noCharacter: {
    textAlign: 'center' as const,
    color: '#667788',
    padding: 20,
  },

  // Stats
  statsContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },
  statRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  statLabel: {
    fontSize: 11,
    color: '#8899aa',
    width: 50,
  },
  barBg: {
    flex: 1,
    height: 8,
    background: '#0d1117',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    transition: 'width 0.3s ease',
  },
  statValue: {
    fontSize: 11,
    color: '#ccddee',
    width: 50,
    textAlign: 'right' as const,
  },

  // Current Action
  currentAction: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    background: '#0d1117',
    borderRadius: 6,
    fontSize: 13,
  },
  actionIcon: {
    fontSize: 16,
  },
  position: {
    marginLeft: 'auto',
    color: '#667788',
    fontSize: 11,
  },

  // Follow Button
  followButton: {
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 'bold',
    background: '#e2b714',
    color: '#0d1117',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    marginTop: 8,
  },

  // Skills
  skillsGrid: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },
  skillItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  skillName: {
    fontSize: 11,
    color: '#8899aa',
    width: 70,
    textTransform: 'capitalize' as const,
  },
  skillBarBg: {
    flex: 1,
    height: 6,
    background: '#0d1117',
    borderRadius: 3,
    overflow: 'hidden',
  },
  skillBarFill: {
    height: '100%',
    background: '#f39c12',
    borderRadius: 3,
    transition: 'width 0.3s ease',
  },
  skillValue: {
    fontSize: 10,
    color: '#667788',
    width: 25,
    textAlign: 'right' as const,
  },

  // Bot Status
  botStatus: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  statusRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 12,
    color: '#8899aa',
  },
  reconnectBox: {
    marginTop: 12,
    padding: 12,
    background: '#0d1117',
    borderRadius: 6,
  },
  reconnectText: {
    fontSize: 11,
    color: '#667788',
    margin: '0 0 8px 0',
  },
  copyButton: {
    width: '100%',
    padding: '8px 12px',
    fontSize: 12,
    background: '#1a2a4a',
    color: '#ccddee',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
  },

  // Activity Log
  filterButtons: {
    display: 'flex',
    gap: 4,
  },
  filterButton: {
    padding: '4px 10px',
    fontSize: 11,
    color: '#ccddee',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    textTransform: 'capitalize' as const,
  },
  activityList: {
    maxHeight: 400,
    overflowY: 'auto' as const,
  },
  activityItem: {
    padding: '8px 0',
    borderBottom: '1px solid #1a2a4a',
    fontSize: 12,
  },
  activityType: {
    color: '#3498db',
    marginRight: 8,
  },
  activityTime: {
    color: '#667788',
    fontSize: 10,
    float: 'right' as const,
  },
  activityData: {
    color: '#8899aa',
    fontSize: 11,
    marginTop: 4,
  },
  emptyText: {
    color: '#556677',
    textAlign: 'center' as const,
    padding: 20,
    fontSize: 13,
  },

  // Memories
  memoriesList: {
    maxHeight: 200,
    overflowY: 'auto' as const,
  },
  memoryItem: {
    padding: '6px 0',
    borderBottom: '1px solid #1a2a4a',
    fontSize: 11,
  },
  memoryType: {
    color: '#9ae6b4',
    marginRight: 8,
  },
  memoryContent: {
    color: '#8899aa',
  },

  // Inventory
  inventoryGrid: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },
  inventoryItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px',
    background: '#0d1117',
    borderRadius: 4,
  },
  itemIcon: {
    fontSize: 16,
  },
  itemInfo: {
    flex: 1,
    display: 'flex',
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 12,
    color: '#ccddee',
  },
  itemQuantity: {
    fontSize: 11,
    color: '#667788',
  },

  // Relationships
  relationshipsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },
  relationshipItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px',
    background: '#0d1117',
    borderRadius: 4,
    fontSize: 12,
  },
  relName: {
    flex: 1,
    color: '#ccddee',
  },
  relCount: {
    color: '#8899aa',
    fontSize: 11,
  },
  relTime: {
    color: '#556677',
    fontSize: 10,
  },

  // Personality
  personalitySection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  traitsRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 6,
  },
  traitChip: {
    fontSize: 10,
    color: '#9ae6b4',
    background: '#0d1117',
    borderRadius: 4,
    padding: '3px 8px',
  },
  valuesList: {
    fontSize: 11,
    color: '#8899aa',
  },
  labelText: {
    color: '#667788',
    marginRight: 4,
  },
  catchphrase: {
    fontSize: 11,
    color: '#667788',
    fontStyle: 'italic',
    margin: '4px 0 0 0',
  },
}
