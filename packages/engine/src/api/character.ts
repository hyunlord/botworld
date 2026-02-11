import { type Router as IRouter, Router } from 'express'
import { createHash, randomUUID } from 'node:crypto'
import { pool } from '../db/connection.js'
import { requireAuth } from '../auth/middleware.js'
import { contentFilter } from '../security/content-filter.js'
import type {
  Race, CharacterClass, CharacterCreationRequest,
  CharacterAppearance, Item, SkillType,
} from '@botworld/shared'

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const VALID_RACES: Race[] = [
  'human', 'elf', 'dwarf', 'orc', 'beastkin', 'undead', 'fairy', 'dragonkin',
]

const VALID_CLASSES: CharacterClass[] = [
  'warrior', 'mage', 'rogue', 'cleric', 'ranger', 'bard', 'alchemist', 'merchant',
]

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/

const RACE_SKILL_BONUSES: Record<Race, Partial<Record<SkillType, number>>> = {
  human:     { gathering: 2, trading: 2 },
  elf:       { diplomacy: 3, cooking: 1 },
  dwarf:     { crafting: 3, combat: 1 },
  orc:       { combat: 3, gathering: 1 },
  beastkin:  { gathering: 2, farming: 2 },
  undead:    { crafting: 2, combat: 2 },
  fairy:     { diplomacy: 2, leadership: 2 },
  dragonkin: { combat: 2, leadership: 2 },
}

const CLASS_STARTER_ITEMS: Record<CharacterClass, { armor: string; weapon: string }> = {
  warrior:   { armor: 'leather',    weapon: 'sword' },
  mage:      { armor: 'cloth_robe', weapon: 'staff' },
  rogue:     { armor: 'leather',    weapon: 'dagger' },
  cleric:    { armor: 'cloth_robe', weapon: 'mace' },
  ranger:    { armor: 'leather',    weapon: 'bow' },
  bard:      { armor: 'casual',     weapon: 'lute' },
  alchemist: { armor: 'cloth_robe', weapon: 'mortar' },
  merchant:  { armor: 'casual',     weapon: 'scales' },
}

const ALL_SKILLS: SkillType[] = [
  'gathering', 'crafting', 'combat', 'diplomacy',
  'leadership', 'trading', 'farming', 'cooking',
]

// Fields that can be changed via PATCH appearance
const MUTABLE_APPEARANCE_FIELDS = new Set([
  'headgear', 'armor', 'armorPrimaryColor', 'armorSecondaryColor',
  'cape', 'capeColor', 'accessories', 'aura',
])

const REROLL_COOLDOWN_MS = 86_400_000 // 24 hours

// ──────────────────────────────────────────────
// Validation helpers
// ──────────────────────────────────────────────

function validateHexColor(value: unknown, field: string): string | null {
  if (typeof value !== 'string' || !HEX_COLOR_REGEX.test(value)) {
    return `${field} must be a valid hex color (e.g. #FF00AA)`
  }
  return null
}

function validateAppearance(a: CharacterAppearance): string | null {
  if (!a || typeof a !== 'object') return 'appearance is required'

  // Required fields existence
  const requiredStrings = [
    'bodyType', 'height', 'skinTone', 'faceShape', 'eyeShape',
    'eyeColor', 'eyebrowStyle', 'noseType', 'mouthType',
    'hairStyle', 'hairColor', 'armor', 'armorPrimaryColor', 'armorSecondaryColor',
  ] as const
  for (const field of requiredStrings) {
    if (!a[field] || typeof a[field] !== 'string') {
      return `appearance.${field} is required`
    }
  }

  // Hex color validation
  const hexFields = [
    ['skinTone', a.skinTone],
    ['eyeColor', a.eyeColor],
    ['hairColor', a.hairColor],
    ['armorPrimaryColor', a.armorPrimaryColor],
    ['armorSecondaryColor', a.armorSecondaryColor],
  ] as const
  for (const [name, value] of hexFields) {
    const err = validateHexColor(value, `appearance.${name}`)
    if (err) return err
  }

  // Optional hex: capeColor
  if (a.capeColor != null && a.capeColor !== '') {
    const err = validateHexColor(a.capeColor, 'appearance.capeColor')
    if (err) return err
  }

  // Arrays
  if (!Array.isArray(a.accessories)) return 'appearance.accessories must be an array'
  if (a.accessories.length > 3) return 'appearance.accessories max 3 items'
  if (!Array.isArray(a.markings)) return 'appearance.markings must be an array'
  if (a.markings.length > 5) return 'appearance.markings max 5 items'

  return null
}

// ──────────────────────────────────────────────
// Sprite hash
// ──────────────────────────────────────────────

function generateSpriteHash(appearance: CharacterAppearance, race: Race): string {
  const data = JSON.stringify({ appearance, race }, Object.keys({ appearance, race }).sort())
  return createHash('sha256').update(data).digest('hex').slice(0, 16)
}

// ──────────────────────────────────────────────
// Content filter helper
// ──────────────────────────────────────────────

async function filterField(
  agentId: string,
  fieldName: string,
  value: string,
): Promise<{ blocked: boolean; response?: { error: string; field: string; warning: string; violation_count: number } }> {
  const result = await contentFilter.filterMessage(agentId, value)
  if (!result.allowed) {
    return {
      blocked: true,
      response: {
        error: 'MESSAGE_BLOCKED_SECURITY',
        field: fieldName,
        warning: `${fieldName} contains prohibited content. ${result.reason}`,
        violation_count: contentFilter.getViolationCount(agentId),
      },
    }
  }
  return { blocked: false }
}

// ──────────────────────────────────────────────
// Validate full CharacterCreationRequest
// ──────────────────────────────────────────────

async function validateCreationRequest(
  agentId: string,
  body: CharacterCreationRequest,
): Promise<{ error?: string; status?: number; filterResponse?: Record<string, unknown> }> {
  const { name, race, characterClass, appearance, personality, backstory, persona_reasoning } = body

  // Basic field validation
  if (!name || typeof name !== 'string' || name.length < 2 || name.length > 20) {
    return { error: 'name must be 2-20 characters', status: 400 }
  }
  if (!VALID_RACES.includes(race)) {
    return { error: `race must be one of: ${VALID_RACES.join(', ')}`, status: 400 }
  }
  if (!VALID_CLASSES.includes(characterClass)) {
    return { error: `characterClass must be one of: ${VALID_CLASSES.join(', ')}`, status: 400 }
  }
  if (!backstory || typeof backstory !== 'string' || backstory.length > 500) {
    return { error: 'backstory is required and must be ≤500 characters', status: 400 }
  }
  if (!persona_reasoning || typeof persona_reasoning !== 'string' || persona_reasoning.length < 10 || persona_reasoning.length > 300) {
    return { error: 'persona_reasoning is required (10-300 characters)', status: 400 }
  }

  // Content filter on text fields
  for (const [field, value] of [['name', name], ['backstory', backstory], ['persona_reasoning', persona_reasoning]] as const) {
    const check = await filterField(agentId, field, value)
    if (check.blocked) {
      return { filterResponse: check.response, status: 403 }
    }
  }

  // Appearance validation
  const appearanceErr = validateAppearance(appearance)
  if (appearanceErr) {
    return { error: appearanceErr, status: 400 }
  }

  // Personality validation
  if (!personality || typeof personality !== 'object') {
    return { error: 'personality is required', status: 400 }
  }
  if (!personality.traits || typeof personality.traits !== 'object') {
    return { error: 'personality.traits is required (OCEAN model)', status: 400 }
  }
  if (!Array.isArray(personality.values) || personality.values.length > 3) {
    return { error: 'personality.values must be an array of max 3', status: 400 }
  }
  if (!Array.isArray(personality.fears) || personality.fears.length > 2) {
    return { error: 'personality.fears must be an array of max 2', status: 400 }
  }
  if (personality.catchphrase && personality.catchphrase.length > 50) {
    return { error: 'personality.catchphrase max 50 characters', status: 400 }
  }

  return {}
}

// ──────────────────────────────────────────────
// Build character data helpers
// ──────────────────────────────────────────────

function buildSkillsWithBonus(race: Race): Record<SkillType, number> {
  const skills = {} as Record<SkillType, number>
  const bonuses = RACE_SKILL_BONUSES[race]
  for (const skill of ALL_SKILLS) {
    skills[skill] = 1 + (bonuses[skill] ?? 0)
  }
  return skills
}

function buildStarterItems(characterClass: CharacterClass): Item[] {
  const starter = CLASS_STARTER_ITEMS[characterClass]
  return [
    { id: randomUUID(), type: 'weapon', name: starter.weapon, quantity: 1, durability: 100, maxDurability: 100 },
    { id: randomUUID(), type: 'tool', name: starter.armor, quantity: 1, durability: 100, maxDurability: 100 },
  ]
}

// ──────────────────────────────────────────────
// Router
// ──────────────────────────────────────────────

export const characterRouter: IRouter = Router()

// ── POST /characters/create ──

characterRouter.post('/characters/create', requireAuth(), async (req, res) => {
  const agent = req.agent!
  const body = req.body as CharacterCreationRequest

  // Validate
  const validation = await validateCreationRequest(agent.id, body)
  if (validation.filterResponse) {
    res.status(validation.status!).json(validation.filterResponse)
    return
  }
  if (validation.error) {
    res.status(validation.status!).json({ error: validation.error })
    return
  }

  // Check existing character
  const existing = await pool.query<{ character_data: Record<string, unknown> | null }>(
    'SELECT character_data FROM agents WHERE id = $1',
    [agent.id],
  )
  if (existing.rows[0]?.character_data?.creation) {
    res.status(409).json({ error: 'Character already exists. Use POST /characters/me/reroll to recreate.' })
    return
  }

  // Build character data
  const raceSkillBonuses = buildSkillsWithBonus(body.race)
  const starterItems = buildStarterItems(body.characterClass)
  const spriteHash = generateSpriteHash(body.appearance, body.race)

  const characterData = {
    creation: body,
    spriteHash,
    starterItems,
    raceSkillBonuses,
    createdAt: Date.now(),
    lastRerollAt: null,
  }

  await pool.query(
    'UPDATE agents SET character_data = $1 WHERE id = $2',
    [JSON.stringify(characterData), agent.id],
  )

  // Broadcast appearance to all connected clients
  const io = req.app.get('io')
  if (io) {
    io.emit('world:character_updated', {
      agentId: agent.id,
      appearance: body.appearance,
      race: body.race,
      spriteHash,
    })
  }

  res.status(201).json({
    id: agent.id,
    agentId: agent.id,
    creation: body,
    spriteHash,
    starterItems,
    raceSkillBonuses,
    createdAt: characterData.createdAt,
  })
})

// ── GET /characters/:id ──

characterRouter.get('/characters/:id', async (req, res) => {
  const { id } = req.params

  const result = await pool.query<{ character_data: Record<string, unknown> | null }>(
    'SELECT character_data FROM agents WHERE id = $1',
    [id],
  )

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Agent not found' })
    return
  }

  const data = result.rows[0].character_data
  if (!data?.creation) {
    res.status(404).json({ error: 'Character not found for this agent' })
    return
  }

  res.json({
    id,
    agentId: id,
    creation: data.creation,
    spriteHash: data.spriteHash,
    createdAt: data.createdAt,
  })
})

// ── PATCH /characters/me/appearance ──

characterRouter.patch('/characters/me/appearance', requireAuth(), async (req, res) => {
  const agent = req.agent!
  const updates = req.body as Partial<CharacterAppearance>

  if (!updates || typeof updates !== 'object') {
    res.status(400).json({ error: 'Request body must be an object with appearance fields' })
    return
  }

  // Reject immutable fields
  const immutableAttempts = Object.keys(updates).filter(k => !MUTABLE_APPEARANCE_FIELDS.has(k))
  if (immutableAttempts.length > 0) {
    res.status(400).json({
      error: `Cannot modify immutable fields: ${immutableAttempts.join(', ')}. Only ${[...MUTABLE_APPEARANCE_FIELDS].join(', ')} can be changed.`,
    })
    return
  }

  // Validate hex colors if provided
  if (updates.armorPrimaryColor) {
    const err = validateHexColor(updates.armorPrimaryColor, 'armorPrimaryColor')
    if (err) { res.status(400).json({ error: err }); return }
  }
  if (updates.armorSecondaryColor) {
    const err = validateHexColor(updates.armorSecondaryColor, 'armorSecondaryColor')
    if (err) { res.status(400).json({ error: err }); return }
  }
  if (updates.capeColor) {
    const err = validateHexColor(updates.capeColor, 'capeColor')
    if (err) { res.status(400).json({ error: err }); return }
  }

  // Validate accessories count
  if (updates.accessories && (!Array.isArray(updates.accessories) || updates.accessories.length > 3)) {
    res.status(400).json({ error: 'accessories must be an array of max 3 items' })
    return
  }

  // Load current character data
  const result = await pool.query<{ character_data: Record<string, unknown> | null }>(
    'SELECT character_data FROM agents WHERE id = $1',
    [agent.id],
  )

  const data = result.rows[0]?.character_data
  if (!data?.creation) {
    res.status(404).json({ error: 'Character not found. Create one first.' })
    return
  }

  // Merge allowed fields into appearance
  const creation = data.creation as CharacterCreationRequest
  const appearance = { ...creation.appearance }
  for (const key of Object.keys(updates) as (keyof CharacterAppearance)[]) {
    if (MUTABLE_APPEARANCE_FIELDS.has(key)) {
      ;(appearance as Record<string, unknown>)[key] = (updates as Record<string, unknown>)[key]
    }
  }

  // Update creation with new appearance
  const updatedCreation = { ...creation, appearance }
  const spriteHash = generateSpriteHash(appearance, creation.race)

  const updatedData = {
    ...data,
    creation: updatedCreation,
    spriteHash,
  }

  await pool.query(
    'UPDATE agents SET character_data = $1 WHERE id = $2',
    [JSON.stringify(updatedData), agent.id],
  )

  // Broadcast appearance update
  const io = req.app.get('io')
  if (io) {
    io.emit('world:character_updated', {
      agentId: agent.id,
      appearance: appearance as CharacterAppearance,
      race: creation.race,
      spriteHash,
    })
  }

  res.json({
    id: agent.id,
    agentId: agent.id,
    creation: updatedCreation,
    spriteHash,
    message: 'Appearance updated successfully',
  })
})

// ── POST /characters/me/reroll ──

characterRouter.post('/characters/me/reroll', requireAuth(), async (req, res) => {
  const agent = req.agent!
  const body = req.body as CharacterCreationRequest

  // Load current character to check cooldown
  const result = await pool.query<{ character_data: Record<string, unknown> | null }>(
    'SELECT character_data FROM agents WHERE id = $1',
    [agent.id],
  )

  const data = result.rows[0]?.character_data
  if (!data?.creation) {
    res.status(404).json({ error: 'No character to reroll. Use POST /characters/create first.' })
    return
  }

  // 24-hour cooldown check
  const lastReroll = data.lastRerollAt as number | null
  if (lastReroll && lastReroll + REROLL_COOLDOWN_MS > Date.now()) {
    const remainingMs = (lastReroll + REROLL_COOLDOWN_MS) - Date.now()
    const remainingHours = Math.ceil(remainingMs / 3_600_000)
    res.status(429).json({
      error: 'Reroll cooldown active.',
      retry_after_hours: remainingHours,
      cooldown_expires_at: new Date(lastReroll + REROLL_COOLDOWN_MS).toISOString(),
    })
    return
  }

  // Validate new character creation request
  const validation = await validateCreationRequest(agent.id, body)
  if (validation.filterResponse) {
    res.status(validation.status!).json(validation.filterResponse)
    return
  }
  if (validation.error) {
    res.status(validation.status!).json({ error: validation.error })
    return
  }

  // Build new character data
  const raceSkillBonuses = buildSkillsWithBonus(body.race)
  const starterItems = buildStarterItems(body.characterClass)
  const spriteHash = generateSpriteHash(body.appearance, body.race)

  const characterData = {
    creation: body,
    spriteHash,
    starterItems,
    raceSkillBonuses,
    createdAt: data.createdAt, // preserve original creation time
    lastRerollAt: Date.now(),
  }

  await pool.query(
    'UPDATE agents SET character_data = $1 WHERE id = $2',
    [JSON.stringify(characterData), agent.id],
  )

  // Broadcast appearance update
  const io = req.app.get('io')
  if (io) {
    io.emit('world:character_updated', {
      agentId: agent.id,
      appearance: body.appearance,
      race: body.race,
      spriteHash,
    })
  }

  res.json({
    id: agent.id,
    agentId: agent.id,
    creation: body,
    spriteHash,
    starterItems,
    raceSkillBonuses,
    rerolledAt: characterData.lastRerollAt,
    message: 'Character rerolled successfully',
  })
})
