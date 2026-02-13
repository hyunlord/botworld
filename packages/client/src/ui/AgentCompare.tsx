import { useState, useEffect } from 'react'
import { OV, glassPanel, interactive } from './overlay-styles.js'
import { soundManager } from '../game/audio/sound-manager.js'

interface AgentCompareProps {
  agents: any[]
  initialAgentId1?: string
  initialAgentId2?: string
  onClose: () => void
  onSelectAgent?: (agentId: string) => void
}

interface ComparisonData {
  agent1: {
    id: string
    name: string
    level: number
    gold: number
    totalKills: number
    totalCrafted: number
    tilesExplored: number
    skills: {
      combat: number
      economy: number
      crafting: number
      exploration: number
      social: number
      magic: number
    }
  }
  agent2: {
    id: string
    name: string
    level: number
    gold: number
    totalKills: number
    totalCrafted: number
    tilesExplored: number
    skills: {
      combat: number
      economy: number
      crafting: number
      exploration: number
      social: number
      magic: number
    }
  }
  headToHead: {
    wins1: number
    wins2: number
    draws: number
  }
}

export function AgentCompare({
  agents,
  initialAgentId1,
  initialAgentId2,
  onClose,
  onSelectAgent,
}: AgentCompareProps) {
  const [agentId1, setAgentId1] = useState(initialAgentId1 || agents[0]?.id || '')
  const [agentId2, setAgentId2] = useState(initialAgentId2 || agents[1]?.id || '')
  const [comparison, setComparison] = useState<ComparisonData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  // Fetch comparison when both agents selected
  useEffect(() => {
    if (!agentId1 || !agentId2 || agentId1 === agentId2) {
      setComparison(null)
      return
    }

    setLoading(true)
    setError(null)
    fetch(`/api/rankings/compare/${agentId1}/${agentId2}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch comparison')
        return res.json()
      })
      .then(data => {
        setComparison(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [agentId1, agentId2])

  const handleCloseClick = () => {
    soundManager.playUIClose()
    onClose()
  }

  const handleAgent1Change = (e: React.ChangeEvent<HTMLSelectElement>) => {
    soundManager.playUIClick()
    setAgentId1(e.target.value)
  }

  const handleAgent2Change = (e: React.ChangeEvent<HTMLSelectElement>) => {
    soundManager.playUIClick()
    setAgentId2(e.target.value)
  }

  const handleAgentClick = (agentId: string) => {
    soundManager.playUIClick()
    if (onSelectAgent) {
      onSelectAgent(agentId)
    }
  }

  return (
    <div style={styles.backdrop} onClick={handleCloseClick}>
      <div style={{ ...glassPanel, ...interactive, ...styles.modal }} onClick={(e) => e.stopPropagation()}>
        <button style={styles.closeBtn} onClick={handleCloseClick}>✕</button>

        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Agent Comparison</h2>
        </div>

        {/* Agent selectors */}
        <div style={styles.selectorsRow}>
          <div style={styles.selectorBox}>
            <label style={styles.selectorLabel}>Agent 1</label>
            <select style={styles.selector} value={agentId1} onChange={handleAgent1Change}>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} (Lv.{agent.level})
                </option>
              ))}
            </select>
          </div>
          <div style={styles.vs}>VS</div>
          <div style={styles.selectorBox}>
            <label style={styles.selectorLabel}>Agent 2</label>
            <select style={styles.selector} value={agentId2} onChange={handleAgent2Change}>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} (Lv.{agent.level})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content */}
        {loading && <div style={styles.emptyText}>Loading comparison...</div>}
        {error && <div style={styles.errorText}>Error: {error}</div>}
        {agentId1 === agentId2 && !loading && (
          <div style={styles.emptyText}>Please select two different agents</div>
        )}
        {comparison && !loading && agentId1 !== agentId2 && (
          <div style={styles.content}>
            {/* Radar chart */}
            <div style={styles.radarSection}>
              <RadarChart
                stats1={[
                  comparison.agent1.skills.combat / 100,
                  comparison.agent1.skills.economy / 100,
                  comparison.agent1.skills.crafting / 100,
                  comparison.agent1.skills.exploration / 100,
                  comparison.agent1.skills.social / 100,
                  comparison.agent1.skills.magic / 100,
                ]}
                stats2={[
                  comparison.agent2.skills.combat / 100,
                  comparison.agent2.skills.economy / 100,
                  comparison.agent2.skills.crafting / 100,
                  comparison.agent2.skills.exploration / 100,
                  comparison.agent2.skills.social / 100,
                  comparison.agent2.skills.magic / 100,
                ]}
                labels={['Combat', 'Economy', 'Crafting', 'Exploration', 'Social', 'Magic']}
                name1={comparison.agent1.name}
                name2={comparison.agent2.name}
              />
            </div>

            {/* Head-to-head record */}
            <div style={styles.headToHead}>
              <h3 style={styles.sectionTitle}>Head-to-Head Record</h3>
              <div style={styles.h2hRow}>
                <span style={{ ...styles.h2hStat, color: OV.green }}>
                  {comparison.headToHead.wins1} W
                </span>
                <span style={styles.h2hDivider}>-</span>
                <span style={{ ...styles.h2hStat, color: OV.textDim }}>
                  {comparison.headToHead.draws} D
                </span>
                <span style={styles.h2hDivider}>-</span>
                <span style={{ ...styles.h2hStat, color: OV.red }}>
                  {comparison.headToHead.wins2} L
                </span>
              </div>
            </div>

            {/* Stats comparison */}
            <div style={styles.statsSection}>
              <h3 style={styles.sectionTitle}>Statistics</h3>
              <div style={styles.statsGrid}>
                <CompareRow
                  label="Level"
                  val1={comparison.agent1.level}
                  val2={comparison.agent2.level}
                />
                <CompareRow
                  label="Gold"
                  val1={comparison.agent1.gold}
                  val2={comparison.agent2.gold}
                />
                <CompareRow
                  label="Total Kills"
                  val1={comparison.agent1.totalKills}
                  val2={comparison.agent2.totalKills}
                />
                <CompareRow
                  label="Items Crafted"
                  val1={comparison.agent1.totalCrafted}
                  val2={comparison.agent2.totalCrafted}
                />
                <CompareRow
                  label="Tiles Explored"
                  val1={comparison.agent1.tilesExplored}
                  val2={comparison.agent2.tilesExplored}
                />
              </div>
            </div>

            {/* Skills comparison */}
            <div style={styles.skillsSection}>
              <h3 style={styles.sectionTitle}>Skills Breakdown</h3>
              <SkillBar
                label="Combat"
                val1={comparison.agent1.skills.combat}
                val2={comparison.agent2.skills.combat}
                color1="#F87171"
                color2="#60A5FA"
              />
              <SkillBar
                label="Economy"
                val1={comparison.agent1.skills.economy}
                val2={comparison.agent2.skills.economy}
                color1="#F87171"
                color2="#60A5FA"
              />
              <SkillBar
                label="Crafting"
                val1={comparison.agent1.skills.crafting}
                val2={comparison.agent2.skills.crafting}
                color1="#F87171"
                color2="#60A5FA"
              />
              <SkillBar
                label="Exploration"
                val1={comparison.agent1.skills.exploration}
                val2={comparison.agent2.skills.exploration}
                color1="#F87171"
                color2="#60A5FA"
              />
              <SkillBar
                label="Social"
                val1={comparison.agent1.skills.social}
                val2={comparison.agent2.skills.social}
                color1="#F87171"
                color2="#60A5FA"
              />
              <SkillBar
                label="Magic"
                val1={comparison.agent1.skills.magic}
                val2={comparison.agent2.skills.magic}
                color1="#F87171"
                color2="#60A5FA"
              />
            </div>

            {/* Agent clickable buttons */}
            <div style={styles.agentButtons}>
              <button
                style={{ ...styles.agentBtn, borderColor: '#F87171' }}
                onClick={() => handleAgentClick(comparison.agent1.id)}
              >
                View {comparison.agent1.name}
              </button>
              <button
                style={{ ...styles.agentBtn, borderColor: '#60A5FA' }}
                onClick={() => handleAgentClick(comparison.agent2.id)}
              >
                View {comparison.agent2.name}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function RadarChart({
  stats1,
  stats2,
  labels,
  name1,
  name2,
}: {
  stats1: number[]
  stats2: number[]
  labels: string[]
  name1: string
  name2: string
}) {
  const size = 300
  const center = size / 2
  const radius = size * 0.35
  const n = labels.length

  const getPoint = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2
    const r = radius * Math.min(value, 1)
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) }
  }

  const getAxisEnd = (index: number) => {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2
    return { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) }
  }

  const getLabelPos = (index: number) => {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2
    const r = radius * 1.2
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) }
  }

  // Generate polygon path
  const getPolygonPath = (stats: number[]) => {
    return stats.map((val, i) => {
      const pt = getPoint(i, val)
      return `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`
    }).join(' ') + ' Z'
  }

  return (
    <svg width={size} height={size} style={{ display: 'block', margin: '0 auto' }}>
      {/* Background rings */}
      {[0.25, 0.5, 0.75, 1].map(scale => (
        <polygon
          key={scale}
          points={Array.from({ length: n }, (_, i) => {
            const pt = getPoint(i, scale)
            return `${pt.x},${pt.y}`
          }).join(' ')}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />
      ))}

      {/* Axes */}
      {labels.map((_, i) => {
        const end = getAxisEnd(i)
        return (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={end.x}
            y2={end.y}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={1}
          />
        )
      })}

      {/* Agent 2 polygon (blue, behind) */}
      <path
        d={getPolygonPath(stats2)}
        fill="rgba(96, 165, 250, 0.2)"
        stroke="#60A5FA"
        strokeWidth={2}
      />

      {/* Agent 1 polygon (red, front) */}
      <path
        d={getPolygonPath(stats1)}
        fill="rgba(248, 113, 113, 0.2)"
        stroke="#F87171"
        strokeWidth={2}
      />

      {/* Labels */}
      {labels.map((label, i) => {
        const pos = getLabelPos(i)
        return (
          <text
            key={i}
            x={pos.x}
            y={pos.y}
            fill={OV.text}
            fontSize={11}
            fontFamily={OV.font}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {label}
          </text>
        )
      })}

      {/* Legend */}
      <g transform={`translate(${center - 60}, ${size - 20})`}>
        <rect x={0} y={0} width={16} height={12} fill="rgba(248, 113, 113, 0.3)" stroke="#F87171" />
        <text x={20} y={10} fill={OV.textDim} fontSize={10} fontFamily={OV.font}>
          {name1}
        </text>
      </g>
      <g transform={`translate(${center + 10}, ${size - 20})`}>
        <rect x={0} y={0} width={16} height={12} fill="rgba(96, 165, 250, 0.3)" stroke="#60A5FA" />
        <text x={20} y={10} fill={OV.textDim} fontSize={10} fontFamily={OV.font}>
          {name2}
        </text>
      </g>
    </svg>
  )
}

function CompareRow({ label, val1, val2 }: { label: string; val1: number; val2: number }) {
  const better1 = val1 > val2
  const better2 = val2 > val1
  return (
    <div style={styles.compareRow}>
      <span style={{ ...styles.compareVal, color: better1 ? '#4ADE80' : OV.text }}>
        {val1.toLocaleString()}
      </span>
      <span style={styles.compareLabel}>{label}</span>
      <span style={{ ...styles.compareVal, color: better2 ? '#4ADE80' : OV.text }}>
        {val2.toLocaleString()}
      </span>
    </div>
  )
}

function SkillBar({
  label,
  val1,
  val2,
  color1,
  color2,
}: {
  label: string
  val1: number
  val2: number
  color1: string
  color2: string
}) {
  const max = 100
  const pct1 = Math.min(100, (val1 / max) * 100)
  const pct2 = Math.min(100, (val2 / max) * 100)

  return (
    <div style={styles.skillBarRow}>
      <span style={styles.skillLabel}>{label}</span>
      <div style={styles.skillBars}>
        <div style={styles.barContainer}>
          <div style={{ ...styles.barFill, width: `${pct1}%`, background: color1 }} />
          <span style={{ ...styles.barValue, color: color1 }}>{val1}</span>
        </div>
        <div style={styles.barContainer}>
          <div style={{ ...styles.barFill, width: `${pct2}%`, background: color2 }} />
          <span style={{ ...styles.barValue, color: color2 }}>{val2}</span>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(4px)',
    animation: 'fadeSlideIn 0.2s ease-out',
  },
  modal: {
    width: '90vw',
    maxWidth: 900,
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: 24,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    background: 'none',
    border: 'none',
    color: OV.textMuted,
    fontSize: 20,
    cursor: 'pointer',
    padding: '4px 8px',
    transition: 'color 0.15s',
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: OV.accent,
    margin: 0,
  },
  selectorsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
    paddingBottom: 20,
    borderBottom: `1px solid ${OV.border}`,
  },
  selectorBox: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  selectorLabel: {
    fontSize: 12,
    color: OV.textDim,
    fontWeight: '600',
  },
  selector: {
    background: 'rgba(255,255,255,0.05)',
    border: `1px solid ${OV.border}`,
    borderRadius: 6,
    color: OV.text,
    fontSize: 14,
    padding: '10px 12px',
    fontFamily: OV.font,
    cursor: 'pointer',
  },
  vs: {
    fontSize: 18,
    fontWeight: 'bold',
    color: OV.accent,
    marginTop: 20,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  radarSection: {
    display: 'flex',
    justifyContent: 'center',
    padding: '20px 0',
  },
  headToHead: {
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: OV.accent,
    margin: '0 0 12px 0',
  },
  h2hRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    fontSize: 20,
    fontWeight: 'bold',
  },
  h2hStat: {
    minWidth: 50,
  },
  h2hDivider: {
    color: OV.textMuted,
  },
  statsSection: {},
  statsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  compareRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  compareVal: {
    flex: 1,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  compareLabel: {
    width: 140,
    fontSize: 12,
    color: OV.textDim,
    textAlign: 'center',
  },
  skillsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  skillBarRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  skillLabel: {
    fontSize: 12,
    color: OV.textDim,
    width: 100,
  },
  skillBars: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  barContainer: {
    position: 'relative',
    height: 20,
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    transition: 'width 0.3s ease',
  },
  barValue: {
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: 11,
    fontWeight: 'bold',
  },
  agentButtons: {
    display: 'flex',
    gap: 12,
    marginTop: 8,
  },
  agentBtn: {
    flex: 1,
    background: 'rgba(255,255,255,0.05)',
    border: '2px solid',
    borderRadius: 8,
    color: OV.text,
    fontSize: 14,
    fontWeight: 'bold',
    padding: '12px',
    cursor: 'pointer',
    fontFamily: OV.font,
    transition: 'all 0.15s',
  },
  emptyText: {
    fontSize: 14,
    color: OV.textMuted,
    textAlign: 'center',
    padding: 40,
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 14,
    color: OV.red,
    textAlign: 'center',
    padding: 40,
  },
}
