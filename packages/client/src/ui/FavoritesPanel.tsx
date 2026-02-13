import { useState, useEffect } from 'react'
import { OV, glassPanel, interactive } from './overlay-styles.js'
import { soundManager } from '../game/audio/sound-manager.js'

interface FavoritesPanelProps {
  agents: any[]
  onNavigate?: (x: number, y: number) => void
  onSelectAgent?: (agentId: string) => void
}

const MAX_FAVORITES = 20
const STORAGE_KEY = 'botworld_favorites'

export function FavoritesPanel({ agents, onNavigate, onSelectAgent }: FavoritesPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    } catch {
      return []
    }
  })
  const [searchText, setSearchText] = useState('')

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites))
  }, [favorites])

  const addFavorite = (agentId: string) => {
    if (favorites.includes(agentId)) return
    if (favorites.length >= MAX_FAVORITES) return
    soundManager.playUIClick()
    setFavorites(prev => [...prev, agentId])
    setSearchText('')
  }

  const removeFavorite = (agentId: string) => {
    soundManager.playUIClick()
    setFavorites(prev => prev.filter(id => id !== agentId))
  }

  const handleNavigateToAgent = (agent: any) => {
    soundManager.playUIClick()
    if (onNavigate && agent.position) {
      onNavigate(agent.position.x, agent.position.y)
    }
    if (onSelectAgent) {
      onSelectAgent(agent.id)
    }
  }

  // Filter agents by search text
  const searchResults = searchText.trim()
    ? agents
        .filter(a => a.name.toLowerCase().includes(searchText.toLowerCase()))
        .filter(a => !favorites.includes(a.id))
        .slice(0, 5)
    : []

  // Get favorite agents with current data
  const favoriteAgents = favorites
    .map(id => agents.find(a => a.id === id))
    .filter((a): a is any => a !== undefined)

  // Collapsed button
  if (!isOpen) {
    return (
      <div style={styles.wrapper}>
        <button
          style={{ ...glassPanel, ...interactive, ...styles.toggleBtn }}
          onClick={() => {
            soundManager.playUIOpen()
            setIsOpen(true)
          }}
          title="Favorites"
        >
          <span style={styles.toggleIcon}>⭐</span>
          {favoriteAgents.length > 0 && (
            <span style={styles.badge}>{favoriteAgents.length}</span>
          )}
        </button>
      </div>
    )
  }

  // Expanded panel
  return (
    <div style={styles.wrapper}>
      <div style={{ ...glassPanel, ...interactive, ...styles.panel }}>
        <div style={styles.header}>
          <span style={styles.headerTitle}>⭐ Favorites</span>
          <button
            style={styles.collapseBtn}
            onClick={() => {
              soundManager.playUIClose()
              setIsOpen(false)
            }}
          >
            ✕
          </button>
        </div>

        {/* Add favorite section */}
        <div style={styles.addSection}>
          <input
            type="text"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Add agent..."
            style={styles.searchInput}
            disabled={favorites.length >= MAX_FAVORITES}
          />
          {searchResults.length > 0 && (
            <div style={styles.searchResults}>
              {searchResults.map(agent => (
                <div
                  key={agent.id}
                  style={styles.searchResult}
                  onClick={() => addFavorite(agent.id)}
                >
                  <span style={styles.searchResultName}>{agent.name}</span>
                  <span style={styles.searchResultLevel}>Lv{agent.level}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Favorites list */}
        <div style={styles.favoritesList}>
          {favoriteAgents.length === 0 && (
            <div style={styles.empty}>No favorites yet</div>
          )}
          {favoriteAgents.map(agent => {
            const hpRatio = agent.stats.hp / agent.stats.maxHp
            const actionIcon = getActionIcon(agent.currentAction)

            return (
              <div key={agent.id} style={styles.favoriteEntry}>
                <div
                  style={styles.favoriteMain}
                  onClick={() => handleNavigateToAgent(agent)}
                >
                  <div style={styles.favoriteInfo}>
                    <span style={styles.favoriteName}>{agent.name}</span>
                    <div style={styles.favoriteStats}>
                      <div style={styles.hpBarContainer}>
                        <div
                          style={{
                            ...styles.hpBar,
                            width: `${hpRatio * 100}%`,
                            background: hpRatio > 0.5 ? '#4ADE80' : hpRatio > 0.25 ? '#F59E0B' : '#F87171',
                          }}
                        />
                      </div>
                      <span style={styles.actionIcon} title={agent.currentAction}>
                        {actionIcon}
                      </span>
                    </div>
                  </div>
                  {agent.position && (
                    <span style={styles.position}>
                      ({agent.position.x}, {agent.position.y})
                    </span>
                  )}
                </div>
                <button
                  style={styles.removeBtn}
                  onClick={() => removeFavorite(agent.id)}
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>

        {favorites.length >= MAX_FAVORITES && (
          <div style={styles.maxWarning}>Max {MAX_FAVORITES} favorites</div>
        )}
      </div>
    </div>
  )
}

function getActionIcon(action: string): string {
  if (!action) return '💤'
  if (action.includes('gather')) return '🎒'
  if (action.includes('craft')) return '🔨'
  if (action.includes('trade')) return '🤝'
  if (action.includes('combat')) return '⚔️'
  if (action.includes('talk') || action.includes('chat')) return '💬'
  if (action.includes('move') || action.includes('walk')) return '🚶'
  if (action.includes('rest') || action.includes('sleep')) return '💤'
  return '•'
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: 'absolute',
    top: 40,
    left: 12,
    zIndex: 300,
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
  },
  toggleIcon: {
    fontSize: 20,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    background: OV.accent,
    color: OV.bgSolid,
    fontSize: 9,
    fontWeight: 'bold',
    borderRadius: 10,
    padding: '1px 5px',
    minWidth: 16,
    textAlign: 'center' as const,
  },
  panel: {
    width: 220,
    padding: 10,
    animation: 'fadeSlideIn 0.2s ease-out',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: OV.text,
  },
  collapseBtn: {
    background: 'none',
    border: 'none',
    color: OV.textMuted,
    fontSize: 14,
    cursor: 'pointer',
    padding: '0 4px',
  },
  addSection: {
    position: 'relative' as const,
    marginBottom: 8,
  },
  searchInput: {
    width: '100%',
    padding: '6px 8px',
    fontSize: 11,
    background: 'rgba(255, 255, 255, 0.05)',
    border: `1px solid ${OV.border}`,
    borderRadius: 6,
    color: OV.text,
    fontFamily: OV.font,
    outline: 'none',
  },
  searchResults: {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    background: OV.bg,
    border: `1px solid ${OV.border}`,
    borderRadius: 6,
    maxHeight: 120,
    overflowY: 'auto' as const,
    zIndex: 10,
  },
  searchResult: {
    padding: '6px 8px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 11,
    borderBottom: `1px solid ${OV.border}`,
  },
  searchResultName: {
    color: OV.text,
  },
  searchResultLevel: {
    color: OV.textMuted,
    fontSize: 10,
  },
  favoritesList: {
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
    padding: 12,
  },
  favoriteEntry: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 6px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 6,
    border: `1px solid ${OV.border}`,
  },
  favoriteMain: {
    flex: 1,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
  },
  favoriteInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  favoriteName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: OV.accent,
  },
  favoriteStats: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  hpBarContainer: {
    width: 40,
    height: 4,
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
  },
  hpBar: {
    height: '100%',
    borderRadius: 2,
    transition: 'width 0.3s, background 0.3s',
  },
  actionIcon: {
    fontSize: 10,
  },
  position: {
    fontSize: 9,
    color: OV.textMuted,
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: OV.textMuted,
    fontSize: 12,
    cursor: 'pointer',
    padding: '0 4px',
    flexShrink: 0,
  },
  maxWarning: {
    fontSize: 9,
    color: OV.textMuted,
    textAlign: 'center' as const,
    marginTop: 4,
    fontStyle: 'italic',
  },
}
