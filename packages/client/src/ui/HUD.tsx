import type { WorldClock } from '@botworld/shared'
import type { SpeedState } from '../network/socket-client.js'
import { socketClient } from '../network/socket-client.js'

const TIME_ICONS: Record<string, string> = {
  dawn: '🌅',
  morning: '☀️',
  noon: '🌞',
  afternoon: '🌤️',
  evening: '🌇',
  night: '🌙',
}

const SPEED_OPTIONS = [0.5, 1, 2, 3, 5]

export function HUD({ clock, agentCount, speedState }: {
  clock: WorldClock | null
  agentCount: number
  speedState: SpeedState
}) {
  if (!clock) return null

  const togglePause = () => {
    if (speedState.paused) {
      socketClient.resume()
    } else {
      socketClient.pause()
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.topRow}>
        <div style={styles.item}>
          {TIME_ICONS[clock.timeOfDay] ?? '⏰'} Day {clock.day} - {clock.timeOfDay}
        </div>
        <div style={styles.item}>
          Tick: {clock.tick}
        </div>
        <div style={styles.item}>
          Agents: {agentCount}
        </div>
      </div>
      <div style={styles.controls}>
        <button
          onClick={togglePause}
          style={{
            ...styles.btn,
            background: speedState.paused ? '#e74c3c' : '#2a3a5e',
          }}
        >
          {speedState.paused ? '▶ Play' : '⏸ Pause'}
        </button>
        <div style={styles.speedGroup}>
          {SPEED_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => socketClient.setSpeed(s)}
              style={{
                ...styles.speedBtn,
                background: speedState.speed === s && !speedState.paused ? '#e2b714' : '#1a2a4a',
                color: speedState.speed === s && !speedState.paused ? '#0d1117' : '#667788',
              }}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#16213e',
    borderRadius: 8,
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  topRow: {
    display: 'flex',
    gap: 16,
    fontSize: 13,
  },
  item: {
    color: '#ccddee',
  },
  controls: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  btn: {
    border: 'none',
    borderRadius: 4,
    padding: '3px 10px',
    fontSize: 11,
    color: '#ccddee',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  speedGroup: {
    display: 'flex',
    gap: 2,
  },
  speedBtn: {
    border: 'none',
    borderRadius: 3,
    padding: '2px 6px',
    fontSize: 10,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: 'bold',
  },
}
