import { useEffect, useRef } from 'react'
import { OV, glassPanel, gameButton, interactive } from './overlay-styles.js'

interface FollowHUDProps {
  agent: any
  actionLog: string[]
  onStopFollow: () => void
  onNavigate?: (x: number, y: number) => void
}

const ACTION_TYPE_ICONS: Record<string, string> = {
  chat: '💬',
  move: '🚶',
  combat: '⚔️',
  attack: '🗡️',
  kill: '✅',
  trade: '🛒',
  craft: '⚒️',
  gather: '📦',
  rest: '💤',
  levelup: '⬆️',
  cast: '🔮',
  idle: '💭',
  work: '🔨',
  eat: '🍖',
  sleep: '😴',
  talk: '💬',
  fight: '⚔️',
}

function getActionIcon(actionText: string): string {
  const lower = actionText.toLowerCase()
  if (lower.includes('chat') || lower.includes('talk')) return ACTION_TYPE_ICONS.chat
  if (lower.includes('mov') || lower.includes('walk')) return ACTION_TYPE_ICONS.move
  if (lower.includes('combat') || lower.includes('fight')) return ACTION_TYPE_ICONS.combat
  if (lower.includes('attack')) return ACTION_TYPE_ICONS.attack
  if (lower.includes('kill') || lower.includes('defeat')) return ACTION_TYPE_ICONS.kill
  if (lower.includes('trade') || lower.includes('buy') || lower.includes('sell')) return ACTION_TYPE_ICONS.trade
  if (lower.includes('craft')) return ACTION_TYPE_ICONS.craft
  if (lower.includes('gather') || lower.includes('collect')) return ACTION_TYPE_ICONS.gather
  if (lower.includes('rest')) return ACTION_TYPE_ICONS.rest
  if (lower.includes('level')) return ACTION_TYPE_ICONS.levelup
  if (lower.includes('cast') || lower.includes('spell')) return ACTION_TYPE_ICONS.cast
  if (lower.includes('work')) return ACTION_TYPE_ICONS.work
  if (lower.includes('eat')) return ACTION_TYPE_ICONS.eat
  if (lower.includes('sleep')) return ACTION_TYPE_ICONS.sleep
  return ACTION_TYPE_ICONS.idle
}

function formatTimestamp(timestamp?: number | string): string {
  if (!timestamp) return ''
  const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp)
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function FollowHUD({ agent, actionLog, onStopFollow, onNavigate }: FollowHUDProps) {
  const logRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [actionLog])

  if (!agent) return null

  const currentAction = agent.currentAction?.type ?? 'idle'
  const currentActionText = agent.currentAction?.description ?? currentAction
  const hp = agent.stats?.hp ?? 100
  const maxHp = agent.stats?.maxHp ?? 100
  const hpPercent = (hp / maxHp) * 100

  return (
    <div style={styles.wrapper}>
      {/* Top Bar */}
      <div style={{ ...glassPanel, ...interactive, ...styles.topBar }}>
        {/* Left: Avatar + Name + Level */}
        <div style={styles.leftSection}>
          <div style={styles.avatar}>{agent.name?.[0]?.toUpperCase() ?? '?'}</div>
          <div style={styles.agentInfo}>
            <span style={styles.agentName}>{agent.name ?? 'Unknown'}</span>
            <span style={styles.agentLevel}>Lv.{agent.level ?? 1}</span>
          </div>
        </div>

        {/* Center: HP Bar + Current Action */}
        <div style={styles.centerSection}>
          <div style={styles.hpBarContainer}>
            <div style={styles.hpBarBg}>
              <div style={{
                ...styles.hpBarFill,
                width: `${hpPercent}%`,
              }} />
            </div>
            <span style={styles.hpText}>{Math.round(hp)}/{maxHp}</span>
          </div>
          <span style={styles.currentAction}>
            {getActionIcon(currentActionText)} {currentActionText}
          </span>
        </div>

        {/* Right: Stop Following Button */}
        <div style={styles.rightSection}>
          <button onClick={onStopFollow} style={{ ...gameButton, ...styles.stopButton }}>
            Stop Following
          </button>
        </div>
      </div>

      {/* Action Log Panel */}
      <div style={{ ...glassPanel, ...interactive, ...styles.logPanel }}>
        <div style={styles.logHeader}>
          <span style={styles.logTitle}>📜 Action Log</span>
          <span style={styles.logCount}>{actionLog.length}</span>
        </div>
        <div ref={logRef} style={styles.logScroll}>
          {actionLog.length === 0 ? (
            <div style={styles.emptyLog}>No actions yet...</div>
          ) : (
            actionLog.map((entry, idx) => {
              const opacity = 1 - (idx / actionLog.length) * 0.6
              const parts = entry.split('|')
              const text = parts[0] ?? entry
              const timestamp = parts[1] ?? Date.now()

              return (
                <div
                  key={`${timestamp}-${idx}`}
                  style={{
                    ...styles.logEntry,
                    opacity,
                    animation: idx === actionLog.length - 1 ? 'slideInLeft 0.3s ease-out' : 'none',
                  }}
                >
                  <span style={styles.logIcon}>{getActionIcon(text)}</span>
                  <span style={styles.logText}>{text}</span>
                  <span style={styles.logTime}>{formatTimestamp(timestamp)}</span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    pointerEvents: 'none',
    zIndex: 200,
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    height: 48,
    padding: '0 16px',
    gap: 16,
    width: '100%',
    boxSizing: 'border-box',
  },
  leftSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: OV.accentDim,
    border: `2px solid ${OV.accent}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 'bold',
    color: OV.accent,
  },
  agentInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  agentName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: OV.text,
    lineHeight: 1,
  },
  agentLevel: {
    fontSize: 10,
    color: OV.textDim,
    lineHeight: 1,
  },
  centerSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
  },
  hpBarContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  hpBarBg: {
    flex: 1,
    height: 8,
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  hpBarFill: {
    height: '100%',
    background: OV.hpGrad,
    transition: 'width 0.3s ease-out',
    borderRadius: 4,
  },
  hpText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: OV.hp,
    minWidth: 50,
    textAlign: 'right',
  },
  currentAction: {
    fontSize: 12,
    color: OV.textDim,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  rightSection: {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  stopButton: {
    padding: '6px 16px',
    fontSize: 12,
    whiteSpace: 'nowrap',
  },
  logPanel: {
    position: 'absolute',
    top: 56,
    left: 12,
    width: 300,
    maxHeight: 400,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  logHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderBottom: `1px solid ${OV.border}`,
  },
  logTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: OV.text,
  },
  logCount: {
    fontSize: 10,
    color: OV.textDim,
    background: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    padding: '2px 6px',
  },
  logScroll: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    maxHeight: 352,
  },
  emptyLog: {
    fontSize: 11,
    color: OV.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: '20px 0',
  },
  logEntry: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 11,
    color: OV.text,
    padding: '4px 0',
    transition: 'opacity 0.3s',
  },
  logIcon: {
    fontSize: 14,
    flexShrink: 0,
  },
  logText: {
    flex: 1,
    minWidth: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  logTime: {
    fontSize: 9,
    color: OV.textMuted,
    flexShrink: 0,
  },
}
