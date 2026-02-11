import type { Agent, CharacterAppearance, CharacterClass, Race } from '@botworld/shared'
import { getCompoundEmotions } from '@botworld/shared'
import { RACE_ICONS, CLASS_ICONS } from './constants.js'

interface CharacterData {
  appearance: CharacterAppearance
  race: Race
  characterClass?: CharacterClass
  persona_reasoning?: string
  spriteHash: string
}

export function AgentInspector({ agent, characterData }: {
  agent: Agent | null
  characterData?: CharacterData
}) {
  if (!agent) {
    return (
      <div style={styles.container}>
        <h3 style={styles.title}>Agent Inspector</h3>
        <p style={styles.hint}>Click an agent to inspect</p>
      </div>
    )
  }

  const compound = getCompoundEmotions(agent.currentMood)
  const dominantEmotions = Object.entries(agent.currentMood)
    .filter(([, v]) => v > 0.1)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)

  const dominantCompound = Object.entries(compound)
    .filter(([, v]) => v > 0.1)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>{agent.name}</h3>
      <p style={styles.bio}>{agent.bio}</p>

      {characterData && (
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>Character</h4>
          <div style={styles.badgeRow}>
            <span style={styles.raceBadge}>
              {RACE_ICONS[characterData.race] ?? ''} {characterData.race}
            </span>
            {characterData.characterClass && (
              <span style={styles.classBadge}>
                {CLASS_ICONS[characterData.characterClass] ?? ''} {characterData.characterClass}
              </span>
            )}
          </div>
          <div style={styles.detail}>Armor: {characterData.appearance.armor}</div>
          {characterData.appearance.headgear && characterData.appearance.headgear !== 'none' && (
            <div style={styles.detail}>Headgear: {characterData.appearance.headgear}</div>
          )}
          {characterData.appearance.cape && characterData.appearance.cape !== 'none' && (
            <div style={styles.detail}>Cape: {characterData.appearance.cape}</div>
          )}
          {characterData.persona_reasoning && (
            <p style={styles.reasoning}>"{characterData.persona_reasoning}"</p>
          )}
        </div>
      )}

      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Stats</h4>
        <StatBar label="HP" value={agent.stats.hp} max={agent.stats.maxHp} color="#e74c3c" />
        <StatBar label="Energy" value={agent.stats.energy} max={agent.stats.maxEnergy} color="#3498db" />
        <StatBar label="Hunger" value={agent.stats.hunger} max={agent.stats.maxHunger} color="#f39c12" />
      </div>

      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Level {agent.level}</h4>
        <div style={styles.detail}>XP: {agent.xp}</div>
        <div style={styles.detail}>Position: ({agent.position.x}, {agent.position.y})</div>
        <div style={styles.detail}>Action: {agent.currentAction?.type ?? 'idle'}</div>
        {agent.llmConfig && <div style={styles.detail}>LLM: {agent.llmConfig.provider}{agent.llmConfig.model ? ` (${agent.llmConfig.model})` : ''}</div>}
      </div>

      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Emotions</h4>
        {dominantEmotions.length === 0 && <div style={styles.detail}>Neutral</div>}
        {dominantEmotions.map(([name, value]) => (
          <div key={name} style={styles.emotion}>
            {name}: {(value * 100).toFixed(0)}%
          </div>
        ))}
        {dominantCompound.length > 0 && (
          <>
            <div style={{ ...styles.detail, marginTop: 4, color: '#8899aa' }}>Complex:</div>
            {dominantCompound.map(([name, value]) => (
              <div key={name} style={styles.emotion}>
                {name}: {(value * 100).toFixed(0)}%
              </div>
            ))}
          </>
        )}
      </div>

      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Skills</h4>
        {Object.entries(agent.skills)
          .filter(([, v]) => v > 0)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 6)
          .map(([name, value]) => (
            <div key={name} style={styles.skillRow}>
              <span style={styles.skillName}>{name}</span>
              <div style={styles.skillBarBg}>
                <div style={{ ...styles.skillBarFill, width: `${Math.min(value, 100)}%` }} />
              </div>
              <span style={styles.skillValue}>{Math.round(value)}</span>
            </div>
          ))}
        {Object.values(agent.skills).every(v => v === 0) && (
          <div style={styles.detail}>No skills yet</div>
        )}
      </div>

      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Inventory ({agent.inventory.length})</h4>
        {agent.inventory.length === 0 && <div style={styles.detail}>Empty</div>}
        {agent.inventory.slice(0, 8).map(item => (
          <div key={item.id} style={styles.detail}>
            {item.name} x{item.quantity}
          </div>
        ))}
      </div>

      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Personality</h4>
        <div style={styles.personalityRow}>
          {Object.entries(agent.personality).slice(0, 5).map(([trait, value]) => (
            <div key={trait} style={styles.traitChip}>
              {trait.charAt(0).toUpperCase()}: {(value * 100).toFixed(0)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

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
      <span style={styles.statValue}>{Math.round(value)}</span>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#16213e',
    borderRadius: 8,
    padding: 12,
    overflowY: 'auto',
    maxHeight: 400,
  },
  title: {
    margin: '0 0 4px 0',
    fontSize: 16,
    color: '#e2b714',
  },
  bio: {
    fontSize: 11,
    color: '#8899aa',
    margin: '0 0 8px 0',
    fontStyle: 'italic',
  },
  hint: {
    color: '#556677',
    fontSize: 12,
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    margin: '0 0 4px 0',
    fontSize: 12,
    color: '#8899aa',
    borderBottom: '1px solid #2a3a5e',
    paddingBottom: 2,
  },
  detail: {
    fontSize: 11,
    color: '#ccddee',
    marginBottom: 2,
  },
  badgeRow: {
    display: 'flex',
    gap: 6,
    marginBottom: 6,
    flexWrap: 'wrap' as const,
  },
  raceBadge: {
    fontSize: 11,
    color: '#e2b714',
    background: '#0d1117',
    borderRadius: 4,
    padding: '2px 8px',
    textTransform: 'capitalize' as const,
  },
  classBadge: {
    fontSize: 11,
    color: '#9ae6b4',
    background: '#0d1117',
    borderRadius: 4,
    padding: '2px 8px',
    textTransform: 'capitalize' as const,
  },
  reasoning: {
    fontSize: 10,
    color: '#667788',
    margin: '4px 0 0 0',
    fontStyle: 'italic',
    lineHeight: 1.4,
  },
  emotion: {
    fontSize: 11,
    color: '#9ae6b4',
    marginBottom: 1,
  },
  statRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  statLabel: {
    fontSize: 10,
    color: '#8899aa',
    width: 45,
  },
  barBg: {
    flex: 1,
    height: 6,
    background: '#0d1117',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
    transition: 'width 0.3s ease',
  },
  statValue: {
    fontSize: 10,
    color: '#ccddee',
    width: 25,
    textAlign: 'right' as const,
  },
  skillRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  skillName: {
    fontSize: 10,
    color: '#8899aa',
    width: 55,
    textTransform: 'capitalize' as const,
  },
  skillBarBg: {
    flex: 1,
    height: 4,
    background: '#0d1117',
    borderRadius: 2,
    overflow: 'hidden',
  },
  skillBarFill: {
    height: '100%',
    borderRadius: 2,
    background: '#f39c12',
    transition: 'width 0.3s ease',
  },
  skillValue: {
    fontSize: 9,
    color: '#667788',
    width: 20,
    textAlign: 'right' as const,
  },
  personalityRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 4,
  },
  traitChip: {
    fontSize: 9,
    color: '#9ae6b4',
    background: '#0d1117',
    borderRadius: 3,
    padding: '1px 5px',
  },
}
