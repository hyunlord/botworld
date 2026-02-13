/**
 * Procedural 8-bit audio synthesizer using Web Audio API.
 * Generates retro-style BGM loops and SFX without external audio files.
 */

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  return audioCtx
}

export function resumeAudio(): void {
  const ctx = getCtx()
  if (ctx.state === 'suspended') {
    ctx.resume()
  }
}

export function getAudioContext(): AudioContext {
  return getCtx()
}

// ── Utility ──

type WaveType = OscillatorType

function createOsc(
  ctx: AudioContext,
  type: WaveType,
  freq: number,
  gain: number,
  dest: AudioNode,
): { osc: OscillatorNode; gainNode: GainNode } {
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.value = freq
  const g = ctx.createGain()
  g.gain.value = gain
  osc.connect(g)
  g.connect(dest)
  return { osc, gainNode: g }
}

// ── SFX Generators ──

export function playFootstep(variant: 'grass' | 'stone' | 'water'): void {
  const ctx = getCtx()
  const now = ctx.currentTime
  const g = ctx.createGain()
  g.connect(ctx.destination)

  const freqMap = { grass: 200, stone: 400, water: 150 }
  const baseFreq = freqMap[variant] ?? 200

  const osc = ctx.createOscillator()
  osc.type = 'square'
  osc.frequency.setValueAtTime(baseFreq + Math.random() * 50, now)
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.06)
  osc.connect(g)

  g.gain.setValueAtTime(0.08, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.08)

  osc.start(now)
  osc.stop(now + 0.08)
}

export function playGather(resource: 'wood' | 'stone' | 'herb'): void {
  const ctx = getCtx()
  const now = ctx.currentTime
  const g = ctx.createGain()
  g.connect(ctx.destination)

  const configs = {
    wood: { freq: 300, type: 'sawtooth' as WaveType, dur: 0.12 },
    stone: { freq: 500, type: 'square' as WaveType, dur: 0.08 },
    herb: { freq: 600, type: 'sine' as WaveType, dur: 0.15 },
  }
  const cfg = configs[resource] ?? configs.wood

  const osc = ctx.createOscillator()
  osc.type = cfg.type
  osc.frequency.setValueAtTime(cfg.freq, now)
  osc.frequency.exponentialRampToValueAtTime(cfg.freq * 0.5, now + cfg.dur)
  osc.connect(g)

  g.gain.setValueAtTime(0.12, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + cfg.dur)

  osc.start(now)
  osc.stop(now + cfg.dur)
}

export function playCraft(type: 'anvil' | 'potion'): void {
  const ctx = getCtx()
  const now = ctx.currentTime
  const g = ctx.createGain()
  g.connect(ctx.destination)

  if (type === 'anvil') {
    // Metallic clang
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.1
      const osc = ctx.createOscillator()
      osc.type = 'square'
      osc.frequency.setValueAtTime(800 + i * 100, t)
      osc.frequency.exponentialRampToValueAtTime(200, t + 0.08)
      osc.connect(g)
      osc.start(t)
      osc.stop(t + 0.08)
    }
    g.gain.setValueAtTime(0.1, now)
    g.gain.linearRampToValueAtTime(0, now + 0.35)
  } else {
    // Bubbly potion
    for (let i = 0; i < 5; i++) {
      const t = now + i * 0.06
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(400 + Math.random() * 400, t)
      osc.frequency.exponentialRampToValueAtTime(200, t + 0.05)
      osc.connect(g)
      osc.start(t)
      osc.stop(t + 0.05)
    }
    g.gain.setValueAtTime(0.08, now)
    g.gain.linearRampToValueAtTime(0, now + 0.35)
  }
}

export function playAttack(type: 'sword' | 'magic'): void {
  const ctx = getCtx()
  const now = ctx.currentTime
  const g = ctx.createGain()
  g.connect(ctx.destination)

  if (type === 'sword') {
    // Swoosh + hit
    const noise = createNoiseBurst(ctx, 0.06, now)
    noise.connect(g)

    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(600, now)
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.1)
    osc.connect(g)
    osc.start(now)
    osc.stop(now + 0.1)

    g.gain.setValueAtTime(0.15, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
  } else {
    // Magic sparkle
    for (let i = 0; i < 4; i++) {
      const t = now + i * 0.04
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(800 + i * 200, t)
      osc.frequency.exponentialRampToValueAtTime(1200 + i * 100, t + 0.08)
      osc.connect(g)
      osc.start(t)
      osc.stop(t + 0.08)
    }
    g.gain.setValueAtTime(0.1, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
  }
}

export function playDamageHit(): void {
  const ctx = getCtx()
  const now = ctx.currentTime
  const g = ctx.createGain()
  g.connect(ctx.destination)

  const noise = createNoiseBurst(ctx, 0.08, now)
  noise.connect(g)

  const osc = ctx.createOscillator()
  osc.type = 'square'
  osc.frequency.setValueAtTime(150, now)
  osc.frequency.exponentialRampToValueAtTime(50, now + 0.1)
  osc.connect(g)
  osc.start(now)
  osc.stop(now + 0.1)

  g.gain.setValueAtTime(0.15, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
}

export function playMonsterDie(): void {
  const ctx = getCtx()
  const now = ctx.currentTime
  const g = ctx.createGain()
  g.connect(ctx.destination)

  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(400, now)
  osc.frequency.exponentialRampToValueAtTime(30, now + 0.4)
  osc.connect(g)
  osc.start(now)
  osc.stop(now + 0.4)

  g.gain.setValueAtTime(0.12, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
}

export function playCoinTrade(): void {
  const ctx = getCtx()
  const now = ctx.currentTime
  const g = ctx.createGain()
  g.connect(ctx.destination)

  const notes = [800, 1000, 1200]
  for (let i = 0; i < notes.length; i++) {
    const t = now + i * 0.06
    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.setValueAtTime(notes[i], t)
    osc.connect(g)
    osc.start(t)
    osc.stop(t + 0.05)
  }
  g.gain.setValueAtTime(0.08, now)
  g.gain.linearRampToValueAtTime(0, now + 0.25)
}

export function playLevelUp(): void {
  const ctx = getCtx()
  const now = ctx.currentTime
  const g = ctx.createGain()
  g.connect(ctx.destination)

  // Ascending fanfare arpeggio
  const notes = [523, 659, 784, 1047] // C5 E5 G5 C6
  for (let i = 0; i < notes.length; i++) {
    const t = now + i * 0.12
    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.setValueAtTime(notes[i], t)
    osc.connect(g)
    osc.start(t)
    osc.stop(t + 0.15)
  }

  // Final chord
  const chordTime = now + 0.48
  for (const freq of [523, 659, 784]) {
    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.setValueAtTime(freq, chordTime)
    osc.connect(g)
    osc.start(chordTime)
    osc.stop(chordTime + 0.5)
  }

  g.gain.setValueAtTime(0.1, now)
  g.gain.setValueAtTime(0.12, now + 0.48)
  g.gain.exponentialRampToValueAtTime(0.001, now + 1.0)
}

// ── Noise helper ──

function createNoiseBurst(ctx: AudioContext, duration: number, startTime: number): AudioNode {
  const bufferSize = Math.ceil(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1
  }
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.start(startTime)
  source.stop(startTime + duration)
  return source
}

// ── Weather ambient ──

let rainSource: { source: AudioBufferSourceNode; gain: GainNode } | null = null
let windSource: { osc: OscillatorNode; gain: GainNode } | null = null

export function startRainAmbient(volume: number): void {
  if (rainSource) return
  const ctx = getCtx()

  // Continuous noise for rain
  const bufferSize = ctx.sampleRate * 2
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.3
  }

  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true

  // Low-pass filter for rain texture
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 3000

  const gain = ctx.createGain()
  gain.gain.value = volume * 0.15

  source.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  source.start()

  rainSource = { source, gain }
}

export function stopRainAmbient(): void {
  if (rainSource) {
    rainSource.source.stop()
    rainSource = null
  }
}

export function setRainVolume(volume: number): void {
  if (rainSource) {
    rainSource.gain.gain.value = volume * 0.15
  }
}

export function playThunder(): void {
  const ctx = getCtx()
  const now = ctx.currentTime
  const g = ctx.createGain()
  g.connect(ctx.destination)

  // Low rumble
  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(60, now)
  osc.frequency.exponentialRampToValueAtTime(20, now + 0.8)
  osc.connect(g)
  osc.start(now)
  osc.stop(now + 0.8)

  // Noise crack
  const noise = createNoiseBurst(ctx, 0.3, now)
  noise.connect(g)

  g.gain.setValueAtTime(0.2, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.8)
}

export function startWindAmbient(volume: number): void {
  if (windSource) return
  const ctx = getCtx()

  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = 200

  // LFO for wind modulation
  const lfo = ctx.createOscillator()
  lfo.type = 'sine'
  lfo.frequency.value = 0.3
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = 100
  lfo.connect(lfoGain)
  lfoGain.connect(osc.frequency)
  lfo.start()

  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 400
  filter.Q.value = 0.5

  const gain = ctx.createGain()
  gain.gain.value = volume * 0.05

  osc.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  osc.start()

  windSource = { osc, gain }
}

export function stopWindAmbient(): void {
  if (windSource) {
    windSource.osc.stop()
    windSource = null
  }
}

export function setWindVolume(volume: number): void {
  if (windSource) {
    windSource.gain.gain.value = volume * 0.05
  }
}

export function playFireCrackle(): void {
  const ctx = getCtx()
  const now = ctx.currentTime
  const g = ctx.createGain()
  g.connect(ctx.destination)

  for (let i = 0; i < 3; i++) {
    const t = now + Math.random() * 0.1
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(100 + Math.random() * 200, t)
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.03)
    osc.connect(g)
    osc.start(t)
    osc.stop(t + 0.03)
  }

  g.gain.setValueAtTime(0.06, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
}

// ── UI Sound Effects ──

export function playUIClick(volume = 1): void {
  const ctx = getCtx()
  const now = ctx.currentTime
  const g = ctx.createGain()
  g.connect(ctx.destination)

  const osc = ctx.createOscillator()
  osc.type = 'square'
  osc.frequency.setValueAtTime(1200, now)
  osc.frequency.exponentialRampToValueAtTime(600, now + 0.04)
  osc.connect(g)

  g.gain.setValueAtTime(0.08 * volume, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.05)

  osc.start(now)
  osc.stop(now + 0.05)
}

export function playUIHover(volume = 1): void {
  const ctx = getCtx()
  const now = ctx.currentTime
  const g = ctx.createGain()
  g.connect(ctx.destination)

  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(800, now)
  osc.connect(g)

  g.gain.setValueAtTime(0.03 * volume, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.03)

  osc.start(now)
  osc.stop(now + 0.03)
}

export function playUIOpen(volume = 1): void {
  const ctx = getCtx()
  const now = ctx.currentTime
  const g = ctx.createGain()
  g.connect(ctx.destination)

  // Rising two-tone chime
  const notes = [600, 900]
  for (let i = 0; i < notes.length; i++) {
    const t = now + i * 0.06
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(notes[i], t)
    osc.connect(g)
    osc.start(t)
    osc.stop(t + 0.08)
  }

  g.gain.setValueAtTime(0.06 * volume, now)
  g.gain.linearRampToValueAtTime(0, now + 0.15)
}

export function playUIClose(volume = 1): void {
  const ctx = getCtx()
  const now = ctx.currentTime
  const g = ctx.createGain()
  g.connect(ctx.destination)

  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(800, now)
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.08)
  osc.connect(g)

  g.gain.setValueAtTime(0.05 * volume, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.1)

  osc.start(now)
  osc.stop(now + 0.1)
}

export function playUINotification(volume = 1): void {
  const ctx = getCtx()
  const now = ctx.currentTime
  const g = ctx.createGain()
  g.connect(ctx.destination)

  // Two-tone ding (bell-like)
  const notes = [880, 1320] // A5, E6
  for (let i = 0; i < notes.length; i++) {
    const t = now + i * 0.08
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(notes[i], t)
    osc.connect(g)
    osc.start(t)
    osc.stop(t + 0.12)
  }

  g.gain.setValueAtTime(0.07 * volume, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
}

export function playBattleStart(volume = 1): void {
  const ctx = getCtx()
  const now = ctx.currentTime
  const g = ctx.createGain()
  g.connect(ctx.destination)

  // War horn - low brass
  const horn = ctx.createOscillator()
  horn.type = 'sawtooth'
  horn.frequency.setValueAtTime(130, now)
  horn.frequency.linearRampToValueAtTime(165, now + 0.3)
  horn.connect(g)
  horn.start(now)
  horn.stop(now + 0.4)

  // Drum hit
  const drum = ctx.createOscillator()
  drum.type = 'sine'
  drum.frequency.setValueAtTime(80, now)
  drum.frequency.exponentialRampToValueAtTime(30, now + 0.15)
  drum.connect(g)
  drum.start(now)
  drum.stop(now + 0.15)

  g.gain.setValueAtTime(0.15 * volume, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
}

export function playRareItem(volume = 1): void {
  const ctx = getCtx()
  const now = ctx.currentTime
  const g = ctx.createGain()
  g.connect(ctx.destination)

  // Sparkle ascending arpeggio
  const notes = [880, 1109, 1319, 1760] // A5, C#6, E6, A6
  for (let i = 0; i < notes.length; i++) {
    const t = now + i * 0.08
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(notes[i], t)
    osc.connect(g)
    osc.start(t)
    osc.stop(t + 0.12)
  }

  g.gain.setValueAtTime(0.1 * volume, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
}

export function playBowShot(volume = 1): void {
  const ctx = getCtx()
  const now = ctx.currentTime
  const g = ctx.createGain()
  g.connect(ctx.destination)

  // High swoosh
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(600, now)
  osc.frequency.exponentialRampToValueAtTime(1500, now + 0.1)
  osc.connect(g)

  g.gain.setValueAtTime(0.1 * volume, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.1)

  osc.start(now)
  osc.stop(now + 0.1)
}

export function playShieldBlock(volume = 1): void {
  const ctx = getCtx()
  const now = ctx.currentTime
  const g = ctx.createGain()
  g.connect(ctx.destination)

  // Metallic clang
  const osc = ctx.createOscillator()
  osc.type = 'square'
  osc.frequency.value = 1000
  osc.connect(g)
  osc.start(now)
  osc.stop(now + 0.08)

  // Noise component
  const noise = createNoiseBurst(ctx, 0.08, now)
  noise.connect(g)

  g.gain.setValueAtTime(0.12 * volume, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
}

export function playMagicCast(volume = 1): void {
  const ctx = getCtx()
  const now = ctx.currentTime
  const g = ctx.createGain()
  g.connect(ctx.destination)

  // Rising sparkle arpeggio
  const freqs = [400, 600, 800, 1000, 1200, 1400, 1600]
  for (let i = 0; i < freqs.length; i++) {
    const t = now + i * 0.043
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freqs[i]
    osc.connect(g)
    osc.start(t)
    osc.stop(t + 0.06)
  }

  g.gain.setValueAtTime(0.08 * volume, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
}

export function playExplosion(volume = 1): void {
  const ctx = getCtx()
  const now = ctx.currentTime
  const g = ctx.createGain()
  g.connect(ctx.destination)

  // Noise burst
  const noise = createNoiseBurst(ctx, 0.3, now)
  noise.connect(g)

  // Low rumble
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(40, now)
  osc.frequency.exponentialRampToValueAtTime(20, now + 0.5)
  osc.connect(g)
  osc.start(now)
  osc.stop(now + 0.5)

  g.gain.setValueAtTime(0.15 * volume, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
}

export function playSpeechBubble(volume = 1): void {
  const ctx = getCtx()
  const now = ctx.currentTime
  const g = ctx.createGain()
  g.connect(ctx.destination)

  // Soft pop
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(500, now)
  osc.frequency.exponentialRampToValueAtTime(300, now + 0.04)
  osc.connect(g)

  g.gain.setValueAtTime(0.05 * volume, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.04)

  osc.start(now)
  osc.stop(now + 0.04)
}

export function playLegendaryCraft(volume = 1): void {
  const ctx = getCtx()
  const now = ctx.currentTime
  const g = ctx.createGain()
  g.connect(ctx.destination)

  // Grand arpeggio: C4->E4->G4->C5->E5->G5->C6
  const notes = [262, 330, 392, 523, 659, 784, 1047]
  for (let i = 0; i < notes.length; i++) {
    const t = now + i * 0.17
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = notes[i]
    osc.connect(g)
    osc.start(t)
    osc.stop(t + 0.2)
  }

  // Sustained chord at the end
  const chordTime = now + 1.2
  for (const freq of [523, 659, 784, 1047]) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    osc.connect(g)
    osc.start(chordTime)
    osc.stop(chordTime + 1.0)
  }

  g.gain.setValueAtTime(0.12 * volume, now)
  g.gain.setValueAtTime(0.15 * volume, chordTime)
  g.gain.exponentialRampToValueAtTime(0.001, chordTime + 1.0)
}

export function playEventAlarm(volume = 1): void {
  const ctx = getCtx()
  const now = ctx.currentTime
  const g = ctx.createGain()
  g.connect(ctx.destination)

  // Bell chime: two hits with reverb-like decay
  for (let i = 0; i < 2; i++) {
    const t = now + i * 0.3
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 1047 // C6
    osc.connect(g)
    osc.start(t)
    osc.stop(t + 0.4)
  }

  g.gain.setValueAtTime(0.1 * volume, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.6)
}

export function playHealSpell(volume = 1): void {
  const ctx = getCtx()
  const now = ctx.currentTime
  const g = ctx.createGain()
  g.connect(ctx.destination)

  // Gentle ascending glissando
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(300, now)
  osc.frequency.exponentialRampToValueAtTime(800, now + 0.4)
  osc.connect(g)

  g.gain.setValueAtTime(0.08 * volume, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.4)

  osc.start(now)
  osc.stop(now + 0.4)
}

// ── BGM Generator ──

export type BgmTrack = 'day' | 'night' | 'combat' | 'town' | 'forest' | 'boss' | 'event' | 'winter'

interface BgmState {
  oscillators: OscillatorNode[]
  gains: GainNode[]
  masterGain: GainNode
  interval: ReturnType<typeof setInterval>
}

let currentBgm: BgmState | null = null
let currentTrack: BgmTrack | null = null

// Musical scales (MIDI-like note frequencies)
const NOTE_FREQS: Record<string, number> = {
  C3: 131, D3: 147, E3: 165, F3: 175, G3: 196, A3: 220, B3: 247,
  C4: 262, D4: 294, E4: 330, F4: 349, G4: 392, A4: 440, B4: 494,
  C5: 523, D5: 587, E5: 659, F5: 698, G5: 784, A5: 880,
}

const BGM_PATTERNS: Record<BgmTrack, { notes: string[][]; tempo: number; wave: WaveType; bass: string[][] }> = {
  day: {
    notes: [
      ['C4', 'E4'], ['G4', 'E4'], ['A4', 'G4'], ['G4', 'E4'],
      ['F4', 'A4'], ['E4', 'G4'], ['D4', 'F4'], ['C4', 'E4'],
    ],
    bass: [['C3'], ['G3'], ['A3'], ['G3'], ['F3'], ['E3'], ['D3'], ['C3']],
    tempo: 400,
    wave: 'square',
  },
  night: {
    notes: [
      ['E4'], ['G4'], ['A4'], ['G4'],
      ['E4'], ['D4'], ['C4'], ['D4'],
    ],
    bass: [['C3'], ['E3'], ['A3'], ['E3'], ['C3'], ['D3'], ['C3'], ['D3']],
    tempo: 600,
    wave: 'sine',
  },
  combat: {
    notes: [
      ['E4', 'G4'], ['E4', 'G4'], ['F4', 'A4'], ['E4', 'G4'],
      ['D4', 'F4'], ['D4', 'F4'], ['E4', 'G4'], ['C4', 'E4'],
    ],
    bass: [['E3'], ['E3'], ['F3'], ['E3'], ['D3'], ['D3'], ['E3'], ['C3']],
    tempo: 250,
    wave: 'sawtooth',
  },
  town: {
    notes: [
      ['C4', 'E4'], ['D4', 'F4'], ['E4', 'G4'], ['F4', 'A4'],
      ['E4', 'G4'], ['D4', 'F4'], ['C4', 'E4'], ['D4', 'G4'],
    ],
    bass: [['C3'], ['D3'], ['E3'], ['F3'], ['E3'], ['D3'], ['C3'], ['G3']],
    tempo: 450,
    wave: 'triangle',
  },
  forest: {
    notes: [
      ['E4'], ['G4'], ['B4'], ['D5'],
      ['B4'], ['G4'], ['E4'], ['G4'],
    ],
    bass: [['E3'], ['B3'], ['A3'], ['B3'], ['E3'], ['B3'], ['A3'], ['E3']],
    tempo: 550,
    wave: 'sine',
  },
  boss: {
    notes: [
      ['D4', 'F4'], ['D4', 'F4'], ['A4', 'C5'], ['D4', 'F4'],
      ['F4', 'A4'], ['F4', 'A4'], ['C5'], ['A4'],
    ],
    bass: [['D3'], ['D3'], ['A3'], ['D3'], ['F3'], ['F3'], ['A3'], ['D3']],
    tempo: 200,
    wave: 'sawtooth',
  },
  event: {
    notes: [
      ['C4', 'E4'], ['E4', 'G4'], ['G4', 'C5'], ['C5'],
      ['G4'], ['E4', 'G4'], ['C4', 'E4'], ['G4'],
    ],
    bass: [['C3'], ['G3'], ['C3'], ['G3'], ['C3'], ['G3'], ['C3'], ['G3']],
    tempo: 350,
    wave: 'triangle',
  },
  winter: {
    notes: [
      ['A4'], ['C5'], ['E5'], ['A4'],
      ['C5'], ['A4'], ['E5'], ['C5'],
    ],
    bass: [['A3'], ['E3'], ['C3'], ['A3'], ['E3'], ['A3'], ['C3'], ['E3']],
    tempo: 700,
    wave: 'sine',
  },
}

export function startBgm(track: BgmTrack, volume: number): void {
  if (currentTrack === track && currentBgm) return
  stopBgm()

  const ctx = getCtx()
  const pattern = BGM_PATTERNS[track]
  const masterGain = ctx.createGain()
  masterGain.gain.value = 0
  masterGain.connect(ctx.destination)

  // Fade in
  masterGain.gain.linearRampToValueAtTime(volume * 0.06, ctx.currentTime + 1.5)

  let step = 0
  const oscillators: OscillatorNode[] = []
  const gains: GainNode[] = []

  const interval = setInterval(() => {
    const noteGroup = pattern.notes[step % pattern.notes.length]
    const bassGroup = pattern.bass[step % pattern.bass.length]

    // Melody notes
    for (const note of noteGroup) {
      const freq = NOTE_FREQS[note]
      if (!freq) continue
      const { osc, gainNode } = createOsc(ctx, pattern.wave, freq, 0.12, masterGain)
      const now = ctx.currentTime
      gainNode.gain.setValueAtTime(0.12, now)
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + pattern.tempo / 1000 * 0.9)
      osc.start(now)
      osc.stop(now + pattern.tempo / 1000 * 0.95)
      oscillators.push(osc)
      gains.push(gainNode)
    }

    // Bass notes
    for (const note of bassGroup) {
      const freq = NOTE_FREQS[note]
      if (!freq) continue
      const { osc, gainNode } = createOsc(ctx, 'triangle', freq, 0.08, masterGain)
      const now = ctx.currentTime
      gainNode.gain.setValueAtTime(0.08, now)
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + pattern.tempo / 1000 * 0.9)
      osc.start(now)
      osc.stop(now + pattern.tempo / 1000 * 0.95)
      oscillators.push(osc)
      gains.push(gainNode)
    }

    step++

    // Cleanup old nodes
    while (oscillators.length > 32) {
      oscillators.shift()
      gains.shift()
    }
  }, pattern.tempo)

  currentBgm = { oscillators, gains, masterGain, interval }
  currentTrack = track
}

export function stopBgm(): void {
  if (!currentBgm) return

  const ctx = getCtx()
  const now = ctx.currentTime

  // Fade out
  currentBgm.masterGain.gain.linearRampToValueAtTime(0, now + 1.0)

  const state = currentBgm
  setTimeout(() => {
    clearInterval(state.interval)
    try {
      state.masterGain.disconnect()
    } catch { /* already disconnected */ }
  }, 1200)

  currentBgm = null
  currentTrack = null
}

export function setBgmVolume(volume: number): void {
  if (currentBgm) {
    const ctx = getCtx()
    currentBgm.masterGain.gain.linearRampToValueAtTime(volume * 0.06, ctx.currentTime + 0.3)
  }
}

export function getCurrentTrack(): BgmTrack | null {
  return currentTrack
}

// ── Ambient Layer System ──

interface AmbientLayer {
  source: OscillatorNode | AudioBufferSourceNode
  gain: GainNode
  filter?: BiquadFilterNode
  interval?: ReturnType<typeof setInterval>
}

const activeAmbientLayers: Map<string, AmbientLayer> = new Map()
const MAX_AMBIENT_LAYERS = 4

export type AmbientType = 'birds' | 'insects' | 'wind' | 'water' | 'crowd' | 'cave_drip' | 'fire' | 'frogs'

export function startAmbientLayer(id: string, type: AmbientType, volume: number): void {
  if (activeAmbientLayers.has(id)) return
  if (activeAmbientLayers.size >= MAX_AMBIENT_LAYERS) {
    console.warn(`Max ambient layers (${MAX_AMBIENT_LAYERS}) reached`)
    return
  }

  const ctx = getCtx()
  const masterGain = ctx.createGain()
  masterGain.gain.value = volume * 0.1
  masterGain.connect(ctx.destination)

  let layer: AmbientLayer

  switch (type) {
    case 'birds': {
      // Random high-frequency chirps
      const interval = setInterval(() => {
        const now = ctx.currentTime
        const freq = 1500 + Math.random() * 1500
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = freq
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.05, now)
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
        osc.connect(g)
        g.connect(masterGain)
        osc.start(now)
        osc.stop(now + 0.1)
      }, 2000 + Math.random() * 3000)

      layer = { source: ctx.createOscillator(), gain: masterGain, interval }
      layer.source.disconnect() // Placeholder, actual sound comes from interval
      break
    }

    case 'insects': {
      // Continuous high buzz with LFO
      const osc = ctx.createOscillator()
      osc.type = 'square'
      osc.frequency.value = 4000

      const lfo = ctx.createOscillator()
      lfo.type = 'sine'
      lfo.frequency.value = 10
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = 200
      lfo.connect(lfoGain)
      lfoGain.connect(osc.frequency)
      lfo.start()

      masterGain.gain.value = volume * 0.02
      osc.connect(masterGain)
      osc.start()

      layer = { source: osc, gain: masterGain }
      break
    }

    case 'wind': {
      // Low-pass filtered sine with slow LFO
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = 200

      const lfo = ctx.createOscillator()
      lfo.type = 'sine'
      lfo.frequency.value = 0.15
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = 80
      lfo.connect(lfoGain)
      lfoGain.connect(osc.frequency)
      lfo.start()

      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 300
      filter.Q.value = 0.5

      masterGain.gain.value = volume * 0.04
      osc.connect(filter)
      filter.connect(masterGain)
      osc.start()

      layer = { source: osc, gain: masterGain, filter }
      break
    }

    case 'water': {
      // Low-pass filtered noise
      const bufferSize = ctx.sampleRate * 2
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.3
      }

      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.loop = true

      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 1500

      masterGain.gain.value = volume * 0.08
      source.connect(filter)
      filter.connect(masterGain)
      source.start()

      layer = { source, gain: masterGain, filter }
      break
    }

    case 'crowd': {
      // Multiple overlapping low-frequency murmurs
      const oscs: OscillatorNode[] = []
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 200
      filter.Q.value = 1

      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = 100 + Math.random() * 200
        osc.connect(filter)
        osc.start()
        oscs.push(osc)
      }

      masterGain.gain.value = volume * 0.06
      filter.connect(masterGain)

      layer = { source: oscs[0], gain: masterGain, filter }
      break
    }

    case 'cave_drip': {
      // Random single sine pings
      const interval = setInterval(() => {
        const now = ctx.currentTime
        const freq = 800 + Math.random() * 400
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = freq
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.08, now)
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
        osc.connect(g)
        g.connect(masterGain)
        osc.start(now)
        osc.stop(now + 0.3)
      }, 3000 + Math.random() * 5000)

      layer = { source: ctx.createOscillator(), gain: masterGain, interval }
      layer.source.disconnect()
      break
    }

    case 'fire': {
      // Crackling noise bursts with bandpass filter
      const interval = setInterval(() => {
        const now = ctx.currentTime
        const bufferSize = Math.ceil(ctx.sampleRate * 0.08)
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
        const data = buffer.getChannelData(0)
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1
        }
        const source = ctx.createBufferSource()
        source.buffer = buffer

        const filter = ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.value = 200 + Math.random() * 600
        filter.Q.value = 2

        const g = ctx.createGain()
        g.gain.setValueAtTime(0.06, now)
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.08)

        source.connect(filter)
        filter.connect(g)
        g.connect(masterGain)
        source.start(now)
      }, 200 + Math.random() * 400)

      layer = { source: ctx.createOscillator(), gain: masterGain, interval }
      layer.source.disconnect()
      break
    }

    case 'frogs': {
      // Random low croaks
      const interval = setInterval(() => {
        const now = ctx.currentTime
        const freq = 150 + Math.random() * 100
        const osc = ctx.createOscillator()
        osc.type = 'square'
        osc.frequency.value = freq
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.06, now)
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
        osc.connect(g)
        g.connect(masterGain)
        osc.start(now)
        osc.stop(now + 0.15)
      }, 4000 + Math.random() * 6000)

      layer = { source: ctx.createOscillator(), gain: masterGain, interval }
      layer.source.disconnect()
      break
    }

    default:
      return
  }

  activeAmbientLayers.set(id, layer)
}

export function stopAmbientLayer(id: string): void {
  const layer = activeAmbientLayers.get(id)
  if (!layer) return

  const ctx = getCtx()
  const now = ctx.currentTime

  // Fade out
  layer.gain.gain.linearRampToValueAtTime(0, now + 0.5)

  setTimeout(() => {
    if (layer.interval) {
      clearInterval(layer.interval)
    }
    try {
      layer.source.stop()
    } catch { /* already stopped */ }
    try {
      layer.gain.disconnect()
    } catch { /* already disconnected */ }
    activeAmbientLayers.delete(id)
  }, 600)
}

export function stopAllAmbientLayers(): void {
  const ids = Array.from(activeAmbientLayers.keys())
  for (const id of ids) {
    stopAmbientLayer(id)
  }
}

export function setAmbientVolume(volume: number): void {
  for (const layer of activeAmbientLayers.values()) {
    const ctx = getCtx()
    layer.gain.gain.linearRampToValueAtTime(volume * 0.1, ctx.currentTime + 0.3)
  }
}
