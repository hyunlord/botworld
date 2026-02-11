import type { WeatherType, WeatherState, WeatherModifiers, WorldClock } from '@botworld/shared'
import { TICKS_PER_GAME_DAY } from '@botworld/shared'

/** Minimum ticks between weather changes (~1/3 of a game day) */
const MIN_CHANGE_INTERVAL = Math.floor(TICKS_PER_GAME_DAY / 3)
/** Maximum ticks between weather changes (~1/2 of a game day) */
const MAX_CHANGE_INTERVAL = Math.floor(TICKS_PER_GAME_DAY / 2)

/** Transition probabilities from current weather to next */
const TRANSITIONS: Record<WeatherType, Partial<Record<WeatherType, number>>> = {
  clear:  { clear: 30, cloudy: 40, fog: 15, rain: 10, snow: 5 },
  cloudy: { clear: 25, cloudy: 20, rain: 30, fog: 15, storm: 5, snow: 5 },
  rain:   { rain: 20, cloudy: 30, storm: 20, clear: 20, fog: 10 },
  storm:  { storm: 10, rain: 40, cloudy: 35, clear: 15 },
  snow:   { snow: 25, cloudy: 30, clear: 20, fog: 15, storm: 10 },
  fog:    { fog: 15, clear: 35, cloudy: 30, rain: 15, snow: 5 },
}

/** Weather gameplay effect definitions */
const WEATHER_MODIFIERS: Record<WeatherType, WeatherModifiers> = {
  clear: {
    movementSpeedMultiplier: 1.0,
    gatherSpeedMultiplier: 1.0,
    energyCostMultiplier: 1.0,
    visionRadius: null,
    outdoorGatheringBlocked: false,
  },
  cloudy: {
    movementSpeedMultiplier: 1.0,
    gatherSpeedMultiplier: 1.0,
    energyCostMultiplier: 1.0,
    visionRadius: null,
    outdoorGatheringBlocked: false,
  },
  rain: {
    movementSpeedMultiplier: 0.9,
    gatherSpeedMultiplier: 1.1,
    energyCostMultiplier: 1.0,
    visionRadius: null,
    outdoorGatheringBlocked: false,
  },
  storm: {
    movementSpeedMultiplier: 0.8,
    gatherSpeedMultiplier: 1.0,
    energyCostMultiplier: 1.0,
    visionRadius: null,
    outdoorGatheringBlocked: true,
  },
  snow: {
    movementSpeedMultiplier: 0.85,
    gatherSpeedMultiplier: 1.0,
    energyCostMultiplier: 1.2,
    visionRadius: null,
    outdoorGatheringBlocked: false,
  },
  fog: {
    movementSpeedMultiplier: 1.0,
    gatherSpeedMultiplier: 1.0,
    energyCostMultiplier: 1.0,
    visionRadius: 3,
    outdoorGatheringBlocked: false,
  },
}

export class WeatherSystem {
  private state: WeatherState

  constructor() {
    this.state = {
      current: 'clear',
      since: 0,
      nextChange: this.randomInterval(),
      windIntensity: Math.random() * 0.3,
    }
  }

  /** Call each tick — returns the new weather type if it changed, null otherwise */
  tick(clock: WorldClock): WeatherType | null {
    if (clock.tick < this.state.nextChange) return null

    const previous = this.state.current
    const next = this.pickNextWeather(previous, clock)

    this.state = {
      current: next,
      since: clock.tick,
      nextChange: clock.tick + this.randomInterval(),
      windIntensity: this.randomWind(next),
    }

    console.log(`[Weather] ${previous} → ${next} (day ${clock.day}, ${clock.timeOfDay})`)
    return next
  }

  getState(): WeatherState {
    return { ...this.state }
  }

  getModifiers(): WeatherModifiers {
    return WEATHER_MODIFIERS[this.state.current]
  }

  getCurrent(): WeatherType {
    return this.state.current
  }

  private pickNextWeather(current: WeatherType, clock: WorldClock): WeatherType {
    const weights = { ...TRANSITIONS[current] }

    // Bias toward snow at night in cold conditions
    if (clock.timeOfDay === 'night') {
      weights.snow = (weights.snow ?? 0) + 10
    }
    // Bias toward clear in the morning
    if (clock.timeOfDay === 'morning') {
      weights.clear = (weights.clear ?? 0) + 15
    }

    return this.weightedRandom(weights)
  }

  private weightedRandom(weights: Partial<Record<WeatherType, number>>): WeatherType {
    const entries = Object.entries(weights) as [WeatherType, number][]
    const total = entries.reduce((sum, [, w]) => sum + w, 0)
    let roll = Math.random() * total

    for (const [type, weight] of entries) {
      roll -= weight
      if (roll <= 0) return type
    }

    return entries[0][0]
  }

  private randomInterval(): number {
    return MIN_CHANGE_INTERVAL + Math.floor(Math.random() * (MAX_CHANGE_INTERVAL - MIN_CHANGE_INTERVAL))
  }

  private randomWind(weather: WeatherType): number {
    switch (weather) {
      case 'storm': return 0.7 + Math.random() * 0.3
      case 'rain': return 0.3 + Math.random() * 0.3
      case 'snow': return 0.2 + Math.random() * 0.3
      default: return Math.random() * 0.2
    }
  }
}
