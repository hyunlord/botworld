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
  playUIClick, playUIHover, playUIOpen, playUIClose,
  playUINotification, playBattleStart, playRareItem,
  playBowShot, playShieldBlock, playMagicCast, playExplosion,
  playSpeechBubble, playLegendaryCraft, playEventAlarm, playHealSpell,
  startAmbientLayer, stopAmbientLayer, stopAllAmbientLayers, setAmbientVolume,
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
  private currentBiome = ''
  private currentSeason = 'spring'
  private inBossCombat = false
  private inEvent = false

  constructor() {
    this.bgmVolume = this.loadNumber(STORAGE_KEY_BGM, 0.3)
    this.sfxVolume = this.loadNumber(STORAGE_KEY_SFX, 0.3)
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
      setAmbientVolume(this.bgmVolume)
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
      stopAllAmbientLayers()
    } else {
      this.updateBgm()
      this.updateAmbientLayers(this.currentBiome, this.currentTimeOfDay === 'evening' || this.currentTimeOfDay === 'night')
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

  /** Called when camera moves to different biome area */
  onBiomeChange(biome: string, isNight: boolean): void {
    if (this.currentBiome === biome) return
    this.currentBiome = biome
    this.updateBgm()
    this.updateAmbientLayers(biome, isNight)
  }

  /** Called when season changes */
  onSeasonChange(season: string): void {
    this.currentSeason = season
    this.updateBgm()
  }

  /** Called when boss combat starts/ends */
  setBossCombat(active: boolean): void {
    if (this.inBossCombat === active) return
    this.inBossCombat = active
    this.updateBgm()
  }

  /** Called when event starts/ends */
  setEventActive(active: boolean): void {
    if (this.inEvent === active) return
    this.inEvent = active
    this.updateBgm()
  }

  private updateBgm(): void {
    if (!this.initialized || this.muted) return

    let track: BgmTrack
    // Priority order
    if (this.inBossCombat) {
      track = 'boss'
    } else if (this.inCombat) {
      track = 'combat'
    } else if (this.inEvent) {
      track = 'event'
    } else if (this.nearPoi) {
      track = 'town'
    } else if (this.currentBiome === 'forest' || this.currentBiome === 'dense_forest') {
      track = 'forest'
    } else if (this.currentSeason === 'winter') {
      track = 'winter'
    } else {
      const nightTimes: TimeOfDay[] = ['evening', 'night']
      track = nightTimes.includes(this.currentTimeOfDay) ? 'night' : 'day'
    }

    if (getCurrentTrack() !== track) {
      startBgm(track, this.bgmVolume)
    }
  }

  private updateAmbientLayers(biome: string, isNight: boolean): void {
    stopAllAmbientLayers()
    if (this.muted || !this.initialized) return

    const vol = this.bgmVolume

    switch (biome) {
      case 'grass':
      case 'meadow':
      case 'plains':
        startAmbientLayer('birds', 'birds', vol)
        startAmbientLayer('insects', 'insects', vol)
        startAmbientLayer('wind', 'wind', vol)
        break
      case 'forest':
      case 'dense_forest':
        startAmbientLayer('birds', 'birds', vol)
        if (isNight) startAmbientLayer('insects', 'insects', vol)
        break
      case 'water':
      case 'river':
      case 'beach':
        startAmbientLayer('water', 'water', vol)
        if (isNight) startAmbientLayer('frogs', 'frogs', vol)
        break
      case 'mountain':
      case 'cliff':
        startAmbientLayer('wind', 'wind', vol)
        break
      case 'cave':
        startAmbientLayer('drip', 'cave_drip', vol)
        break
      case 'snow':
      case 'tundra':
        startAmbientLayer('wind', 'wind', vol)
        break
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

  // ── UI SFX ──

  playUIClick(): void {
    if (this.muted || !this.initialized) return
    playUIClick(this.sfxVolume)
  }

  playUIHover(): void {
    if (this.muted || !this.initialized) return
    playUIHover(this.sfxVolume)
  }

  playUIOpen(): void {
    if (this.muted || !this.initialized) return
    playUIOpen(this.sfxVolume)
  }

  playUIClose(): void {
    if (this.muted || !this.initialized) return
    playUIClose(this.sfxVolume)
  }

  playUINotification(): void {
    if (this.muted || !this.initialized) return
    playUINotification(this.sfxVolume)
  }

  playBattleStart(): void {
    if (this.muted || !this.initialized) return
    playBattleStart(this.sfxVolume)
  }

  playRareItem(): void {
    if (this.muted || !this.initialized) return
    playRareItem(this.sfxVolume)
  }

  playBowShot(): void {
    if (this.muted || !this.initialized) return
    playBowShot(this.sfxVolume)
  }

  playShieldBlock(): void {
    if (this.muted || !this.initialized) return
    playShieldBlock(this.sfxVolume)
  }

  playMagicCast(): void {
    if (this.muted || !this.initialized) return
    playMagicCast(this.sfxVolume)
  }

  playExplosion(): void {
    if (this.muted || !this.initialized) return
    playExplosion(this.sfxVolume)
  }

  playSpeechBubble(): void {
    if (this.muted || !this.initialized) return
    playSpeechBubble(this.sfxVolume)
  }

  playLegendaryCraft(): void {
    if (this.muted || !this.initialized) return
    playLegendaryCraft(this.sfxVolume)
  }

  playEventAlarm(): void {
    if (this.muted || !this.initialized) return
    playEventAlarm(this.sfxVolume)
  }

  playHealSpell(): void {
    if (this.muted || !this.initialized) return
    playHealSpell(this.sfxVolume)
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
    stopAllAmbientLayers()
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
