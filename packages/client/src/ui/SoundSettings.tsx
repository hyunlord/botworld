import { useState, useCallback } from 'react'
import { OV, glassPanel, gameButton, interactive } from './overlay-styles.js'
import { soundManager } from '../game/audio/sound-manager.js'

export function SoundSettings() {
  const [open, setOpen] = useState(false)
  const [bgmVol, setBgmVol] = useState(soundManager.getBgmVolume() * 100)
  const [sfxVol, setSfxVol] = useState(soundManager.getSfxVolume() * 100)
  const [muted, setMuted] = useState(soundManager.isMuted())

  const handleBgmChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    setBgmVol(val)
    soundManager.setBgmVolume(val / 100)
  }, [])

  const handleSfxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    setSfxVol(val)
    soundManager.setSfxVolume(val / 100)
  }, [])

  const handleMute = useCallback(() => {
    const newMuted = soundManager.toggleMute()
    setMuted(newMuted)
  }, [])

  const handleToggle = useCallback(() => {
    soundManager.init() // Unlock audio on first interaction
    setOpen(prev => !prev)
  }, [])

  return (
    <div style={styles.wrapper}>
      <button
        onClick={handleToggle}
        style={{ ...gameButton, ...interactive, ...styles.toggleBtn }}
        title="Sound Settings"
      >
        {muted ? '🔇' : '🔊'}
      </button>

      {open && (
        <div style={{ ...glassPanel, ...styles.panel }}>
          <div style={styles.header}>
            <span style={styles.title}>Sound</span>
            <button onClick={() => setOpen(false)} style={styles.closeBtn}>×</button>
          </div>

          <div style={styles.row}>
            <span style={styles.label}>🎵 BGM</span>
            <input
              type="range"
              min={0}
              max={100}
              value={bgmVol}
              onChange={handleBgmChange}
              style={styles.slider}
            />
            <span style={styles.value}>{Math.round(bgmVol)}%</span>
          </div>

          <div style={styles.row}>
            <span style={styles.label}>🔊 SFX</span>
            <input
              type="range"
              min={0}
              max={100}
              value={sfxVol}
              onChange={handleSfxChange}
              style={styles.slider}
            />
            <span style={styles.value}>{Math.round(sfxVol)}%</span>
          </div>

          <button
            onClick={handleMute}
            style={{ ...gameButton, ...interactive, ...styles.muteBtn }}
          >
            {muted ? '🔇 Unmute' : '🔊 Mute All'}
          </button>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: 'absolute',
    top: 12,
    right: 56,
    zIndex: 310,
    pointerEvents: 'auto' as const,
  },
  toggleBtn: {
    width: 36,
    height: 36,
    fontSize: 16,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  panel: {
    position: 'absolute',
    top: 44,
    right: 0,
    width: 240,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 13,
    fontWeight: 'bold',
    color: OV.text,
    fontFamily: OV.font,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: 20,
    color: OV.textDim,
    cursor: 'pointer',
    lineHeight: 1,
    padding: 0,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 11,
    color: OV.textDim,
    fontFamily: OV.font,
    width: 42,
    flexShrink: 0,
  },
  slider: {
    flex: 1,
    height: 4,
    accentColor: OV.accent,
    cursor: 'pointer',
  },
  value: {
    fontSize: 10,
    color: OV.textMuted,
    fontFamily: OV.font,
    width: 30,
    textAlign: 'right' as const,
  },
  muteBtn: {
    width: '100%',
    padding: '6px 0',
    fontSize: 11,
    marginTop: 2,
  },
}
