/**
 * SoundManager - coordinates BGM and SFX playback.
 * Persists volume preferences to localStorage.
 */

import type { TimeOfDay } from '@botworld/shared'
import {
  resumeAudio,
  startBgm, stopBgm, setBgmVolume, getCurrentTrack,
  playFootstep, playGather, playCraft, playAttack,
  playDamageHit, playMonsterDie, playCoinTrade, playLevelUp,
  playFireCrackle, playThunder,
  startRainAmbient, stopRainAmbient, setRainVolume,
  startWindAmbient, stopWindAmbient, setWindVolume,
  type BgmTrack,
} from './synth.js'

// ── Storage keys ──

const STORAGE_KEY_BGM = 'botworld:bgm_volume'
const STORAGE_KEY_SFX = 'botworld:sfx_volume'
const STORAGE_KEY_MUTED = 'botworld:muted'

// ── SoundManager ──

export class SoundManager {
  private bgmVolume: number
  private sfxVolume: number
  private muted: boolean
  private initialized = false
  private nearPoi = false
  private inCombat = false
  private currentTimeOfDay: TimeOfDay = 'morning'

  constructor() {
    this.bgmVolume = this.loadNumber(STORAGE_KEY_BGM, 0.3)
    this.sfxVolume = this.loadNumber(STORAGE_KEY_SFX, 0.5)
    this.muted = localStorage.getItem(STORAGE_KEY_MUTED) === 'true'
  }

  /** Must be called on first user interaction to unlock Web Audio */
  init(): void {
    if (this.initialized) return
    this.initialized = true
    resumeAudio()
  }

  // ── Volume Controls ──

  getBgmVolume(): number { return this.bgmVolume }
  getSfxVolume(): number { return this.sfxVolume }
  isMuted(): boolean { return this.muted }

  setBgmVolume(value: number): void {
    this.bgmVolume = Math.max(0, Math.min(1, value))
    localStorage.setItem(STORAGE_KEY_BGM, String(this.bgmVolume))
    if (!this.muted) {
      setBgmVolume(this.bgmVolume)
      setRainVolume(this.bgmVolume)
      setWindVolume(this.bgmVolume)
    }
  }

  setSfxVolume(value: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, value))
    localStorage.setItem(STORAGE_KEY_SFX, String(this.sfxVolume))
  }

  toggleMute(): boolean {
    this.muted = !this.muted
    localStorage.setItem(STORAGE_KEY_MUTED, String(this.muted))

    if (this.muted) {
      stopBgm()
      stopRainAmbient()
      stopWindAmbient()
    } else {
      this.updateBgm()
    }
    return this.muted
  }

  // ── BGM Logic ──

  /** Called when time of day changes */
  onTimeChange(timeOfDay: TimeOfDay): void {
    this.currentTimeOfDay = timeOfDay
    this.updateBgm()
  }

  /** Called when agent enters/exits POI proximity */
  setNearPoi(near: boolean): void {
    if (this.nearPoi === near) return
    this.nearPoi = near
    this.updateBgm()
  }

  /** Called when combat starts/ends */
  setCombat(active: boolean): void {
    if (this.inCombat === active) return
    this.inCombat = active
    this.updateBgm()
  }

  private updateBgm(): void {
    if (!this.initialized || this.muted) return

    let track: BgmTrack
    if (this.inCombat) {
      track = 'combat'
    } else if (this.nearPoi) {
      track = 'town'
    } else {
      const nightTimes: TimeOfDay[] = ['evening', 'night']
      track = nightTimes.includes(this.currentTimeOfDay) ? 'night' : 'day'
    }

    if (getCurrentTrack() !== track) {
      startBgm(track, this.bgmVolume)
    }
  }

  // ── SFX ──

  playFootstep(tileType: string): void {
    if (this.muted || !this.initialized) return
    const variant = tileType === 'water' || tileType === 'swamp' ? 'water'
      : tileType === 'road' || tileType === 'mountain' || tileType === 'stone' ? 'stone'
      : 'grass'
    playFootstep(variant)
  }

  playGather(resourceType: string): void {
    if (this.muted || !this.initialized) return
    const variant = resourceType.includes('stone') || resourceType.includes('ore') ? 'stone'
      : resourceType.includes('herb') || resourceType.includes('flower') ? 'herb'
      : 'wood'
    playGather(variant)
  }

  playCraft(type: string): void {
    if (this.muted || !this.initialized) return
    const variant = type.includes('potion') || type.includes('brew') ? 'potion' : 'anvil'
    playCraft(variant)
  }

  playAttack(): void {
    if (this.muted || !this.initialized) return
    playAttack(Math.random() > 0.5 ? 'sword' : 'magic')
  }

  playDamageHit(): void {
    if (this.muted || !this.initialized) return
    playDamageHit()
  }

  playMonsterDie(): void {
    if (this.muted || !this.initialized) return
    playMonsterDie()
  }

  playTrade(): void {
    if (this.muted || !this.initialized) return
    playCoinTrade()
  }

  playLevelUp(): void {
    if (this.muted || !this.initialized) return
    playLevelUp()
  }

  playFireCrackle(): void {
    if (this.muted || !this.initialized) return
    playFireCrackle()
  }

  playThunder(): void {
    if (this.muted || !this.initialized) return
    playThunder()
  }

  // ── Weather Ambient ──

  startRain(): void {
    if (this.muted || !this.initialized) return
    startRainAmbient(this.bgmVolume)
  }

  stopRain(): void {
    stopRainAmbient()
  }

  startWind(): void {
    if (this.muted || !this.initialized) return
    startWindAmbient(this.bgmVolume)
  }

  stopWind(): void {
    stopWindAmbient()
  }

  // ── Cleanup ──

  destroy(): void {
    stopBgm()
    stopRainAmbient()
    stopWindAmbient()
  }

  // ── Helpers ──

  private loadNumber(key: string, defaultVal: number): number {
    const stored = localStorage.getItem(key)
    if (stored === null) return defaultVal
    const parsed = parseFloat(stored)
    return isNaN(parsed) ? defaultVal : Math.max(0, Math.min(1, parsed))
  }
}

/** Singleton instance */
export const soundManager = new SoundManager()
