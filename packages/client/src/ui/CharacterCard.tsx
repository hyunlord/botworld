import { useState, useEffect } from 'react'
import { OV, glassPanel, interactive } from './overlay-styles.js'
import { soundManager } from '../game/audio/sound-manager.js'

interface CharacterCardProps {
  agent: any
  allAgents?: any[]
  onClose: () => void
  onFollow?: (agentId: string) => void
  onNavigate?: (x: number, y: number) => void
  isFollowing?: boolean
  characterData?: {
    appearance?: any
    race?: string
    characterClass?: string
  }
}

type TabType = 'profile' | 'stats' | 'inventory' | 'relationships' | 'history' | 'achievements'

interface Relationship {
  agentId: string
  agentName: string
  sentiment: string
  trust: number
}

interface HistoryEvent {
  day: number
  type: string
  description: string
}

interface Achievement {
  id: string
  name: string
  icon: string
  earnedAt?: string
  description: string
}

export default function CharacterCard({
  agent,
  allAgents = [],
  onClose,
  onFollow,
  onNavigate,
  isFollowing = false,
  characterData,
}: CharacterCardProps) {
  const [isFullProfile, setIsFullProfile] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('profile')
  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [skills, setSkills] = useState<Record<string, any>>({})
  const [history, setHistory] = useState<HistoryEvent[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [historyFilter, setHistoryFilter] = useState<string>('all')

  // Extract character appearance data
  const charData = characterData
  const portraitUrl = charData?.appearance?.portraitUrl || null

  // Defensive: ensure stats exists (avoid TypeError crash)
  const stats = agent?.stats || {} as Record<string, number>
  const safeHp = stats.hp ?? 0
  const safeMaxHp = stats.maxHp ?? 100
  const safeEnergy = stats.energy ?? 0
  const safeMaxEnergy = stats.maxEnergy ?? 100
  const safeHunger = stats.hunger ?? 0
  const safeMaxHunger = stats.maxHunger ?? 100
  const safeMana = stats.mana ?? 0
  const safeMaxMana = stats.maxMana ?? 100

  // If essential agent data is missing, show loading state
  if (!agent?.name) {
    return (
      <div style={{ ...glassPanel, ...interactive, position: 'fixed', right: 16, top: 80, width: 300, padding: 20, zIndex: 500 }}>
        <button style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: OV.textMuted, fontSize: 18, cursor: 'pointer' }} onClick={onClose}>✕</button>
        <div style={{ color: OV.textDim, textAlign: 'center' as const, padding: 20 }}>Loading agent data...</div>
      </div>
    )
  }

  // Helper: get race-based color for portrait fallback
  function getRaceColor(race?: string): string {
    const colors: Record<string, string> = {
      human: '#E8C8A0',
      elf: '#C8E8C0',
      dwarf: '#D4A060',
      orc: '#7CAA6E',
      beastkin: '#D4A373',
      undead: '#A0B8C8',
      fairy: '#E8D0F0',
      dragonkin: '#A08060',
    }
    return colors[race || 'human'] || '#CCCCCC'
  }

  // Helper: get quality color for equipment
  function getQualityColor(quality?: string): string {
    const colors: Record<string, string> = {
      crude: '#888888',
      basic: '#AAAAAA',
      fine: '#44AAFF',
      masterwork: '#FFD700',
      legendary: '#CC44FF',
    }
    return colors[quality || 'basic'] || '#AAAAAA'
  }

  // Helper: get quality label for equipment
  function getQualityLabel(quality?: string): string {
    if (!quality || quality === 'basic') return ''
    return ` [${quality}]`
  }

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

  // Fetch additional data when full profile opens
  useEffect(() => {
    if (!isFullProfile) return

    // Fetch relationships
    fetch(`/api/social/relationships/${agent.id}`)
      .then(res => res.json())
      .then(data => {
        const rels = (data.relationships || []).map((r: any) => ({
          agentId: r.targetId,
          agentName: allAgents.find(a => a.id === r.targetId)?.name || 'Unknown',
          sentiment: r.trust > 0.7 ? 'friend' : r.trust < 0.3 ? 'rival' : 'neutral',
          trust: r.trust,
        }))
        setRelationships(rels)
      })
      .catch(() => setRelationships([]))

    // Fetch skills
    fetch(`/api/skills/${agent.id}`)
      .then(res => res.json())
      .then(data => setSkills(data.skills || agent.skills || {}))
      .catch(() => setSkills(agent.skills || {}))

    // Mock history data (in real app, fetch from /api/agents/${agent.id}/history)
    const mockHistory: HistoryEvent[] = [
      { day: 1, type: 'move', description: 'Arrived at spawn point' },
      { day: 2, type: 'social', description: `Met ${allAgents[0]?.name || 'stranger'}` },
      { day: 3, type: 'craft', description: 'Crafted wooden tools' },
      { day: 4, type: 'combat', description: 'Defeated a wolf' },
      { day: 5, type: 'trade', description: 'Traded at marketplace' },
    ]
    setHistory(mockHistory)

    // Mock achievements
    const mockAchievements: Achievement[] = [
      { id: '1', name: 'First Steps', icon: '👣', earnedAt: 'Day 1', description: 'Took your first steps in the world' },
      { id: '2', name: 'Socialite', icon: '🤝', earnedAt: 'Day 2', description: 'Made your first friend' },
      { id: '3', name: 'Craftsman', icon: '🔨', earnedAt: 'Day 3', description: 'Crafted your first item' },
      { id: '4', name: 'Warrior', icon: '⚔️', description: 'Win 10 combats (0/10)' },
      { id: '5', name: 'Merchant', icon: '💰', description: 'Complete 50 trades (5/50)' },
    ]
    setAchievements(mockAchievements)
  }, [isFullProfile, agent.id, allAgents])

  const handleBackdropClick = () => {
    if (isFullProfile) {
      soundManager.playUIClose()
      setIsFullProfile(false)
    }
  }

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  const handleTabChange = (tab: TabType) => {
    soundManager.playUIClick()
    setActiveTab(tab)
  }

  const handleFollowClick = () => {
    soundManager.playUIClick()
    if (onFollow) onFollow(agent.id)
  }

  const handleFullProfileClick = () => {
    soundManager.playUIClick()
    setIsFullProfile(true)
  }

  const handleStatsClick = () => {
    soundManager.playUIClick()
    setIsFullProfile(true)
    setActiveTab('stats')
  }

  const handleCloseClick = () => {
    soundManager.playUIClose()
    onClose()
  }

  // Compact card mode
  if (!isFullProfile) {
    return (
      <div style={styles.compactCard} onClick={handleCardClick}>
        <button style={styles.closeBtn} onClick={handleCloseClick}>✕</button>

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.avatar}>
            {portraitUrl ? (
              <img
                src={portraitUrl}
                alt={`${agent.name} portrait`}
                style={styles.portrait}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            ) : (
              <div style={{
                ...styles.portraitFallback,
                backgroundColor: getRaceColor(charData?.race),
              }}>
                <span style={styles.portraitInitial}>{agent.name[0]}</span>
              </div>
            )}
          </div>
          <div style={styles.headerInfo}>
            <div style={styles.name}>{agent.name}</div>
            <div style={styles.subtitle}>
              <span style={styles.levelBadge}>Lv.{agent.level}</span>
              <span style={styles.archetypeBadge}>{agent.archetype || 'Wanderer'}</span>
              {charData?.appearance?.gender && (
                <span style={{ color: OV.textMuted, fontSize: 11 }}>
                  {charData.appearance.gender}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stat bars */}
        <div style={styles.statsSection}>
          <StatBar icon="❤️" value={safeHp} max={safeMaxHp} color="#EF4444" />
          <StatBar icon="⚡" value={safeEnergy} max={safeMaxEnergy} color="#FBBF24" />
          <StatBar icon="🍖" value={safeHunger} max={safeMaxHunger} color="#F59E0B" />
          <StatBar icon="✨" value={safeMana} max={safeMaxMana} color="#60A5FA" />
        </div>

        {/* Current thought/mood */}
        {agent.currentThought && (
          <div style={styles.thoughtBubble}>
            💭 "{agent.currentThought.substring(0, 60)}..."
          </div>
        )}

        {/* Equipment summary */}
        <div style={styles.equipmentRow}>
          <span style={styles.equipLabel}>⚔️ Weapon:</span>
          <span style={{
            ...styles.equipValue,
            color: getQualityColor(charData?.appearance?.weaponQuality),
          }}>
            {agent.equipment?.weapon || 'None'}{getQualityLabel(charData?.appearance?.weaponQuality)}
          </span>
        </div>
        <div style={styles.equipmentRow}>
          <span style={styles.equipLabel}>🛡️ Armor:</span>
          <span style={{
            ...styles.equipValue,
            color: getQualityColor(charData?.appearance?.armorQuality),
          }}>
            {agent.equipment?.armor || 'None'}{getQualityLabel(charData?.appearance?.armorQuality)}
          </span>
        </div>

        {/* Affiliations */}
        <div style={styles.affiliationsRow}>
          {agent.settlement && <span style={styles.affBadge}>🏘️ {agent.settlement}</span>}
          {agent.guild && <span style={styles.affBadge}>⚔️ {agent.guild}</span>}
          {agent.kingdom && <span style={styles.affBadge}>👑 {agent.kingdom}</span>}
        </div>

        {/* Skills summary */}
        <div style={styles.skillsSummary}>
          {renderSkillRating('Combat', (agent.skills as any)?.combat || 0)}
          {renderSkillRating('Crafting', (agent.skills as any)?.crafting || 0)}
          {renderSkillRating('Magic', (agent.skills as any)?.magic || 0)}
          {renderSkillRating('Social', (agent.skills as any)?.diplomacy || 0)}
          {renderSkillRating('Survival', (agent.skills as any)?.survival || 0)}
        </div>

        {/* Action buttons */}
        <div style={styles.actions}>
          <button
            onClick={handleFollowClick}
            style={{
              ...styles.actionBtn,
              background: isFollowing ? OV.hp : 'rgba(255,255,255,0.1)',
            }}
          >
            {isFollowing ? '📍 Following' : '📍 Follow'}
          </button>
          <button onClick={handleFullProfileClick} style={styles.actionBtn}>
            🔍 Full Profile
          </button>
          <button onClick={handleStatsClick} style={styles.actionBtn}>
            📊 Stats
          </button>
        </div>
      </div>
    )
  }

  // Full profile modal mode
  return (
    <div style={styles.backdrop} onClick={handleBackdropClick}>
      <div style={{ ...glassPanel, ...interactive, ...styles.modal }} onClick={handleCardClick}>
        <button style={styles.closeBtn} onClick={handleCloseClick}>✕</button>

        {/* Header */}
        <div style={styles.modalHeader}>
          <div style={styles.avatar}>
            {portraitUrl ? (
              <img
                src={portraitUrl}
                alt={`${agent.name} portrait`}
                style={styles.portrait}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            ) : (
              <div style={{
                ...styles.portraitFallback,
                backgroundColor: getRaceColor(charData?.race),
              }}>
                <span style={styles.portraitInitial}>{agent.name[0]}</span>
              </div>
            )}
          </div>
          <div style={styles.headerInfo}>
            <div style={styles.modalName}>{agent.name}</div>
            <div style={styles.subtitle}>
              <span style={styles.levelBadge}>Lv.{agent.level}</span>
              <span style={styles.archetypeBadge}>{agent.archetype || 'Wanderer'}</span>
              {charData?.appearance?.gender && (
                <span style={{ color: OV.textMuted, fontSize: 11 }}>
                  {charData.appearance.gender}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div style={styles.tabBar}>
          {(['profile', 'stats', 'inventory', 'relationships', 'history', 'achievements'] as TabType[]).map(tab => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              style={{
                ...styles.tab,
                ...(activeTab === tab ? styles.tabActive : {}),
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={styles.tabContent}>
          {activeTab === 'profile' && <ProfileTab agent={agent} />}
          {activeTab === 'stats' && <StatsTab agent={agent} skills={skills} />}
          {activeTab === 'inventory' && <InventoryTab agent={agent} />}
          {activeTab === 'relationships' && <RelationshipsTab relationships={relationships} />}
          {activeTab === 'history' && (
            <HistoryTab
              history={history}
              filter={historyFilter}
              onFilterChange={setHistoryFilter}
            />
          )}
          {activeTab === 'achievements' && <AchievementsTab achievements={achievements} />}
        </div>
      </div>
    </div>
  )
}

// Helper: render skill rating as stars
function renderSkillRating(name: string, value: number) {
  const stars = Math.min(5, Math.floor(value / 20))
  const starStr = '★'.repeat(stars) + '☆'.repeat(5 - stars)
  return (
    <div style={styles.skillRatingRow} key={name}>
      <span style={styles.skillRatingName}>{name}</span>
      <span style={styles.skillRatingStars}>{starStr}</span>
    </div>
  )
}

// StatBar component
function StatBar({ icon, value, max, color }: {
  icon: string
  value: number
  max: number
  color: string
}) {
  const safeMax = max || 1
  const pct = Math.min(100, Math.round(((value || 0) / safeMax) * 100))
  return (
    <div style={styles.statRow}>
      <span style={styles.statIcon}>{icon}</span>
      <div style={styles.barBg}>
        <div style={{ ...styles.barFill, width: `${pct}%`, background: color }} />
      </div>
      <span style={styles.statNum}>{Math.round(value)}/{max}</span>
    </div>
  )
}

// Tab: Profile
function ProfileTab({ agent }: { agent: any }) {
  return (
    <div style={styles.tabSection}>
      <div style={styles.bioRow}>
        <span style={styles.label}>Bio:</span>
        <span style={styles.value}>{agent.bio || 'No bio available'}</span>
      </div>

      <div style={styles.bioRow}>
        <span style={styles.label}>Personality:</span>
        <div style={styles.personalityChips}>
          {agent.personality && Object.entries(agent.personality).slice(0, 5).map(([trait, val]: [string, any]) => (
            <span key={trait} style={styles.personalityChip}>
              {trait.charAt(0).toUpperCase()}: {Math.round(val * 100)}
            </span>
          ))}
        </div>
      </div>

      <div style={styles.bioRow}>
        <span style={styles.label}>Current Goal:</span>
        <span style={styles.value}>{agent.currentGoal || agent.currentAction?.type || 'Idle'}</span>
      </div>

      <div style={styles.bioRow}>
        <span style={styles.label}>Settlement:</span>
        <span style={styles.value}>{agent.settlement || 'None'}</span>
      </div>

      <div style={styles.bioRow}>
        <span style={styles.label}>Guild:</span>
        <span style={styles.value}>{agent.guild || 'None'}</span>
      </div>

      <div style={styles.bioRow}>
        <span style={styles.label}>Kingdom:</span>
        <span style={styles.value}>{agent.kingdom || 'None'}</span>
      </div>

      <div style={styles.bioRow}>
        <span style={styles.label}>Title:</span>
        <span style={styles.value}>{agent.title || 'Wanderer'}</span>
      </div>
    </div>
  )
}

// Tab: Stats & Skills
function StatsTab({ agent, skills }: { agent: any; skills: Record<string, any> }) {
  const allSkills = { ...(agent.skills || {}), ...skills }
  const st = agent?.stats || {} as Record<string, number>
  const skillCategories = {
    Combat: ['combat', 'melee', 'ranged', 'defense'],
    Crafting: ['crafting', 'smithing', 'alchemy', 'cooking'],
    Magic: ['magic', 'spellcasting', 'enchanting'],
    Social: ['diplomacy', 'persuasion', 'leadership', 'trading'],
    Survival: ['survival', 'gathering', 'exploration', 'hunting'],
  }

  return (
    <div style={styles.tabSection}>
      {/* Full stat bars */}
      <div style={styles.statsSection}>
        <StatBar icon="❤️" value={st.hp ?? 0} max={st.maxHp ?? 100} color="#EF4444" />
        <StatBar icon="⚡" value={st.energy ?? 0} max={st.maxEnergy ?? 100} color="#FBBF24" />
        <StatBar icon="🍖" value={st.hunger ?? 0} max={st.maxHunger ?? 100} color="#F59E0B" />
        <StatBar icon="✨" value={st.mana ?? 0} max={st.maxMana ?? 100} color="#60A5FA" />
        <StatBar icon="⚔️" value={st.attack ?? 10} max={100} color="#F87171" />
        <StatBar icon="🛡️" value={st.defense ?? 10} max={100} color="#A78BFA" />
      </div>

      {/* Skills by category */}
      <div style={styles.skillsHeader}>Skills</div>
      {Object.entries(skillCategories).map(([category, skillNames]) => {
        const categorySkills = skillNames
          .map(name => ({ name, value: allSkills[name] || 0 }))
          .filter(s => s.value > 0)

        if (categorySkills.length === 0) return null

        return (
          <div key={category} style={styles.skillCategory}>
            <div style={styles.skillCategoryName}>{category}</div>
            {categorySkills.map(skill => (
              <div key={skill.name} style={styles.skillDetailRow}>
                <span style={styles.skillDetailName}>{skill.name}</span>
                <span style={styles.skillDetailLevel}>{Math.round(skill.value)}</span>
                <div style={styles.skillProgressBg}>
                  <div
                    style={{
                      ...styles.skillProgressFill,
                      width: `${Math.min(100, skill.value)}%`,
                    }}
                  />
                </div>
                <span style={styles.skillDetailProgress}>{Math.round(skill.value)}/100</span>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// Tab: Inventory
function InventoryTab({ agent }: { agent: any }) {
  const equipment = agent.equipment || {}
  const inventory = agent.inventory || []
  const gold = agent.gold || 0

  return (
    <div style={styles.tabSection}>
      {/* Equipment slots */}
      <div style={styles.sectionHeader}>Equipment</div>
      <div style={styles.equipmentGrid}>
        <EquipmentSlot label="Weapon" item={equipment.weapon} />
        <EquipmentSlot label="Armor" item={equipment.armor} />
        <EquipmentSlot label="Helmet" item={equipment.helmet} />
        <EquipmentSlot label="Boots" item={equipment.boots} />
        <EquipmentSlot label="Accessory" item={equipment.accessory} />
      </div>

      {/* Bag items */}
      <div style={styles.sectionHeader}>Bag ({inventory.length} items)</div>
      <div style={styles.inventoryList}>
        {inventory.length === 0 ? (
          <div style={styles.emptyText}>No items in bag</div>
        ) : (
          inventory.map((item: any, idx: number) => (
            <div key={idx} style={styles.inventoryItem}>
              <span style={styles.itemName}>{item.name}</span>
              <span style={styles.itemQuantity}>x{item.quantity || 1}</span>
            </div>
          ))
        )}
      </div>

      {/* Gold */}
      <div style={styles.goldRow}>
        <span style={styles.goldLabel}>💰 Total Gold:</span>
        <span style={styles.goldValue}>{gold}</span>
      </div>
    </div>
  )
}

function EquipmentSlot({ label, item }: { label: string; item?: string }) {
  return (
    <div style={styles.equipSlot}>
      <div style={styles.equipSlotLabel}>{label}</div>
      <div style={styles.equipSlotValue}>{item || 'Empty'}</div>
    </div>
  )
}

// Tab: Relationships
function RelationshipsTab({ relationships }: { relationships: Relationship[] }) {
  const sorted = [...relationships].sort((a, b) => b.trust - a.trust)

  return (
    <div style={styles.tabSection}>
      <div style={styles.sectionHeader}>Known Relationships ({relationships.length})</div>
      {sorted.length === 0 ? (
        <div style={styles.emptyText}>No relationships yet</div>
      ) : (
        sorted.map(rel => (
          <div key={rel.agentId} style={styles.relationshipRow}>
            <span style={styles.relationshipName}>{rel.agentName}</span>
            <span
              style={{
                ...styles.sentimentTag,
                background:
                  rel.sentiment === 'friend'
                    ? 'rgba(74, 222, 128, 0.2)'
                    : rel.sentiment === 'rival'
                    ? 'rgba(248, 113, 113, 0.2)'
                    : 'rgba(160, 168, 184, 0.2)',
                color:
                  rel.sentiment === 'friend'
                    ? '#4ADE80'
                    : rel.sentiment === 'rival'
                    ? '#F87171'
                    : '#A0A8B8',
              }}
            >
              {rel.sentiment}
            </span>
            <div style={styles.trustBarBg}>
              <div
                style={{
                  ...styles.trustBarFill,
                  width: `${Math.round(rel.trust * 100)}%`,
                }}
              />
            </div>
            <span style={styles.trustValue}>{Math.round(rel.trust * 100)}%</span>
          </div>
        ))
      )}
    </div>
  )
}

// Tab: History
function HistoryTab({
  history,
  filter,
  onFilterChange,
}: {
  history: HistoryEvent[]
  filter: string
  onFilterChange: (f: string) => void
}) {
  const filtered = filter === 'all' ? history : history.filter(e => e.type === filter)
  const types = ['all', 'combat', 'trade', 'social', 'craft', 'move']

  return (
    <div style={styles.tabSection}>
      <div style={styles.filterRow}>
        {types.map(type => (
          <button
            key={type}
            onClick={() => onFilterChange(type)}
            style={{
              ...styles.filterBtn,
              ...(filter === type ? styles.filterBtnActive : {}),
            }}
          >
            {type}
          </button>
        ))}
      </div>

      <div style={styles.historyList}>
        {filtered.length === 0 ? (
          <div style={styles.emptyText}>No events</div>
        ) : (
          filtered.map((event, idx) => (
            <div key={idx} style={styles.historyEvent}>
              <span style={styles.historyDay}>Day {event.day}</span>
              <span style={styles.historyType}>
                {event.type === 'combat' && '⚔️'}
                {event.type === 'trade' && '💰'}
                {event.type === 'social' && '🤝'}
                {event.type === 'craft' && '🔨'}
                {event.type === 'move' && '🚶'}
              </span>
              <span style={styles.historyDesc}>{event.description}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// Tab: Achievements
function AchievementsTab({ achievements }: { achievements: Achievement[] }) {
  const earned = achievements.filter(a => a.earnedAt)
  const unearned = achievements.filter(a => !a.earnedAt)

  return (
    <div style={styles.tabSection}>
      <div style={styles.sectionHeader}>Earned ({earned.length})</div>
      {earned.map(ach => (
        <div key={ach.id} style={styles.achievementRow}>
          <span style={styles.achIcon}>{ach.icon}</span>
          <div style={styles.achInfo}>
            <div style={styles.achName}>{ach.name}</div>
            <div style={styles.achDesc}>{ach.description}</div>
          </div>
          <span style={styles.achDate}>{ach.earnedAt}</span>
        </div>
      ))}

      <div style={styles.sectionHeader}>Locked ({unearned.length})</div>
      {unearned.map(ach => (
        <div key={ach.id} style={{ ...styles.achievementRow, opacity: 0.4 }}>
          <span style={styles.achIcon}>{ach.icon}</span>
          <div style={styles.achInfo}>
            <div style={styles.achName}>{ach.name}</div>
            <div style={styles.achDesc}>{ach.description}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Styles
const styles: Record<string, React.CSSProperties> = {
  // Compact card
  compactCard: {
    ...glassPanel,
    ...interactive,
    position: 'fixed',
    right: 16,
    top: 80,
    width: 400,
    maxHeight: 'calc(100vh - 100px)',
    overflowY: 'auto',
    padding: 16,
    zIndex: 500,
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    animation: 'fadeSlideIn 0.2s ease-out',
  },

  // Full profile backdrop & modal
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(4px)',
    animation: 'fadeSlideIn 0.2s ease-out',
  },
  modal: {
    width: 700,
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: 24,
    position: 'relative',
    boxShadow: '0 12px 48px rgba(0,0,0,0.7)',
    background: 'rgba(15,20,35,0.92)',
    backdropFilter: 'blur(12px)',
  },

  // Close button
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    background: 'none',
    border: 'none',
    color: OV.textMuted,
    fontSize: 18,
    cursor: 'pointer',
    padding: '4px 8px',
    lineHeight: 1,
    transition: 'color 0.15s',
  },

  // Header
  header: {
    display: 'flex',
    gap: 12,
    marginBottom: 16,
  },
  modalHeader: {
    display: 'flex',
    gap: 16,
    marginBottom: 20,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 8,
    background: 'rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  avatarEmoji: {
    fontSize: 32,
  },
  portrait: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    borderRadius: 8,
  },
  portraitFallback: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  portraitInitial: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  headerInfo: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 6,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: OV.accent,
  },
  modalName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: OV.accent,
  },
  subtitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap' as const,
  },
  levelBadge: {
    fontSize: 11,
    color: OV.accent,
    background: 'rgba(255,215,0,0.15)',
    borderRadius: 4,
    padding: '2px 8px',
    fontWeight: 'bold',
  },
  archetypeBadge: {
    fontSize: 11,
    color: OV.green,
    background: 'rgba(74, 222, 128, 0.15)',
    borderRadius: 4,
    padding: '2px 8px',
  },

  // Stats
  statsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginBottom: 12,
  },
  statRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  statIcon: {
    fontSize: 14,
    width: 20,
    textAlign: 'center' as const,
  },
  barBg: {
    flex: 1,
    height: 12,
    background: 'rgba(255,255,255,0.08)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
    transition: 'width 0.3s ease',
  },
  statNum: {
    fontSize: 11,
    color: OV.text,
    minWidth: 60,
    textAlign: 'right' as const,
  },

  // Thought bubble
  thoughtBubble: {
    fontSize: 11,
    color: OV.textDim,
    fontStyle: 'italic',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: OV.radiusSm,
    padding: '8px 10px',
    marginBottom: 10,
    lineHeight: 1.4,
  },

  // Equipment
  equipmentRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 11,
    marginBottom: 4,
  },
  equipLabel: {
    color: OV.textMuted,
  },
  equipValue: {
    color: OV.text,
    fontWeight: 'bold',
  },

  // Affiliations
  affiliationsRow: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap' as const,
    marginTop: 10,
    marginBottom: 10,
  },
  affBadge: {
    fontSize: 10,
    color: OV.text,
    background: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    padding: '3px 8px',
  },

  // Skills summary
  skillsSummary: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginBottom: 12,
    padding: '10px 0',
    borderTop: `1px solid ${OV.border}`,
    borderBottom: `1px solid ${OV.border}`,
  },
  skillRatingRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 11,
  },
  skillRatingName: {
    color: OV.textDim,
  },
  skillRatingStars: {
    color: OV.accent,
    letterSpacing: 2,
  },

  // Actions
  actions: {
    display: 'flex',
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: OV.radiusSm,
    padding: '8px 0',
    fontSize: 12,
    fontWeight: 'bold',
    color: OV.text,
    cursor: 'pointer',
    fontFamily: OV.font,
    background: 'rgba(255,255,255,0.1)',
    transition: 'background 0.15s, transform 0.1s',
  },

  // Tabs
  tabBar: {
    display: 'flex',
    gap: 8,
    marginBottom: 20,
    borderBottom: `1px solid ${OV.border}`,
    paddingBottom: 8,
  },
  tab: {
    background: 'none',
    border: 'none',
    color: OV.textDim,
    fontSize: 13,
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: OV.font,
    padding: '6px 12px',
    borderRadius: OV.radiusSm,
    transition: 'all 0.15s',
  },
  tabActive: {
    color: OV.accent,
    background: 'rgba(255,215,0,0.15)',
  },

  // Tab content
  tabContent: {
    minHeight: 300,
  },
  tabSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },

  // Profile tab
  bioRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  label: {
    fontSize: 11,
    color: OV.textMuted,
    fontWeight: '600',
  },
  value: {
    fontSize: 13,
    color: OV.text,
    lineHeight: 1.5,
  },
  personalityChips: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap' as const,
  },
  personalityChip: {
    fontSize: 10,
    color: OV.green,
    background: 'rgba(74, 222, 128, 0.15)',
    borderRadius: 4,
    padding: '3px 8px',
  },

  // Stats tab
  skillsHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: OV.accent,
    marginTop: 12,
    marginBottom: 8,
  },
  skillCategory: {
    marginBottom: 12,
  },
  skillCategoryName: {
    fontSize: 12,
    fontWeight: '600',
    color: OV.text,
    marginBottom: 6,
  },
  skillDetailRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  skillDetailName: {
    fontSize: 11,
    color: OV.textDim,
    width: 100,
    textTransform: 'capitalize' as const,
  },
  skillDetailLevel: {
    fontSize: 11,
    color: OV.text,
    fontWeight: 'bold',
    width: 30,
  },
  skillProgressBg: {
    flex: 1,
    height: 8,
    background: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  skillProgressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #FFD700, #FFA500)',
    borderRadius: 4,
    transition: 'width 0.3s ease',
  },
  skillDetailProgress: {
    fontSize: 10,
    color: OV.textMuted,
    width: 50,
    textAlign: 'right' as const,
  },

  // Inventory tab
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: OV.accent,
    marginTop: 8,
    marginBottom: 8,
  },
  equipmentGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
    marginBottom: 16,
  },
  equipSlot: {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: OV.radiusSm,
    padding: 10,
  },
  equipSlotLabel: {
    fontSize: 10,
    color: OV.textMuted,
    marginBottom: 4,
  },
  equipSlotValue: {
    fontSize: 12,
    color: OV.text,
    fontWeight: 'bold',
  },
  inventoryList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginBottom: 12,
  },
  inventoryItem: {
    display: 'flex',
    justifyContent: 'space-between',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 4,
    padding: '6px 10px',
    fontSize: 11,
  },
  itemName: {
    color: OV.text,
  },
  itemQuantity: {
    color: OV.textDim,
  },
  goldRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '10px 0',
    borderTop: `1px solid ${OV.border}`,
    marginTop: 8,
  },
  goldLabel: {
    fontSize: 13,
    color: OV.accent,
    fontWeight: 'bold',
  },
  goldValue: {
    fontSize: 13,
    color: OV.accent,
    fontWeight: 'bold',
  },

  // Relationships tab
  relationshipRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 10px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: OV.radiusSm,
    marginBottom: 4,
  },
  relationshipName: {
    fontSize: 12,
    color: OV.text,
    fontWeight: 'bold',
    width: 120,
  },
  sentimentTag: {
    fontSize: 10,
    borderRadius: 4,
    padding: '2px 8px',
    textTransform: 'capitalize' as const,
  },
  trustBarBg: {
    flex: 1,
    height: 8,
    background: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  trustBarFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #4ADE80, #22C55E)',
    borderRadius: 4,
    transition: 'width 0.3s ease',
  },
  trustValue: {
    fontSize: 10,
    color: OV.textMuted,
    width: 40,
    textAlign: 'right' as const,
  },

  // History tab
  filterRow: {
    display: 'flex',
    gap: 6,
    marginBottom: 12,
    flexWrap: 'wrap' as const,
  },
  filterBtn: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 4,
    padding: '4px 10px',
    fontSize: 10,
    color: OV.textDim,
    cursor: 'pointer',
    fontFamily: OV.font,
    textTransform: 'capitalize' as const,
    transition: 'all 0.15s',
  },
  filterBtnActive: {
    background: 'rgba(255,215,0,0.15)',
    borderColor: 'rgba(255,215,0,0.3)',
    color: OV.accent,
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  historyEvent: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 10px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: OV.radiusSm,
    fontSize: 11,
  },
  historyDay: {
    color: OV.accent,
    fontWeight: 'bold',
    width: 60,
  },
  historyType: {
    fontSize: 14,
    width: 24,
    textAlign: 'center' as const,
  },
  historyDesc: {
    color: OV.textDim,
    flex: 1,
  },

  // Achievements tab
  achievementRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: OV.radiusSm,
    marginBottom: 6,
  },
  achIcon: {
    fontSize: 28,
  },
  achInfo: {
    flex: 1,
  },
  achName: {
    fontSize: 13,
    color: OV.text,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  achDesc: {
    fontSize: 10,
    color: OV.textDim,
  },
  achDate: {
    fontSize: 10,
    color: OV.accent,
  },

  // Empty state
  emptyText: {
    fontSize: 12,
    color: OV.textMuted,
    textAlign: 'center' as const,
    padding: 20,
    fontStyle: 'italic',
  },
}
