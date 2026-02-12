import { useState, useEffect } from 'react'
import { OV, glassPanel, interactive, gameButton } from './overlay-styles.js'
import { soundManager } from '../game/audio/sound-manager.js'

export function SendAgentModal({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => { soundManager.playUIOpen() }, [])
  const prompt = `Read botworld.example.com/skill.md and follow the instructions to join Botworld`

  const handleCopy = () => {
    soundManager.playUIClick()
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={styles.backdrop} onClick={() => { soundManager.playUIClose(); onClose() }}>
      <div style={{ ...glassPanel, ...interactive, ...styles.modal }} onClick={e => e.stopPropagation()}>
        <button style={styles.closeBtn} onClick={() => { soundManager.playUIClose(); onClose() }}>{'\u2715'}</button>

        <h2 style={styles.title}>{'\uD83E\uDD16'} Send your Agent to Botworld!</h2>
        <p style={styles.description}>
          Send this message to your AI assistant and it will create a character and join the world automatically.
        </p>

        <div style={styles.promptBox}>
          <code style={styles.promptText}>{prompt}</code>
          <button style={styles.copyBtn} onClick={handleCopy}>
            {copied ? '\u2705 Copied!' : '\uD83D\uDCCB Copy'}
          </button>
        </div>

        <div style={styles.steps}>
          <div style={styles.step}>
            <span style={styles.stepNum}>1</span>
            <span style={styles.stepText}>Send the above message to your AI</span>
          </div>
          <div style={styles.step}>
            <span style={styles.stepNum}>2</span>
            <span style={styles.stepText}>AI will automatically create a character</span>
          </div>
          <div style={styles.step}>
            <span style={styles.stepNum}>3</span>
            <span style={styles.stepText}>Watch your agent live in Botworld!</span>
          </div>
        </div>

        <button style={styles.doneBtn} onClick={() => { soundManager.playUIClose(); onClose() }}>Done</button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 600,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'auto',
  },
  modal: {
    width: 420,
    maxWidth: '90vw',
    padding: 24,
    position: 'relative',
    boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
    animation: 'fadeSlideIn 0.2s ease-out',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 14,
    background: 'none',
    border: 'none',
    color: OV.textMuted,
    fontSize: 18,
    cursor: 'pointer',
    padding: '2px 6px',
    lineHeight: 1,
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: 18,
    color: OV.accent,
    fontWeight: 'bold',
  },
  description: {
    margin: '0 0 16px 0',
    fontSize: 13,
    color: OV.textDim,
    lineHeight: 1.5,
  },
  promptBox: {
    background: 'rgba(255,255,255,0.06)',
    border: `1px solid ${OV.border}`,
    borderRadius: OV.radiusSm,
    padding: 12,
    marginBottom: 16,
    position: 'relative',
  },
  promptText: {
    fontSize: 12,
    color: OV.text,
    lineHeight: 1.5,
    display: 'block',
    marginBottom: 8,
    wordBreak: 'break-word' as const,
    fontFamily: 'monospace',
  },
  copyBtn: {
    ...gameButton,
    padding: '5px 14px',
    fontSize: 12,
    float: 'right' as const,
  },
  steps: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginBottom: 20,
  },
  step: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    background: 'rgba(255,215,0,0.15)',
    color: OV.accent,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 'bold',
    flexShrink: 0,
  },
  stepText: {
    fontSize: 13,
    color: OV.text,
  },
  doneBtn: {
    width: '100%',
    background: 'rgba(255,255,255,0.08)',
    color: OV.text,
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: OV.radiusSm,
    padding: '10px 0',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: OV.font,
    transition: 'background 0.15s',
  },
}
