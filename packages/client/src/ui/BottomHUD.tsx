import { useState } from 'react'
import type { WorldClock, Agent } from '@botworld/shared'
import type { SpeedState } from '../network/socket-client.js'
import { socketClient } from '../network/socket-client.js'
import { soundManager } from '../game/audio/sound-manager.js'
import { OV, glassPanel, interactive } from './overlay-styles.js'
import { RACE_ICONS, CLASS_ICONS, ACTION_ICONS } from './constants.js'

const TIME_ICONS: Record<string, string> = {
  dawn: '\uD83C\uDF05', morning: '\u2600\uFE0F', noon: '\uD83C\uDF1E',
  afternoon: '\uD83C\uDF24\uFE0F', evening: '\uD83C\uDF07', night: '\uD83C\uDF19',
}

const WEATHER_ICONS: Record<string, string> = {
  clear: '\u2600\uFE0F', cloudy: '\u2601\uFE0F', rain: '\uD83C\uDF27\uFE0F',
  storm: '\u26C8\uFE0F', snow: '\uD83C\uDF28\uFE0F', fog: '\uD83C\uDF2B\uFE0F',
}

const SPEED_OPTIONS = [0.5, 1, 2, 3, 5]

interface BottomHUDProps {
  clock: WorldClock | null
  agentCount: number
  spectatorCount: number
  speedState: SpeedState
  weather?: string | null
  selectedAgent: Agent | null
  characterData?: { race: string; characterClass?: string }
  onSendAgent: () => void
}

export function BottomHUD({
  clock, agentCount, spectatorCount, speedState, weather,
  selectedAgent, characterData, onSendAgent,
}: BottomHUDProps) {
  const [muted, setMuted] = useState(soundManager.isMuted())
  const [showAudio, setShowAudio] = useState(false)
  const [bgmVol, setBgmVol] = useState(soundManager.getBgmVolume())
  const [sfxVol, setSfxVol] = useState(soundManager.getSfxVolume())

  if (!clock) return null

  const togglePause = () => {
    if (speedState.paused) socketClient.resume()
    else socketClient.pause()
  }

  const handleMute = () => {
    const nowMuted = soundManager.toggleMute()
    setMuted(nowMuted)
  }

  return (
    <div style={styles.wrapper}>
      <div style={{ ...glassPanel, ...interactive, ...styles.bar }}>
        {/* Left: Game state */}
        <div style={styles.left}>
          <span style={styles.stat}>
            {TIME_ICONS[clock.timeOfDay] ?? '\u23F0'} Day {clock.day} {clock.timeOfDay}
          </span>
          <span style={styles.divider}>|</span>
          {weather && (
            <>
              <span style={styles.stat}>{WEATHER_ICONS[weather] ?? ''} {weather}</span>
              <span style={styles.divider}>|</span>
            </>
          )}
          <span style={styles.stat}>\uD83E\uDD16 {agentCount}</span>
          <span style={styles.divider}>|</span>
          <span style={styles.stat}>\uD83D\uDC41 {spectatorCount}</span>
        </div>

        {/* Center: Selected agent summary */}
        <div style={styles.center}>
          {selectedAgent ? (
            <div style={styles.selectedAgent}>
              {characterData && (
                <span style={styles.agentIcon}>
                  {RACE_ICONS[characterData.race] ?? ''}{characterData.characterClass ? CLASS_ICONS[characterData.characterClass] ?? '' : ''}
                </span>
              )}
              <span style={styles.agentNameHud}>{selectedAgent.name}</span>
              <span style={styles.agentLevel}>Lv.{selectedAgent.level}</span>
              <span style={styles.agentAction}>
                {ACTION_ICONS[selectedAgent.currentAction?.type ?? 'idle'] ?? ''} {selectedAgent.currentAction?.type ?? 'idle'}
              </span>
            </div>
          ) : (
            <span style={styles.hintText}>Click an agent on the map</span>
          )}
        </div>

        {/* Right: Controls */}
        <div style={styles.right}>
          <div style={styles.audioContainer}>
            <button onClick={handleMute} style={styles.iconBtn} title={muted ? 'Unmute' : 'Mute'}>
              {muted ? '\uD83D\uDD07' : '\uD83D\uDD0A'}
            </button>
            <button onClick={() => setShowAudio(!showAudio)} style={styles.iconBtn} title="Audio settings">
              \u25BE
            </button>
            {showAudio && (
              <div style={styles.audioPopup}>
                <div style={styles.sliderRow}>
                  <span style={styles.sliderLabel}>BGM</span>
                  <input type="range" min="0" max="100" value={Math.round(bgmVol * 100)}
                    onChange={e => { const v = Number(e.target.value) / 100; soundManager.setBgmVolume(v); setBgmVol(v) }}
                    style={styles.slider} disabled={muted} />
                </div>
                <div style={styles.sliderRow}>
                  <span style={styles.sliderLabel}>SFX</span>
                  <input type="range" min="0" max="100" value={Math.round(sfxVol * 100)}
                    onChange={e => { const v = Number(e.target.value) / 100; soundManager.setSfxVolume(v); setSfxVol(v) }}
                    style={styles.slider} disabled={muted} />
                </div>
              </div>
            )}
          </div>

          <button onClick={togglePause} style={{
            ...styles.ctrlBtn,
            background: speedState.paused ? OV.hp : 'rgba(255,255,255,0.1)',
          }}>
            {speedState.paused ? '\u25B6' : '\u23F8'}
          </button>

          <div style={styles.speedGroup}>
            {SPEED_OPTIONS.map(s => (
              <button key={s} onClick={() => socketClient.setSpeed(s)} style={{
                ...styles.speedBtn,
                background: speedState.speed === s && !speedState.paused ? OV.accent : 'rgba(255,255,255,0.08)',
                color: speedState.speed === s && !speedState.paused ? '#000' : OV.textDim,
              }}>
                {s}x
              </button>
            ))}
          </div>

          <button onClick={onSendAgent} style={styles.sendBtn}>
            \uD83E\uDD16 Send Agent
          </button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    pointerEvents: 'none',
    padding: '0 12px 8px',
  },
  bar: {
    display: 'flex',
    alignItems: 'center',
    height: 48,
    padding: '0 16px',
    gap: 8,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  stat: {
    fontSize: 12,
    color: OV.text,
    whiteSpace: 'nowrap' as const,
  },
  divider: {
    color: OV.textMuted,
    fontSize: 10,
  },
  center: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 0,
  },
  selectedAgent: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  agentIcon: {
    fontSize: 14,
  },
  agentNameHud: {
    fontSize: 13,
    fontWeight: 'bold',
    color: OV.accent,
  },
  agentLevel: {
    fontSize: 10,
    color: OV.textDim,
    background: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    padding: '1px 5px',
  },
  agentAction: {
    fontSize: 11,
    color: OV.textDim,
  },
  hintText: {
    fontSize: 11,
    color: OV.textMuted,
    fontStyle: 'italic',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  audioContainer: {
    position: 'relative' as const,
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    fontSize: 16,
    cursor: 'pointer',
    padding: '2px 4px',
    lineHeight: 1,
    color: OV.text,
  },
  audioPopup: {
    position: 'absolute' as const,
    bottom: 42,
    right: 0,
    background: OV.bg,
    backdropFilter: OV.blur,
    border: `1px solid ${OV.border}`,
    borderRadius: OV.radius,
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
    width: 160,
    pointerEvents: 'auto' as const,
  },
  sliderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  sliderLabel: {
    fontSize: 10,
    color: OV.textDim,
    width: 28,
    flexShrink: 0,
  },
  slider: {
    flex: 1,
    height: 4,
    accentColor: OV.accent,
    cursor: 'pointer',
  },
  ctrlBtn: {
    border: 'none',
    borderRadius: OV.radiusSm,
    width: 32,
    height: 28,
    fontSize: 14,
    cursor: 'pointer',
    color: OV.text,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  speedGroup: {
    display: 'flex',
    gap: 2,
  },
  speedBtn: {
    border: 'none',
    borderRadius: 4,
    padding: '3px 7px',
    fontSize: 10,
    fontWeight: 'bold',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.15s',
  },
  sendBtn: {
    background: OV.accent,
    color: '#000',
    border: 'none',
    borderRadius: OV.radiusSm,
    padding: '5px 12px',
    fontSize: 11,
    fontWeight: 'bold',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap' as const,
    transition: 'opacity 0.15s',
  },
}
