import type { WorldClock, TimeOfDay } from '@botworld/shared'
import { TICKS_PER_GAME_DAY } from '@botworld/shared'

export function createWorldClock(): WorldClock {
  return {
    tick: 0,
    day: 1,
    timeOfDay: 'dawn',
    dayProgress: 0,
  }
}

export function advanceClock(clock: WorldClock): WorldClock {
  const tick = clock.tick + 1
  const tickInDay = tick % TICKS_PER_GAME_DAY
  const dayProgress = tickInDay / TICKS_PER_GAME_DAY
  const day = Math.floor(tick / TICKS_PER_GAME_DAY) + 1
  const timeOfDay = getTimeOfDay(dayProgress)

  return { tick, day, timeOfDay, dayProgress }
}

function getTimeOfDay(progress: number): TimeOfDay {
  if (progress < 0.08) return 'dawn'
  if (progress < 0.25) return 'morning'
  if (progress < 0.42) return 'noon'
  if (progress < 0.58) return 'afternoon'
  if (progress < 0.75) return 'evening'
  return 'night'
}

export function isDaytime(clock: WorldClock): boolean {
  return clock.timeOfDay !== 'night' && clock.timeOfDay !== 'dawn'
}
