import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import type { CharacterAppearance, Race, Gender } from '@botworld/shared'

export interface PortraitConfig {
  provider: 'replicate' | 'openai' | 'local_placeholder'
  replicateApiKey?: string
  openaiApiKey?: string
  outputDir: string
  baseUrl: string // base URL for serving portraits
}

interface PortraitPromptParams {
  race: Race
  gender?: string
  appearance: CharacterAppearance
  personality?: string
  characterClass?: string
}

const ART_STYLE = 'detailed fantasy illustration, soft lighting, painterly style, muted warm colors, RPG character portrait'

// Default portrait colors per race for fallback generation
const RACE_PORTRAIT_COLORS: Record<Race, number> = {
  human: 0xE8C8A0,
  elf: 0xC8E8C0,
  dwarf: 0xD4A060,
  orc: 0x7CAA6E,
  beastkin: 0xD4A373,
  undead: 0xA0B8C8,
  fairy: 0xE8D0F0,
  dragonkin: 0xA08060,
}

export class PortraitService {
  private config: PortraitConfig
  private generationQueue: Map<string, Promise<string | null>> = new Map()

  constructor(config: Partial<PortraitConfig> = {}) {
    this.config = {
      provider: config.provider || 'local_placeholder',
      replicateApiKey: config.replicateApiKey || process.env.REPLICATE_API_KEY,
      openaiApiKey: config.openaiApiKey || process.env.OPENAI_API_KEY,
      outputDir: config.outputDir || path.join(process.cwd(), 'data', 'portraits'),
      baseUrl: config.baseUrl || '/api/portraits',
    }

    // Ensure output directory exists
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true })
    }

    // Auto-detect provider based on available API keys
    if (this.config.provider === 'local_placeholder') {
      if (this.config.replicateApiKey) {
        this.config.provider = 'replicate'
      } else if (this.config.openaiApiKey) {
        this.config.provider = 'openai'
      }
    }

    console.log(`[PortraitService] Provider: ${this.config.provider}, Output: ${this.config.outputDir}`)
  }

  /**
   * Generate a portrait for a character. Returns the portrait URL.
   * If generation fails, returns a fallback portrait URL.
   */
  async generatePortrait(agentId: string, params: PortraitPromptParams): Promise<string> {
    // Check if already generated
    const existingPath = this.getPortraitPath(agentId)
    if (fs.existsSync(existingPath)) {
      return this.getPortraitUrl(agentId)
    }

    // Check if generation is already in progress
    const existing = this.generationQueue.get(agentId)
    if (existing) {
      const result = await existing
      return result || this.getFallbackPortraitUrl(params.race)
    }

    // Start generation
    const promise = this._generatePortrait(agentId, params)
    this.generationQueue.set(agentId, promise)

    try {
      const result = await promise
      return result || this.getFallbackPortraitUrl(params.race)
    } finally {
      this.generationQueue.delete(agentId)
    }
  }

  private async _generatePortrait(agentId: string, params: PortraitPromptParams): Promise<string | null> {
    try {
      const prompt = this.buildPrompt(params)

      switch (this.config.provider) {
        case 'replicate':
          return await this.generateViaReplicate(agentId, prompt)
        case 'openai':
          return await this.generateViaOpenAI(agentId, prompt)
        case 'local_placeholder':
        default:
          return this.generateLocalPlaceholder(agentId, params.race, params.gender)
      }
    } catch (err) {
      console.error(`[PortraitService] Generation failed for ${agentId}:`, err)
      return null
    }
  }

  /** Build image generation prompt from character data */
  buildPrompt(params: PortraitPromptParams): string {
    const { race, gender, appearance, personality, characterClass } = params

    const parts: string[] = ['Fantasy RPG character portrait']

    // Race and gender
    parts.push(`${race} ${gender || 'character'}`)

    // Hair
    if (appearance.hairStyle && appearance.hairStyle !== 'bald') {
      const hairColorName = this.findColorName(appearance.hairColor, 'hair')
      parts.push(`${hairColorName} hair ${appearance.hairStyle.replace(/_/g, ' ')}`)
    }

    // Skin
    const skinName = this.findColorName(appearance.skinTone, 'skin')
    parts.push(`${skinName} skin`)

    // Build/height
    if (appearance.bodyType !== 'average') {
      parts.push(`${appearance.bodyType} build`)
    }

    // Class hint
    if (characterClass) {
      parts.push(`${characterClass} class`)
    }

    // Armor
    if (appearance.armor && appearance.armor !== 'casual') {
      parts.push(`wearing ${appearance.armor.replace(/_/g, ' ')}`)
    }

    // Personality hint (optional)
    if (personality) {
      const shortPersonality = personality.slice(0, 60)
      parts.push(shortPersonality)
    }

    // Style suffix
    parts.push(ART_STYLE)
    parts.push('bust shot, facing forward, neutral background')

    return parts.join(', ')
  }

  /** Find closest color name for prompt building */
  private findColorName(hex: string, type: 'skin' | 'hair'): string {
    if (!hex) return type === 'skin' ? 'medium' : 'dark'
    // Simple mapping from hex to descriptive name
    const skinNames: Record<string, string> = {
      '#FFE0D0': 'pale', '#F5C5A3': 'light', '#D4A373': 'medium',
      '#C48B5C': 'tan', '#8B6544': 'brown', '#5C3A21': 'dark',
      '#7CAA6E': 'green-tinted', '#A0C4E8': 'pale blue',
    }
    const hairNames: Record<string, string> = {
      '#1A1A1A': 'black', '#3D2B1F': 'dark brown', '#6B4423': 'brown',
      '#922724': 'auburn', '#C45A27': 'ginger', '#E8C872': 'blonde',
      '#E8E0D0': 'platinum', '#F0EDE8': 'white', '#C0C0C0': 'silver',
      '#4488CC': 'blue', '#44AA66': 'green', '#8844AA': 'purple',
    }
    const names = type === 'skin' ? skinNames : hairNames
    return names[hex.toUpperCase()] || names[hex] || (type === 'skin' ? 'medium' : 'dark')
  }

  /** Generate via Replicate SDXL API */
  private async generateViaReplicate(agentId: string, prompt: string): Promise<string | null> {
    if (!this.config.replicateApiKey) return null

    try {
      const response = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.replicateApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: 'ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4', // SDXL
          input: {
            prompt,
            negative_prompt: 'ugly, deformed, nsfw, blurry, low quality, text, watermark',
            width: 512,
            height: 512,
            num_outputs: 1,
            guidance_scale: 7.5,
            num_inference_steps: 30,
          },
        }),
      })

      if (!response.ok) {
        console.error(`[PortraitService] Replicate API error: ${response.status}`)
        return null
      }

      const prediction = await response.json() as { id: string; urls: { get: string } }

      // Poll for completion
      let result: { status: string; output?: string[] } | null = null
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 2000))
        const pollRes = await fetch(prediction.urls.get, {
          headers: { 'Authorization': `Bearer ${this.config.replicateApiKey}` },
        })
        result = await pollRes.json() as { status: string; output?: string[] }
        if (result.status === 'succeeded' || result.status === 'failed') break
      }

      if (result?.status === 'succeeded' && result.output?.[0]) {
        // Download and save image
        const imageUrl = result.output[0]
        const imageRes = await fetch(imageUrl)
        const buffer = Buffer.from(await imageRes.arrayBuffer())
        const outPath = this.getPortraitPath(agentId)
        fs.writeFileSync(outPath, buffer)
        console.log(`[PortraitService] Generated portrait for ${agentId}`)
        return this.getPortraitUrl(agentId)
      }
    } catch (err) {
      console.error(`[PortraitService] Replicate generation error:`, err)
    }
    return null
  }

  /** Generate via OpenAI DALL-E 3 API */
  private async generateViaOpenAI(agentId: string, prompt: string): Promise<string | null> {
    if (!this.config.openaiApiKey) return null

    try {
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt,
          n: 1,
          size: '1024x1024',
          quality: 'standard',
          response_format: 'url',
        }),
      })

      if (!response.ok) {
        console.error(`[PortraitService] OpenAI API error: ${response.status}`)
        return null
      }

      const result = await response.json() as { data: { url: string }[] }
      if (result.data?.[0]?.url) {
        const imageRes = await fetch(result.data[0].url)
        const buffer = Buffer.from(await imageRes.arrayBuffer())
        const outPath = this.getPortraitPath(agentId)
        fs.writeFileSync(outPath, buffer)
        console.log(`[PortraitService] Generated portrait for ${agentId} via OpenAI`)
        return this.getPortraitUrl(agentId)
      }
    } catch (err) {
      console.error(`[PortraitService] OpenAI generation error:`, err)
    }
    return null
  }

  /** Generate a simple placeholder portrait locally (no API needed) */
  generateLocalPlaceholder(agentId: string, race: Race, gender?: string): string {
    const outPath = this.getPortraitPath(agentId)
    if (fs.existsSync(outPath)) return this.getPortraitUrl(agentId)

    // We generate a simple SVG placeholder and convert to PNG wouldn't work without canvas,
    // so just store a marker file. The client will generate the visual placeholder.
    const color = RACE_PORTRAIT_COLORS[race] || 0xCCCCCC
    const metadata = JSON.stringify({ race, gender, color, generated: 'placeholder' })
    fs.writeFileSync(outPath.replace('.png', '.json'), metadata)

    return this.getPortraitUrl(agentId)
  }

  /** Get the file system path for a portrait */
  getPortraitPath(agentId: string): string {
    return path.join(this.config.outputDir, `${agentId}.png`)
  }

  /** Get the URL for serving a portrait */
  getPortraitUrl(agentId: string): string {
    return `${this.config.baseUrl}/${agentId}.png`
  }

  /** Get fallback portrait URL for a race */
  getFallbackPortraitUrl(race: Race): string {
    return `${this.config.baseUrl}/fallback_${race}.png`
  }

  /** Check if a portrait exists */
  hasPortrait(agentId: string): boolean {
    return fs.existsSync(this.getPortraitPath(agentId))
  }

  /** Delete a portrait */
  deletePortrait(agentId: string): void {
    const p = this.getPortraitPath(agentId)
    if (fs.existsSync(p)) fs.unlinkSync(p)
    const meta = p.replace('.png', '.json')
    if (fs.existsSync(meta)) fs.unlinkSync(meta)
  }
}
