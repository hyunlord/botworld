/**
 * Interaction Effects — visual layer for agent interactions.
 *
 * Draws conversation lines, combat zones, emotion popups,
 * movement dust, and path visualization on the Phaser scene.
 */

import Phaser from 'phaser'
import type { Agent } from '@botworld/shared'
import { ISO_TILE_WIDTH, ISO_TILE_HEIGHT, worldToScreen } from '../utils/coordinates.js'

// ── Configuration ──

const CONVERSATION_TIMEOUT = 15_000
const COMBAT_ZONE_RADIUS = 28
const DUST_FADE_MS = 400
const EMOTION_DISPLAY_MS = 4_000
const DASH_LEN = 4
const GAP_LEN = 4

// Plutchik emotion → floating emoji
const EMOTION_EMOJIS: Record<string, { text: string; color: string }> = {
  joy:          { text: '\u{1F49B}', color: '#FFD700' },   // 💛
  trust:        { text: '\u{1F49A}', color: '#4ADE80' },   // 💚
  fear:         { text: '\u{1F4A6}', color: '#60A5FA' },   // 💦
  surprise:     { text: '\u2757',    color: '#FBBF24' },   // ❗
  sadness:      { text: '\u{1F4A7}', color: '#93C5FD' },   // 💧
  disgust:      { text: '\u{1F4A2}', color: '#A78BFA' },   // 💢
  anger:        { text: '\u{1F4A2}', color: '#F87171' },   // 💢
  anticipation: { text: '\u2728',    color: '#FCD34D' },   // ✨
}

// ── Internal types ──

interface ConversationState {
  agent1Id: string
  agent2Id: string
  lastMessageTime: number
  messageCount: number
}

interface CombatZoneState {
  agentId: string
  monsterId: string
  position: { x: number; y: number }
  zone: Phaser.GameObjects.Container | null
}

interface ChatIconState {
  container: Phaser.GameObjects.Container
  expireTime: number
}

interface EmotionPopupState {
  container: Phaser.GameObjects.Container
  expireTime: number
}

// ── System ──

export class InteractionEffects {
  private scene: Phaser.Scene

  // Conversation tracking
  private conversations = new Map<string, ConversationState>()
  private chatIcons = new Map<string, ChatIconState>()

  // Combat zones
  private combatZones = new Map<string, CombatZoneState>()

  // Emotion popups
  private emotionPopups = new Map<string, EmotionPopupState>()
  private lastEmotions = new Map<string, string>()

  // Path visualization
  private pathGfx: Phaser.GameObjects.Graphics
  // Conversation + combat line graphics
  private lineGfx: Phaser.GameObjects.Graphics

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.lineGfx = scene.add.graphics().setDepth(495)
    this.pathGfx = scene.add.graphics().setDepth(498)
  }

  // ── Public API ──

  /** Called every frame from WorldScene.update() */
  update(
    agents: Agent[],
    agentSprites: Map<string, Phaser.GameObjects.Container>,
    selectedAgentId: string | null,
  ): void {
    const now = Date.now()

    this.lineGfx.clear()
    this.pathGfx.clear()

    this.drawConversationLines(agentSprites, now)
    this.renderCombatZones(now)
    this.processEmotions(agents, agentSprites, now)
    this.drawSelectedPath(agents, selectedAgentId)
    this.cleanup(agentSprites, now)
  }

  /** A speech event occurred — track the conversation */
  onSpoke(speakerId: string, targetId: string | undefined, _message: string): void {
    if (!targetId) return
    const key = speakerId < targetId ? `${speakerId}:${targetId}` : `${targetId}:${speakerId}`
    const existing = this.conversations.get(key)
    if (existing) {
      existing.lastMessageTime = Date.now()
      existing.messageCount++
    } else {
      this.conversations.set(key, {
        agent1Id: speakerId < targetId ? speakerId : targetId,
        agent2Id: speakerId < targetId ? targetId : speakerId,
        lastMessageTime: Date.now(),
        messageCount: 1,
      })
    }
  }

  /** Combat started — create a persistent zone */
  onCombatStarted(combatId: string, agentId: string, monsterId: string, position: { x: number; y: number }): void {
    this.combatZones.set(combatId, { agentId, monsterId, position, zone: null })
  }

  /** Combat ended — fade and remove zone */
  onCombatEnded(combatId: string): void {
    const state = this.combatZones.get(combatId)
    if (state?.zone) {
      this.scene.tweens.add({
        targets: state.zone,
        alpha: 0,
        scale: 1.5,
        duration: 500,
        onComplete: () => state.zone?.destroy(),
      })
    }
    this.combatZones.delete(combatId)
  }

  /** Agent moved — spawn dust particles at old position */
  onMoved(from: { x: number; y: number }): void {
    const sp = worldToScreen(from.x, from.y)
    const cx = sp.x + ISO_TILE_WIDTH / 2
    const cy = sp.y + ISO_TILE_HEIGHT / 2 + 4
    for (let i = 0; i < 3; i++) {
      const dust = this.scene.add.circle(
        cx + Phaser.Math.Between(-4, 4),
        cy + Phaser.Math.Between(-2, 2),
        Phaser.Math.Between(1, 2),
        0xBBAAAA, 0.35,
      ).setDepth(499)
      this.scene.tweens.add({
        targets: dust,
        alpha: 0,
        y: dust.y + Phaser.Math.Between(2, 6),
        scale: 0.3,
        duration: DUST_FADE_MS + Math.random() * 200,
        onComplete: () => dust.destroy(),
      })
    }
  }

  destroy(): void {
    this.lineGfx.destroy()
    this.pathGfx.destroy()
    for (const [, s] of this.chatIcons) s.container.destroy()
    for (const [, s] of this.emotionPopups) s.container.destroy()
    for (const [, s] of this.combatZones) s.zone?.destroy()
  }

  // ── Private helpers ──

  /** Draw dashed conversation lines + chat icons */
  private drawConversationLines(
    sprites: Map<string, Phaser.GameObjects.Container>,
    now: number,
  ): void {
    for (const [key, conv] of this.conversations) {
      const age = now - conv.lastMessageTime
      if (age > CONVERSATION_TIMEOUT) continue

      const s1 = sprites.get(conv.agent1Id)
      const s2 = sprites.get(conv.agent2Id)
      if (!s1 || !s2) continue

      // Dashed line between the two agents
      const alpha = Math.max(0.1, 1 - age / CONVERSATION_TIMEOUT) * 0.45
      this.dashedLine(
        s1.x, s1.y + 4,
        s2.x, s2.y + 4,
        0xffffff, alpha, 1.5,
      )

      // Chat icons under each agent
      this.ensureChatIcon(conv.agent1Id, s1, conv.lastMessageTime + CONVERSATION_TIMEOUT)
      this.ensureChatIcon(conv.agent2Id, s2, conv.lastMessageTime + CONVERSATION_TIMEOUT)
    }
  }

  private ensureChatIcon(agentId: string, sprite: Phaser.GameObjects.Container, expireTime: number): void {
    const existing = this.chatIcons.get(agentId)
    if (existing) {
      existing.container.setPosition(sprite.x, sprite.y + 14)
      existing.expireTime = expireTime
      return
    }

    const label = this.scene.add.text(0, 0, '\u{1F4AC}', { fontSize: '10px' })
      .setOrigin(0.5, 0.5)
    const ctr = this.scene.add.container(sprite.x, sprite.y + 14, [label])
      .setDepth(1999).setAlpha(0)

    this.scene.tweens.add({ targets: ctr, alpha: 0.8, duration: 200 })
    this.scene.tweens.add({
      targets: ctr, y: ctr.y - 2,
      duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    })
    this.chatIcons.set(agentId, { container: ctr, expireTime })
  }

  /** Create / update persistent combat zone circles */
  private renderCombatZones(now: number): void {
    for (const [, state] of this.combatZones) {
      if (state.zone) continue // already created

      const sp = worldToScreen(state.position.x, state.position.y)
      const cx = sp.x + ISO_TILE_WIDTH / 2
      const cy = sp.y + ISO_TILE_HEIGHT / 2

      const gfx = this.scene.add.graphics()
      gfx.fillStyle(0xFF4444, 0.08)
      gfx.fillCircle(0, 0, COMBAT_ZONE_RADIUS)
      gfx.lineStyle(1.5, 0xFF4444, 0.3)
      gfx.strokeCircle(0, 0, COMBAT_ZONE_RADIUS)

      const icon = this.scene.add.text(0, -COMBAT_ZONE_RADIUS - 8, '\u2694\uFE0F', {
        fontSize: '12px',
      }).setOrigin(0.5, 0.5)

      const ctr = this.scene.add.container(cx, cy, [gfx, icon])
        .setDepth(489).setAlpha(0)

      this.scene.tweens.add({ targets: ctr, alpha: 1, duration: 300 })
      this.scene.tweens.add({
        targets: gfx,
        scaleX: { from: 0.95, to: 1.05 },
        scaleY: { from: 0.95, to: 1.05 },
        duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })

      state.zone = ctr
    }
  }

  /** Show floating emotion emoji when dominant emotion changes */
  private processEmotions(
    agents: Agent[],
    sprites: Map<string, Phaser.GameObjects.Container>,
    now: number,
  ): void {
    for (const agent of agents) {
      const entries = Object.entries(agent.currentMood) as [string, number][]
      let bestName = ''
      let bestVal = 0
      for (const [n, v] of entries) {
        if (v > bestVal) { bestName = n; bestVal = v }
      }
      if (bestVal < 0.35 || !bestName) continue

      const prev = this.lastEmotions.get(agent.id)
      if (prev === bestName) continue
      this.lastEmotions.set(agent.id, bestName)

      this.spawnEmotionPopup(agent.id, bestName, sprites)
    }

    // Expire old popups
    for (const [id, popup] of this.emotionPopups) {
      if (now > popup.expireTime) {
        this.scene.tweens.add({
          targets: popup.container,
          alpha: 0, y: popup.container.y - 10,
          duration: 300,
          onComplete: () => popup.container.destroy(),
        })
        this.emotionPopups.delete(id)
      } else {
        // Follow the agent horizontally
        const sprite = sprites.get(id)
        if (sprite) popup.container.x = sprite.x
      }
    }
  }

  private spawnEmotionPopup(
    agentId: string,
    emotion: string,
    sprites: Map<string, Phaser.GameObjects.Container>,
  ): void {
    const sprite = sprites.get(agentId)
    if (!sprite) return

    // Remove previous popup for this agent
    const old = this.emotionPopups.get(agentId)
    if (old) { old.container.destroy(); this.emotionPopups.delete(agentId) }

    const emo = EMOTION_EMOJIS[emotion]
    if (!emo) return

    const text = this.scene.add.text(0, 0, emo.text, {
      fontSize: '16px',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0.5, 0.5)

    const ctr = this.scene.add.container(sprite.x, sprite.y - 34, [text])
      .setDepth(2001).setAlpha(0).setScale(0.3)

    // Pop-in
    this.scene.tweens.add({
      targets: ctr, alpha: 1, scale: 1,
      duration: 300, ease: 'Back.easeOut',
    })
    // Slow float up
    this.scene.tweens.add({
      targets: ctr, y: ctr.y - 10,
      duration: EMOTION_DISPLAY_MS, ease: 'Sine.easeOut',
    })

    this.emotionPopups.set(agentId, {
      container: ctr,
      expireTime: Date.now() + EMOTION_DISPLAY_MS,
    })
  }

  /** Draw a dotted path from selected agent to its move target */
  private drawSelectedPath(agents: Agent[], selectedId: string | null): void {
    if (!selectedId) return
    const agent = agents.find(a => a.id === selectedId)
    if (!agent?.currentAction?.targetPosition) return
    if (agent.currentAction.type !== 'move') return

    const from = worldToScreen(agent.position.x, agent.position.y)
    const to = worldToScreen(agent.currentAction.targetPosition.x, agent.currentAction.targetPosition.y)

    this.dashedLine(
      from.x + ISO_TILE_WIDTH / 2, from.y + ISO_TILE_HEIGHT / 2,
      to.x + ISO_TILE_WIDTH / 2, to.y + ISO_TILE_HEIGHT / 2,
      0x4488FF, 0.4, 1.5,
    )

    // Destination circle
    this.pathGfx.lineStyle(1, 0x4488FF, 0.5)
    this.pathGfx.strokeCircle(to.x + ISO_TILE_WIDTH / 2, to.y + ISO_TILE_HEIGHT / 2, 6)
  }

  /** Remove expired state */
  private cleanup(sprites: Map<string, Phaser.GameObjects.Container>, now: number): void {
    // Conversations
    for (const [key, conv] of this.conversations) {
      if (now - conv.lastMessageTime > CONVERSATION_TIMEOUT) {
        this.conversations.delete(key)
      }
    }
    // Chat icons
    for (const [id, icon] of this.chatIcons) {
      if (now > icon.expireTime) {
        this.scene.tweens.add({
          targets: icon.container,
          alpha: 0, duration: 300,
          onComplete: () => icon.container.destroy(),
        })
        this.chatIcons.delete(id)
      }
    }
  }

  /** Draw a dashed line onto either lineGfx or pathGfx */
  private dashedLine(
    x1: number, y1: number, x2: number, y2: number,
    color: number, alpha: number, width: number,
  ): void {
    const dx = x2 - x1
    const dy = y2 - y1
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 1) return

    const nx = dx / dist
    const ny = dy / dist
    const gfx = this.lineGfx
    gfx.lineStyle(width, color, alpha)

    let d = 0
    while (d < dist) {
      const end = Math.min(d + DASH_LEN, dist)
      gfx.beginPath()
      gfx.moveTo(x1 + nx * d, y1 + ny * d)
      gfx.lineTo(x1 + nx * end, y1 + ny * end)
      gfx.strokePath()
      d = end + GAP_LEN
    }
  }
}
