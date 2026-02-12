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

const BLACKSMITH_ROUTINE: RoutineTable = {
  dawn:      { hint: 'Light the forge fires. Prepare materials for the day.', fallback: 'idle', useLLM: false },
  morning:   { hint: 'Work at the forge. Hammer metal, craft items.', fallback: 'idle', useLLM: true },
  noon:      { hint: 'Brief break. Inspect finished work, eat lunch.', fallback: 'idle', useLLM: true },
  afternoon: { hint: 'Take orders from visitors. Evaluate materials and equipment.', fallback: 'speak', useLLM: true },
  evening:   { hint: 'Bank the forge. Organize the workshop, finish orders.', fallback: 'idle', useLLM: true },
  night:     { hint: 'Rest. Maybe sharpen a personal blade by the hearth.', fallback: 'rest', useLLM: false },
}

const SCHOLAR_ROUTINE: RoutineTable = {
  dawn:      { hint: 'Early reading and note-taking in the library.', fallback: 'idle', useLLM: false },
  morning:   { hint: 'Organize books, catalog new findings, research.', fallback: 'idle', useLLM: true },
  noon:      { hint: 'Deep research session. Cross-reference ancient texts.', fallback: 'idle', useLLM: true },
  afternoon: { hint: 'Meet visitors, share knowledge, discuss discoveries.', fallback: 'speak', useLLM: true },
  evening:   { hint: 'Write reflections, plan expeditions to nearby ruins.', fallback: 'idle', useLLM: true },
  night:     { hint: 'Read by candlelight, then rest.', fallback: 'rest', useLLM: false },
}

const FARMER_ROUTINE: RoutineTable = {
  dawn:      { hint: 'Wake early. Check crops and water plants.', fallback: 'idle', useLLM: false },
  morning:   { hint: 'Harvest ripe crops, tend fields. Hard work.', fallback: 'idle', useLLM: true },
  noon:      { hint: 'Break for lunch. Maybe visit the marketplace to sell produce.', fallback: 'speak', useLLM: true },
  afternoon: { hint: 'Back to fieldwork. Check for pests and weeds.', fallback: 'idle', useLLM: true },
  evening:   { hint: 'Return home. Prepare a hearty meal.', fallback: 'move_home', useLLM: true },
  night:     { hint: 'Early to bed. Farmers rise with the sun.', fallback: 'rest', useLLM: false },
}

const PRIEST_ROUTINE: RoutineTable = {
  dawn:      { hint: 'Morning prayers and meditation at the temple.', fallback: 'idle', useLLM: false },
  morning:   { hint: 'Bless visitors, tend the temple grounds.', fallback: 'speak', useLLM: true },
  noon:      { hint: 'Offer healing to wounded travelers. Share wisdom.', fallback: 'speak', useLLM: true },
  afternoon: { hint: 'Walk through the settlement. Check on people.', fallback: 'move_wander', useLLM: true },
  evening:   { hint: 'Evening prayers. Light candles at the temple.', fallback: 'idle', useLLM: true },
  night:     { hint: 'Contemplation and rest.', fallback: 'rest', useLLM: false },
}

const ROUTINE_TABLES: Record<NpcRole, RoutineTable> = {
  innkeeper: INNKEEPER_ROUTINE,
  merchant: MERCHANT_ROUTINE,
  guard: GUARD_ROUTINE,
  wanderer: WANDERER_ROUTINE,
  guild_master: GUILD_MASTER_ROUTINE,
  blacksmith: BLACKSMITH_ROUTINE,
  scholar: SCHOLAR_ROUTINE,
  farmer: FARMER_ROUTINE,
  priest: PRIEST_ROUTINE,
}

export function getRoutineEntry(role: NpcRole, timeOfDay: string): RoutineEntry {
  const table = ROUTINE_TABLES[role]
  const tod = timeOfDay as TimeOfDay
  return table[tod] ?? table.morning
}
