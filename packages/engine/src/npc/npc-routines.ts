/**
 * NPC daily routines — time-of-day behavior hints.
 *
 * These hints are included in the LLM context so the AI knows what
 * the NPC "should" be doing at this time. The LLM adds personality
 * and detail on top of these structural hints.
 *
 * When no LLM is available, the scheduler uses the fallback action
 * directly (rule-based behavior).
 */

import type { NpcRole } from '@botworld/shared'

export type TimeOfDay = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'evening' | 'night'

export interface RoutineEntry {
  /** Hint text included in LLM context */
  hint: string
  /** Fallback action when LLM is unavailable */
  fallback: 'idle' | 'speak' | 'move_home' | 'move_wander' | 'rest'
  /** Whether LLM should be called (some time slots are purely rule-based) */
  useLLM: boolean
}

type RoutineTable = Record<TimeOfDay, RoutineEntry>

const INNKEEPER_ROUTINE: RoutineTable = {
  dawn:      { hint: 'Prepare food in the tavern kitchen. Start the day early.', fallback: 'idle', useLLM: false },
  morning:   { hint: 'Stand outside the tavern to greet early visitors. Offer breakfast.', fallback: 'speak', useLLM: true },
  noon:      { hint: 'Busy lunch hour. Serve food and chat with customers.', fallback: 'speak', useLLM: true },
  afternoon: { hint: 'Quieter time. Clean up, restock, maybe step outside for air.', fallback: 'idle', useLLM: true },
  evening:   { hint: 'Peak hours! The tavern is lively. Chat with guests, serve drinks, share rumors.', fallback: 'speak', useLLM: true },
  night:     { hint: 'Closing time. Wind down, clean the tavern, rest.', fallback: 'rest', useLLM: false },
}

const MERCHANT_ROUTINE: RoutineTable = {
  dawn:      { hint: 'Pack up wares and prepare for the day. Check inventory.', fallback: 'idle', useLLM: false },
  morning:   { hint: 'Set up shop at the marketplace. Call out to passersby.', fallback: 'speak', useLLM: true },
  noon:      { hint: 'Active selling time. Haggle and advertise.', fallback: 'speak', useLLM: true },
  afternoon: { hint: 'Consider traveling to the next settlement if business is slow.', fallback: 'move_wander', useLLM: true },
  evening:   { hint: 'Last chance sales. Start packing up if at marketplace.', fallback: 'speak', useLLM: true },
  night:     { hint: 'Rest and count earnings. Plan tomorrow route.', fallback: 'rest', useLLM: false },
}

const GUARD_ROUTINE: RoutineTable = {
  dawn:      { hint: 'Morning shift begins. Check the perimeter.', fallback: 'idle', useLLM: false },
  morning:   { hint: 'Stand guard at your post. Greet passing travelers.', fallback: 'idle', useLLM: true },
  noon:      { hint: 'Midday watch. Stay vigilant but relaxed.', fallback: 'idle', useLLM: true },
  afternoon: { hint: 'Afternoon patrol around the settlement area.', fallback: 'move_wander', useLLM: true },
  evening:   { hint: 'Begin evening patrol. Check roads and paths.', fallback: 'move_wander', useLLM: true },
  night:     { hint: 'Night watch! Be extra alert. Patrol wider area. Warn of dangers.', fallback: 'move_wander', useLLM: true },
}

const WANDERER_ROUTINE: RoutineTable = {
  dawn:      { hint: 'Wake up and start walking toward the next destination.', fallback: 'move_wander', useLLM: false },
  morning:   { hint: 'Travel along roads. Enjoy the morning scenery.', fallback: 'move_wander', useLLM: true },
  noon:      { hint: 'Rest briefly if at a settlement. Otherwise keep walking.', fallback: 'move_wander', useLLM: true },
  afternoon: { hint: 'Continue traveling. Share stories if you meet anyone.', fallback: 'move_wander', useLLM: true },
  evening:   { hint: 'Look for a tavern or safe place to rest for the night.', fallback: 'move_wander', useLLM: true },
  night:     { hint: 'Rest at a settlement or camp. Reflect on the day.', fallback: 'rest', useLLM: false },
}

const GUILD_MASTER_ROUTINE: RoutineTable = {
  dawn:      { hint: 'Early study and meditation at the guild hall.', fallback: 'idle', useLLM: false },
  morning:   { hint: 'Open the guild hall. Review notices and missions.', fallback: 'idle', useLLM: true },
  noon:      { hint: 'Meet with visitors. Offer advice and guidance.', fallback: 'speak', useLLM: true },
  afternoon: { hint: 'Training time. Reflect on guild matters.', fallback: 'idle', useLLM: true },
  evening:   { hint: 'Evening consultations. Wise words for returning adventurers.', fallback: 'speak', useLLM: true },
  night:     { hint: 'Close the guild. Study ancient texts. Rest.', fallback: 'rest', useLLM: false },
}

const ROUTINE_TABLES: Record<NpcRole, RoutineTable> = {
  innkeeper: INNKEEPER_ROUTINE,
  merchant: MERCHANT_ROUTINE,
  guard: GUARD_ROUTINE,
  wanderer: WANDERER_ROUTINE,
  guild_master: GUILD_MASTER_ROUTINE,
}

export function getRoutineEntry(role: NpcRole, timeOfDay: string): RoutineEntry {
  const table = ROUTINE_TABLES[role]
  const tod = timeOfDay as TimeOfDay
  return table[tod] ?? table.morning
}
