import { useState } from 'react'
import type { WorldClock } from '@botworld/shared'
import type { SpeedState } from '../network/socket-client.js'
import { socketClient } from '../network/socket-client.js'
import { soundManager } from '../game/audio/sound-manager.js'

const TIME_ICONS: Record<string, string> = {
  dawn: '🌅',
  morning: '☀️',
  noon: '🌞',
  afternoon: '🌤️',
  evening: '🌇',
  night: '🌙',
}

const WEATHER_ICONS: Record<string, string> = {
  clear: '\u2600\uFE0F',
  cloudy: '\u2601\uFE0F',
  rain: '\uD83C\uDF27\uFE0F',
  storm: '\u26C8\uFE0F',
  snow: '\uD83C\uDF28\uFE0F',
  fog: '\uD83C\uDF2B\uFE0F',
}

const SPEED_OPTIONS = [0.5, 1, 2, 3, 5]

export function HUD({ clock, agentCount, spectatorCount, speedState, weather }: {
  clock: WorldClock | null
  agentCount: number
  spectatorCount: number
  speedState: SpeedState
  weather?: string | null
}) {
  const [bgmVol, setBgmVol] = useState(soundManager.getBgmVolume())
  const [sfxVol, setSfxVol] = useState(soundManager.getSfxVolume())
  const [muted, setMuted] = useState(soundManager.isMuted())

  if (!clock) return null

  const togglePause = () => {
    if (speedState.paused) {
      socketClient.resume()
    } else {
      socketClient.pause()
    }
  }

  const handleMute = () => {
    const nowMuted = soundManager.toggleMute()
    setMuted(nowMuted)
  }

  const handleBgmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value) / 100
    soundManager.setBgmVolume(v)
    setBgmVol(v)
  }

  const handleSfxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value) / 100
    soundManager.setSfxVolume(v)
    setSfxVol(v)
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
        <div style={styles.item}>
          {'\uD83D\uDC41'} {spectatorCount}
        </div>
        {weather && (
          <div style={styles.item}>
            {WEATHER_ICONS[weather] ?? ''} {weather}
          </div>
        )}
        <a href="/" style={styles.sendBtn}>+ Send Agent</a>
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
      {/* Audio Controls */}
      <div style={styles.audioRow}>
        <button onClick={handleMute} style={styles.muteBtn} title={muted ? 'Unmute' : 'Mute'}>
          {muted ? '\uD83D\uDD07' : '\uD83D\uDD0A'}
        </button>
        <div style={styles.sliderGroup}>
          <span style={styles.sliderLabel}>BGM</span>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(bgmVol * 100)}
            onChange={handleBgmChange}
            style={styles.slider}
            disabled={muted}
          />
        </div>
        <div style={styles.sliderGroup}>
          <span style={styles.sliderLabel}>SFX</span>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(sfxVol * 100)}
            onChange={handleSfxChange}
            style={styles.slider}
            disabled={muted}
          />
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
  audioRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    borderTop: '1px solid #1a2a4a',
    paddingTop: 6,
  },
  muteBtn: {
    border: 'none',
    background: 'none',
    fontSize: 16,
    cursor: 'pointer',
    padding: '0 2px',
    lineHeight: 1,
  },
  sliderGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  sliderLabel: {
    fontSize: 9,
    color: '#667788',
    width: 24,
    flexShrink: 0,
  },
  slider: {
    flex: 1,
    height: 4,
    accentColor: '#e2b714',
    cursor: 'pointer',
  },
  sendBtn: {
    fontSize: 10,
    color: '#e2b714',
    textDecoration: 'none',
    marginLeft: 'auto',
    padding: '1px 6px',
    border: '1px solid #e2b714',
    borderRadius: 3,
    flexShrink: 0,
  },
}
