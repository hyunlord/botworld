import { useState } from 'react'
import type { Agent, CharacterAppearance, CharacterClass, Race } from '@botworld/shared'
import { getCompoundEmotions } from '@botworld/shared'
import { OV, glassPanel, interactive } from './overlay-styles.js'
import { RACE_ICONS, CLASS_ICONS, ACTION_ICONS } from './constants.js'

interface CharacterData {
  appearance: CharacterAppearance
  race: Race
  characterClass?: CharacterClass
  persona_reasoning?: string
  spriteHash: string
}

const EMOTION_EMOJI: Record<string, string> = {
  joy: '\uD83D\uDE0A', trust: '\uD83E\uDD1D', fear: '\uD83D\uDE28', surprise: '\uD83D\uDE32',
  sadness: '\uD83D\uDE22', disgust: '\uD83E\uDD22', anger: '\uD83D\uDE21', anticipation: '\uD83E\uDD14',
}

interface CharacterCardProps {
  agent: Agent
  characterData?: CharacterData
  onFollow: (agentId: string) => void
  onUnfollow: () => void
  isFollowing: boolean
  recentChat?: string[]
  onClose: () => void
}

export function CharacterCard({
  agent, characterData, onFollow, onUnfollow, isFollowing, recentChat, onClose,
}: CharacterCardProps) {
  const [showDetails, setShowDetails] = useState(false)

  const compound = getCompoundEmotions(agent.currentMood)
  const dominantEmotion = Object.entries(agent.currentMood)
    .filter(([, v]) => v > 0.1)
    .sort(([, a], [, b]) => b - a)[0]

  const dominantCompound = Object.entries(compound)
    .filter(([, v]) => v > 0.1)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)

  const topSkills = Object.entries(agent.skills)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)

  const SKILL_ICONS: Record<string, string> = {
    combat: '\u2694\uFE0F', crafting: '\uD83D\uDD28', diplomacy: '\uD83D\uDCD6',
    gathering: '\uD83C\uDF3F', exploration: '\uD83E\uDDED', trading: '\uD83E\uDD1D',
    magic: '\u2728', survival: '\uD83C\uDFD5\uFE0F',
  }

  const lastChat = recentChat?.slice(-1)[0]

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={{ ...glassPanel, ...interactive, ...styles.card }} onClick={e => e.stopPropagation()}>
        {/* Close button */}
        <button style={styles.closeBtn} onClick={onClose}>\u2715</button>

        {/* Header: avatar area + name */}
        <div style={styles.header}>
          <div style={styles.avatar}>
            {characterData && (
              <span style={styles.avatarEmoji}>
                {RACE_ICONS[characterData.race] ?? '\uD83E\uDDD1'}
              </span>
            )}
          </div>
          <div style={styles.headerInfo}>
            <div style={styles.name}>{agent.name}</div>
            <div style={styles.subtitle}>
              {characterData?.characterClass && (
                <span style={styles.classBadge}>
                  {CLASS_ICONS[characterData.characterClass] ?? ''} {characterData.characterClass}
                </span>
              )}
              <span style={styles.levelBadge}>Lv.{agent.level}</span>
              <span style={styles.actionText}>
                {ACTION_ICONS[agent.currentAction?.type ?? 'idle'] ?? ''} {agent.currentAction?.type ?? 'idle'}
              </span>
            </div>
          </div>
        </div>

        {/* Stat bars */}
        <div style={styles.statsSection}>
          <StatBar icon="\u2764\uFE0F" value={agent.stats.hp} max={agent.stats.maxHp} color={OV.hp} />
          <StatBar icon="\u26A1" value={agent.stats.energy} max={agent.stats.maxEnergy} color={OV.energy} />
          <StatBar icon="\uD83C\uDF56" value={agent.stats.hunger} max={agent.stats.maxHunger} color={OV.hunger} />
        </div>

        {/* Skills grid */}
        {topSkills.length > 0 && (
          <div style={styles.skillsGrid}>
            {topSkills.map(([name, value]) => (
              <div key={name} style={styles.skillItem}>
                <span style={styles.skillIcon}>{SKILL_ICONS[name] ?? '\uD83D\uDCA0'}</span>
                <span style={styles.skillName}>{name}</span>
                <span style={styles.skillValue}>{Math.round(value)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Emotion */}
        <div style={styles.emotionRow}>
          {dominantEmotion ? (
            <span style={styles.emotionText}>
              {EMOTION_EMOJI[dominantEmotion[0]] ?? '\uD83D\uDE10'} {dominantEmotion[0]} ({(dominantEmotion[1] as number * 100).toFixed(0)}%)
            </span>
          ) : (
            <span style={styles.emotionText}>\uD83D\uDE10 Neutral</span>
          )}
          {dominantCompound.length > 0 && (
            <span style={styles.compoundText}>
              {dominantCompound.map(([n]) => n).join(', ')}
            </span>
          )}
        </div>

        {/* Recent chat */}
        {lastChat && (
          <div style={styles.chatBubble}>
            \uD83D\uDCAC "{lastChat}"
          </div>
        )}

        {/* Action buttons */}
        <div style={styles.actions}>
          <button
            onClick={() => isFollowing ? onUnfollow() : onFollow(agent.id)}
            style={{
              ...styles.actionBtn,
              background: isFollowing ? OV.hp : 'rgba(255,255,255,0.1)',
            }}
          >
            {isFollowing ? '\uD83D\uDCCD Unfollow' : '\uD83D\uDCCD Follow'}
          </button>
          <button
            onClick={() => setShowDetails(!showDetails)}
            style={{ ...styles.actionBtn, background: 'rgba(255,255,255,0.1)' }}
          >
            {showDetails ? '\u25B2 Less' : '\uD83D\uDD0D Details'}
          </button>
        </div>

        {/* Expanded details */}
        {showDetails && (
          <div style={styles.details}>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Position</span>
              <span style={styles.detailValue}>({agent.position.x}, {agent.position.y})</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>XP</span>
              <span style={styles.detailValue}>{agent.xp}</span>
            </div>
            {agent.llmConfig && (
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>LLM</span>
                <span style={styles.detailValue}>{agent.llmConfig.provider}{agent.llmConfig.model ? ` (${agent.llmConfig.model})` : ''}</span>
              </div>
            )}
            {characterData?.appearance && (
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Armor</span>
                <span style={styles.detailValue}>{characterData.appearance.armor}</span>
              </div>
            )}
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Bio</span>
              <span style={styles.detailValueBio}>{agent.bio}</span>
            </div>

            {/* Inventory */}
            {agent.inventory.length > 0 && (
              <>
                <div style={styles.detailLabel}>Inventory ({agent.inventory.length})</div>
                <div style={styles.inventoryGrid}>
                  {agent.inventory.slice(0, 8).map(item => (
                    <span key={item.id} style={styles.inventoryItem}>
                      {item.name} x{item.quantity}
                    </span>
                  ))}
                </div>
              </>
            )}

            {/* Personality OCEAN */}
            <div style={styles.detailLabel}>Personality</div>
            <div style={styles.personalityRow}>
              {Object.entries(agent.personality).slice(0, 5).map(([trait, value]) => (
                <div key={trait} style={styles.traitChip}>
                  {trait.charAt(0).toUpperCase()}: {(value * 100).toFixed(0)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatBar({ icon, value, max, color }: {
  icon: string; value: number; max: number; color: string
}) {
  const pct = Math.round((value / max) * 100)
  return (
    <div style={styles.statRow}>
      <span style={styles.statIcon}>{icon}</span>
      <div style={styles.barBg}>
        <div style={{ ...styles.barFill, width: `${pct}%`, background: color }} />
      </div>
      <span style={styles.statNum}>{Math.round(value)}</span>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 500,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'auto',
  },
  card: {
    width: 300,
    maxHeight: '80vh',
    overflowY: 'auto',
    padding: 16,
    position: 'relative',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  closeBtn: {
    position: 'absolute',
    top: 8,
    right: 10,
    background: 'none',
    border: 'none',
    color: OV.textMuted,
    fontSize: 16,
    cursor: 'pointer',
    padding: '2px 6px',
    lineHeight: 1,
  },
  header: {
    display: 'flex',
    gap: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 8,
    background: 'rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarEmoji: {
    fontSize: 28,
  },
  headerInfo: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 4,
    minWidth: 0,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: OV.accent,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  subtitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap' as const,
  },
  classBadge: {
    fontSize: 10,
    color: '#9ae6b4',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 4,
    padding: '1px 6px',
    textTransform: 'capitalize' as const,
  },
  levelBadge: {
    fontSize: 10,
    color: OV.accent,
    background: 'rgba(255,215,0,0.15)',
    borderRadius: 4,
    padding: '1px 6px',
  },
  actionText: {
    fontSize: 10,
    color: OV.textDim,
  },
  statsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginBottom: 10,
  },
  statRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  statIcon: {
    fontSize: 12,
    width: 18,
    textAlign: 'center' as const,
  },
  barBg: {
    flex: 1,
    height: 8,
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    transition: 'width 0.3s ease',
  },
  statNum: {
    fontSize: 11,
    color: OV.text,
    width: 28,
    textAlign: 'right' as const,
  },
  skillsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 4,
    marginBottom: 10,
  },
  skillItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    color: OV.textDim,
  },
  skillIcon: {
    fontSize: 11,
  },
  skillName: {
    textTransform: 'capitalize' as const,
    flex: 1,
  },
  skillValue: {
    color: OV.text,
    fontWeight: 'bold',
  },
  emotionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  emotionText: {
    fontSize: 12,
    color: OV.text,
  },
  compoundText: {
    fontSize: 10,
    color: OV.textDim,
    fontStyle: 'italic',
  },
  chatBubble: {
    fontSize: 11,
    color: '#9ae6b4',
    fontStyle: 'italic',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 6,
    padding: '6px 10px',
    marginBottom: 10,
    lineHeight: 1.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  actions: {
    display: 'flex',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    border: 'none',
    borderRadius: OV.radiusSm,
    padding: '7px 0',
    fontSize: 12,
    fontWeight: 'bold',
    color: OV.text,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.15s',
  },
  details: {
    marginTop: 12,
    borderTop: `1px solid ${OV.border}`,
    paddingTop: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 11,
  },
  detailLabel: {
    color: OV.textMuted,
    fontSize: 10,
    marginTop: 4,
  },
  detailValue: {
    color: OV.text,
    fontSize: 11,
  },
  detailValueBio: {
    color: OV.textDim,
    fontSize: 10,
    fontStyle: 'italic',
    textAlign: 'right' as const,
    maxWidth: '60%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  inventoryGrid: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 4,
    marginTop: 2,
  },
  inventoryItem: {
    fontSize: 10,
    color: OV.text,
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    padding: '1px 6px',
  },
  personalityRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 4,
    marginTop: 2,
  },
  traitChip: {
    fontSize: 9,
    color: '#9ae6b4',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    padding: '2px 6px',
  },
}
