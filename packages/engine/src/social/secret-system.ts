/**
 * SecretSystem — secrets as political leverage.
 *
 * Agents can discover or create secrets about others.
 * Knowing a secret gives three options (decided by AI):
 *   - Reveal: destroy target's reputation, ruin relationship with target
 *   - Blackmail: force favorable trade/behavior (harder to refuse with high leverage)
 *   - Keep: maintain relationship, save for later
 */

import type { Secret, SecretType, WorldClock } from '@botworld/shared'
import { generateId } from '@botworld/shared'
import type { EventBus } from '../core/event-bus.js'
import type { RelationshipManager } from './relationship-manager.js'

const MAX_SECRETS = 100

export class SecretSystem {
  private secrets = new Map<string, Secret>()
  private eventBus: EventBus
  private relationshipManager: RelationshipManager | null = null

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus
  }

  setRelationshipManager(rm: RelationshipManager): void {
    this.relationshipManager = rm
  }

  /** Create a new secret */
  createSecret(
    ownerId: string,
    type: SecretType,
    content: string,
    leverage: number,
    discoveredBy: string,
  ): Secret {
    const secret: Secret = {
      id: generateId(),
      ownerId,
      knownBy: [discoveredBy],
      type,
      content,
      leverage: Math.max(0, Math.min(100, leverage)),
      revealed: false,
    }
    this.secrets.set(secret.id, secret)

    // Prune if too many
    if (this.secrets.size > MAX_SECRETS) {
      this.pruneRevealed()
    }

    return secret
  }

  /** Share a secret with another agent */
  shareSecret(secretId: string, toAgentId: string): boolean {
    const secret = this.secrets.get(secretId)
    if (!secret || secret.revealed) return false
    if (!secret.knownBy.includes(toAgentId)) {
      secret.knownBy.push(toAgentId)
    }
    return true
  }

  /**
   * Reveal a secret publicly.
   * This destroys the secret owner's reputation and ruins the relationship
   * between the revealer and the owner.
   */
  revealSecret(secretId: string, revealedBy: string, tick: number): boolean {
    const secret = this.secrets.get(secretId)
    if (!secret || secret.revealed) return false

    secret.revealed = true

    // Emit event
    this.eventBus.emit({
      type: 'secret:revealed',
      secretId: secret.id,
      secretType: secret.type,
      ownerId: secret.ownerId,
      revealedBy,
      content: secret.content,
      timestamp: tick,
    })

    // Destroy relationship between revealer and owner
    if (this.relationshipManager) {
      this.relationshipManager.applyInteraction(
        secret.ownerId, revealedBy, 'betrayal', tick,
        { actor: revealedBy, target: secret.ownerId },
      )
    }

    return true
  }

  /** Get secrets known by a specific agent (unrevealed only) */
  getSecretsKnownBy(agentId: string): Secret[] {
    const result: Secret[] = []
    for (const secret of this.secrets.values()) {
      if (!secret.revealed && secret.knownBy.includes(agentId)) {
        result.push(secret)
      }
    }
    return result
  }

  /** Get secrets about a specific agent (unrevealed only) */
  getSecretsAbout(ownerId: string): Secret[] {
    const result: Secret[] = []
    for (const secret of this.secrets.values()) {
      if (!secret.revealed && secret.ownerId === ownerId) {
        result.push(secret)
      }
    }
    return result
  }

  /** Format secrets for LLM context */
  formatForLLM(agentId: string, getAgentName: (id: string) => string): string {
    const secrets = this.getSecretsKnownBy(agentId)
      .filter(s => s.ownerId !== agentId) // Don't include own secrets
    if (secrets.length === 0) return ''

    const lines = secrets.map(s => {
      const ownerName = getAgentName(s.ownerId)
      return `- About ${ownerName} (leverage ${s.leverage}): ${s.content}\n  Options: reveal (destroy reputation), blackmail (force cooperation), or keep quiet`
    })

    return `[Secrets you know]\n${lines.join('\n')}`
  }

  /** Get all secrets (for API) */
  getAllSecrets(): Secret[] {
    return [...this.secrets.values()]
  }

  tick(_clock: WorldClock): void {
    // Secrets don't expire, but could add mechanics here later
  }

  private pruneRevealed(): void {
    for (const [id, secret] of this.secrets) {
      if (secret.revealed) {
        this.secrets.delete(id)
      }
    }
  }
}
