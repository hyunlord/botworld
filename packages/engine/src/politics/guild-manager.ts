/**
 * GuildManager — guild creation, ranks, charter, factions, and drama.
 *
 * Guilds are founded by 3+ agents agreeing. They have a rank hierarchy,
 * AI-written charter, internal factions, and dramatic events (coups,
 * splits, mergers, betrayals) that fire automatically when conditions are met.
 */

import type {
  Guild, GuildType, GuildRank, GuildCharter, GuildFaction,
  GuildLeaderRecord, GuildRankName, WorldClock, Agent,
} from '@botworld/shared'
import { generateId, createDefaultRanks, createDefaultCharter } from '@botworld/shared'
import type { EventBus } from '../core/event-bus.js'
import type { RelationshipManager } from '../social/relationship-manager.js'
import type { ReputationSystem } from '../social/reputation-system.js'

const DRAMA_CHECK_INTERVAL = 200 // Check for drama every 200 ticks
const FACTION_FORM_THRESHOLD = 8 // Min members for faction formation

export class GuildManager {
  private guilds = new Map<string, Guild>()
  private agentGuild = new Map<string, string>() // agentId → guildId
  private eventBus: EventBus
  private relationshipManager: RelationshipManager | null = null
  private reputationSystem: ReputationSystem | null = null
  private lastDramaCheck = 0

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus
  }

  setRelationshipManager(rm: RelationshipManager): void {
    this.relationshipManager = rm
  }

  setReputationSystem(rs: ReputationSystem): void {
    this.reputationSystem = rs
  }

  /** Found a new guild (requires 3+ founders) */
  foundGuild(
    founderIds: string[],
    type: GuildType,
    tick: number,
    getAgentName: (id: string) => string,
    name?: string,
    motto?: string,
  ): Guild | null {
    if (founderIds.length < 3) return null

    // Check none are already in a guild
    for (const id of founderIds) {
      if (this.agentGuild.has(id)) return null
    }

    const leaderId = founderIds[0]
    const guildName = name ?? this.generateGuildName(type)
    const guildMotto = motto ?? this.generateMotto(type)

    const ranks = createDefaultRanks()
    ranks[0].holders = [leaderId] // guild_master
    // Other founders become members
    for (let i = 1; i < founderIds.length; i++) {
      ranks[3].holders.push(founderIds[i]) // member rank
    }

    const guild: Guild = {
      id: generateId(),
      name: guildName,
      motto: guildMotto,
      type,
      leaderId,
      treasury: 0,
      territoryPoi: null,
      reputation: 0,
      ranks,
      charter: createDefaultCharter(),
      factions: [],
      alliances: [],
      rivals: [],
      leaderHistory: [{
        agentId: leaderId,
        name: getAgentName(leaderId),
        from: tick,
        to: null,
        reason: 'founded',
      }],
      members: [...founderIds],
      createdAt: tick,
    }

    this.guilds.set(guild.id, guild)
    for (const id of founderIds) {
      this.agentGuild.set(id, guild.id)
    }

    // Add guild_mate relationship tags between all founders
    if (this.relationshipManager) {
      for (let i = 0; i < founderIds.length; i++) {
        for (let j = i + 1; j < founderIds.length; j++) {
          this.relationshipManager.applyInteraction(
            founderIds[i], founderIds[j], 'quest_completed', tick,
            { location: guildName },
          )
        }
      }
    }

    this.eventBus.emit({
      type: 'guild:created',
      guildId: guild.id,
      guildName: guild.name,
      guildType: type,
      founderId: leaderId,
      memberIds: founderIds,
      timestamp: tick,
    })

    return guild
  }

  /** Add a member to a guild */
  addMember(guildId: string, agentId: string, tick: number, rankName: GuildRankName = 'apprentice'): boolean {
    const guild = this.guilds.get(guildId)
    if (!guild) return false
    if (this.agentGuild.has(agentId)) return false

    guild.members.push(agentId)
    const rank = guild.ranks.find(r => r.name === rankName)
    if (rank) rank.holders.push(agentId)

    this.agentGuild.set(agentId, guildId)

    this.eventBus.emit({
      type: 'guild:member_joined',
      guildId: guild.id,
      guildName: guild.name,
      agentId,
      rank: rankName,
      timestamp: tick,
    })

    return true
  }

  /** Remove a member from their guild */
  removeMember(agentId: string, tick: number, reason: 'left' | 'kicked' | 'betrayed' = 'left'): boolean {
    const guildId = this.agentGuild.get(agentId)
    if (!guildId) return false

    const guild = this.guilds.get(guildId)
    if (!guild) return false

    guild.members = guild.members.filter(id => id !== agentId)
    for (const rank of guild.ranks) {
      rank.holders = rank.holders.filter(id => id !== agentId)
    }

    // Remove from factions
    for (const faction of guild.factions) {
      faction.members = faction.members.filter(id => id !== agentId)
      if (faction.leader === agentId && faction.members.length > 0) {
        faction.leader = faction.members[0]
      }
    }
    guild.factions = guild.factions.filter(f => f.members.length > 0)

    this.agentGuild.delete(agentId)

    // If leader left, promote vice_master or eldest member
    if (guild.leaderId === agentId) {
      const newLeader = guild.ranks[1].holders[0] ?? guild.members[0]
      if (newLeader) {
        this.setLeader(guild, newLeader, tick, 'resigned')
      }
    }

    this.eventBus.emit({
      type: 'guild:member_left',
      guildId: guild.id,
      guildName: guild.name,
      agentId,
      reason,
      timestamp: tick,
    })

    // Dissolve guild if too few members
    if (guild.members.length < 2) {
      this.dissolveGuild(guildId, tick)
    }

    return true
  }

  /** Promote a member to a higher rank */
  promote(guildId: string, agentId: string, newRank: GuildRankName): boolean {
    const guild = this.guilds.get(guildId)
    if (!guild) return false
    if (!guild.members.includes(agentId)) return false

    // Remove from current rank
    for (const rank of guild.ranks) {
      rank.holders = rank.holders.filter(id => id !== agentId)
    }

    // Add to new rank
    const rank = guild.ranks.find(r => r.name === newRank)
    if (rank) rank.holders.push(agentId)

    return true
  }

  /** Deposit gold into guild treasury */
  depositTreasury(guildId: string, amount: number): boolean {
    const guild = this.guilds.get(guildId)
    if (!guild || amount <= 0) return false
    guild.treasury += amount
    return true
  }

  /** Get guild by ID */
  getGuild(id: string): Guild | undefined {
    return this.guilds.get(id)
  }

  /** Get guild an agent belongs to */
  getAgentGuild(agentId: string): Guild | undefined {
    const guildId = this.agentGuild.get(agentId)
    return guildId ? this.guilds.get(guildId) : undefined
  }

  /** Get all guilds */
  getAllGuilds(): Guild[] {
    return [...this.guilds.values()]
  }

  /** Get agent's rank in their guild */
  getAgentRank(agentId: string): GuildRankName | null {
    const guild = this.getAgentGuild(agentId)
    if (!guild) return null
    for (const rank of guild.ranks) {
      if (rank.holders.includes(agentId)) return rank.name
    }
    return null
  }

  /** Calculate faction influence */
  calculateFactionInfluence(guild: Guild, faction: GuildFaction): number {
    if (guild.members.length === 0) return 0
    const memberRatio = faction.members.length / guild.members.length
    // Higher ranks count more toward influence
    let rankWeight = 0
    for (const memberId of faction.members) {
      for (let i = 0; i < guild.ranks.length; i++) {
        if (guild.ranks[i].holders.includes(memberId)) {
          rankWeight += (guild.ranks.length - i) // Higher rank = more weight
          break
        }
      }
    }
    const maxRankWeight = guild.members.length * guild.ranks.length
    const rankRatio = maxRankWeight > 0 ? rankWeight / maxRankWeight : 0

    return Math.round((memberRatio * 60 + rankRatio * 40))
  }

  /** Tick: check for drama conditions, faction formation */
  tick(clock: WorldClock, agents: Agent[]): void {
    if (clock.tick - this.lastDramaCheck < DRAMA_CHECK_INTERVAL) return
    this.lastDramaCheck = clock.tick

    for (const guild of this.guilds.values()) {
      // Update faction influences
      for (const faction of guild.factions) {
        faction.influence = this.calculateFactionInfluence(guild, faction)
      }

      // Check for natural faction formation
      if (guild.members.length >= FACTION_FORM_THRESHOLD && guild.factions.length < 2) {
        this.maybeFormFaction(guild, clock.tick)
      }

      // Check drama conditions
      this.checkCoupConditions(guild, clock.tick)
      this.checkSplitConditions(guild, clock.tick)
      this.checkBetrayalConditions(guild, agents, clock.tick)
    }
  }

  /** Format guild info for LLM context */
  formatForLLM(agentId: string, getAgentName: (id: string) => string): string {
    const guild = this.getAgentGuild(agentId)
    if (!guild) return ''

    const rank = this.getAgentRank(agentId)
    let line = `[Your Guild] ${guild.name} (${guild.type})\n`
    line += `  Motto: "${guild.motto}"\n`
    line += `  Your rank: ${rank ?? 'unknown'} | Members: ${guild.members.length} | Treasury: ${guild.treasury}G\n`

    if (guild.factions.length > 0) {
      line += `  Factions:\n`
      for (const f of guild.factions) {
        const leaderName = getAgentName(f.leader)
        line += `    - "${f.name}" led by ${leaderName} (influence: ${f.influence}%): ${f.agenda}\n`
      }
    }

    if (guild.alliances.length > 0) {
      const allyNames = guild.alliances
        .map(id => this.guilds.get(id)?.name)
        .filter(Boolean)
        .join(', ')
      if (allyNames) line += `  Allies: ${allyNames}\n`
    }

    if (guild.rivals.length > 0) {
      const rivalNames = guild.rivals
        .map(id => this.guilds.get(id)?.name)
        .filter(Boolean)
        .join(', ')
      if (rivalNames) line += `  Rivals: ${rivalNames}\n`
    }

    return line
  }

  // ── Private helpers ──

  private setLeader(guild: Guild, newLeaderId: string, tick: number, reason: GuildLeaderRecord['reason']): void {
    // Close old leader record
    const currentRecord = guild.leaderHistory.find(r => r.to === null)
    if (currentRecord) currentRecord.to = tick

    // Remove old leader from guild_master rank
    guild.ranks[0].holders = guild.ranks[0].holders.filter(id => id !== guild.leaderId)

    // Set new leader
    guild.leaderId = newLeaderId
    guild.ranks[0].holders = [newLeaderId]

    // Remove from any other rank
    for (let i = 1; i < guild.ranks.length; i++) {
      guild.ranks[i].holders = guild.ranks[i].holders.filter(id => id !== newLeaderId)
    }

    guild.leaderHistory.push({
      agentId: newLeaderId,
      name: newLeaderId, // Will be resolved to name by caller if needed
      from: tick,
      to: null,
      reason,
    })
  }

  private dissolveGuild(guildId: string, tick: number): void {
    const guild = this.guilds.get(guildId)
    if (!guild) return

    for (const memberId of guild.members) {
      this.agentGuild.delete(memberId)
    }
    this.guilds.delete(guildId)
  }

  private maybeFormFaction(guild: Guild, tick: number): void {
    // Simple heuristic: if there's tension in the guild (members with low trust toward leader),
    // a faction naturally forms
    if (!this.relationshipManager) return

    const discontented: string[] = []
    for (const memberId of guild.members) {
      if (memberId === guild.leaderId) continue
      const rel = this.relationshipManager.get(memberId, guild.leaderId)
      if (rel && rel.axes.trust < 20 && rel.axes.affection < 10) {
        discontented.push(memberId)
      }
    }

    if (discontented.length >= 3) {
      const factionLeader = discontented[0]
      const faction: GuildFaction = {
        name: this.generateFactionName(),
        leader: factionLeader,
        members: discontented,
        agenda: 'We need new leadership and a change in direction.',
        influence: 0,
      }
      faction.influence = this.calculateFactionInfluence(guild, faction)
      guild.factions.push(faction)
    }
  }

  private checkCoupConditions(guild: Guild, tick: number): void {
    // Coup: faction influence > 60% and leader approval < 30%
    if (!this.relationshipManager) return

    for (const faction of guild.factions) {
      if (faction.influence <= 60) continue

      // Calculate leader approval (average trust+affection from all members toward leader)
      let totalApproval = 0
      let count = 0
      for (const memberId of guild.members) {
        if (memberId === guild.leaderId) continue
        const rel = this.relationshipManager.get(memberId, guild.leaderId)
        if (rel) {
          totalApproval += (rel.axes.trust + rel.axes.affection) / 2
          count++
        }
      }

      const avgApproval = count > 0 ? totalApproval / count : 50

      if (avgApproval < 30) {
        // Coup attempt! Simple vote: faction members vote yes, others based on relationship
        let yesVotes = faction.members.length
        let noVotes = 0

        for (const memberId of guild.members) {
          if (faction.members.includes(memberId)) continue
          if (memberId === guild.leaderId) { noVotes++; continue }

          const relToLeader = this.relationshipManager.get(memberId, guild.leaderId)
          const relToFactionLeader = this.relationshipManager.get(memberId, faction.leader)
          const leaderScore = relToLeader ? (relToLeader.axes.trust + relToLeader.axes.respect) : 0
          const factionScore = relToFactionLeader ? (relToFactionLeader.axes.trust + relToFactionLeader.axes.respect) : 0

          if (factionScore > leaderScore) yesVotes++
          else noVotes++
        }

        if (yesVotes > noVotes) {
          // Coup succeeds
          this.setLeader(guild, faction.leader, tick, 'coup')
          guild.factions = guild.factions.filter(f => f !== faction)

          this.eventBus.emit({
            type: 'guild:drama',
            guildId: guild.id,
            guildName: guild.name,
            dramaType: 'coup',
            description: `A coup in ${guild.name}! ${faction.name} faction seized power. New leader elected.`,
            involvedAgentIds: [faction.leader, ...faction.members],
            timestamp: tick,
          })
        }
        break // Only one coup attempt per tick
      }
    }
  }

  private checkSplitConditions(guild: Guild, tick: number): void {
    if (guild.factions.length < 2 || !this.relationshipManager) return

    for (let i = 0; i < guild.factions.length; i++) {
      for (let j = i + 1; j < guild.factions.length; j++) {
        const fA = guild.factions[i]
        const fB = guild.factions[j]

        // Check mutual trust between faction leaders
        const relAB = this.relationshipManager.get(fA.leader, fB.leader)
        const relBA = this.relationshipManager.get(fB.leader, fA.leader)

        const trustAB = relAB?.axes.trust ?? 0
        const trustBA = relBA?.axes.trust ?? 0

        if (trustAB < 20 && trustBA < 20) {
          // Split! Smaller faction leaves
          const splitter = fA.members.length < fB.members.length ? fA : fB

          if (splitter.members.length >= 3) {
            // Remove splitters from this guild
            for (const memberId of splitter.members) {
              this.removeMember(memberId, tick, 'left')
            }

            // Found new guild
            this.foundGuild(
              splitter.members,
              guild.type,
              tick,
              (id) => id,
              `${splitter.name} ${guild.type === 'combat' ? 'Legion' : 'Guild'}`,
            )

            // Add rivalry
            const newGuild = this.getAgentGuild(splitter.leader)
            if (newGuild) {
              guild.rivals.push(newGuild.id)
              newGuild.rivals.push(guild.id)
            }

            this.eventBus.emit({
              type: 'guild:drama',
              guildId: guild.id,
              guildName: guild.name,
              dramaType: 'split',
              description: `${guild.name} has split! The ${splitter.name} faction has departed to form their own guild.`,
              involvedAgentIds: splitter.members,
              timestamp: tick,
            })

            return // Only one split per tick
          }
        }
      }
    }
  }

  private checkBetrayalConditions(guild: Guild, agents: Agent[], tick: number): void {
    if (!this.relationshipManager || !this.reputationSystem) return

    for (const memberId of guild.members) {
      if (memberId === guild.leaderId) continue

      // Check if member is unhappy (low trust/affection toward leader)
      const relToLeader = this.relationshipManager.get(memberId, guild.leaderId)
      if (!relToLeader || (relToLeader.axes.trust + relToLeader.axes.affection) > -20) continue

      // Check if they have a friend in a rival guild
      for (const rivalId of guild.rivals) {
        const rivalGuild = this.guilds.get(rivalId)
        if (!rivalGuild) continue

        for (const rivalMemberId of rivalGuild.members) {
          const rel = this.relationshipManager.get(memberId, rivalMemberId)
          if (rel && rel.axes.trust > 50) {
            // Betrayal! Agent defects to rival guild
            this.removeMember(memberId, tick, 'betrayed')
            this.addMember(rivalId, memberId, tick, 'member')

            // Apply betrayal relationship effects
            this.relationshipManager.applyInteraction(
              guild.leaderId, memberId, 'betrayal', tick,
            )

            // Add infamy
            this.reputationSystem.addInfamy(memberId, 20)

            this.eventBus.emit({
              type: 'guild:drama',
              guildId: guild.id,
              guildName: guild.name,
              dramaType: 'betrayal',
              description: `A member has betrayed ${guild.name} and defected to ${rivalGuild.name}!`,
              involvedAgentIds: [memberId],
              timestamp: tick,
            })

            return // Only one betrayal per tick
          }
        }
      }
    }
  }

  /** Attempt to merge two guilds */
  mergeGuilds(guildAId: string, guildBId: string, tick: number, getAgentName: (id: string) => string): Guild | null {
    const gA = this.guilds.get(guildAId)
    const gB = this.guilds.get(guildBId)
    if (!gA || !gB) return null

    // The larger guild absorbs the smaller
    const [main, absorbed] = gA.members.length >= gB.members.length ? [gA, gB] : [gB, gA]

    // Move all absorbed members to main guild
    for (const memberId of absorbed.members) {
      this.agentGuild.delete(memberId)
      if (!main.members.includes(memberId)) {
        main.members.push(memberId)
        main.ranks[3].holders.push(memberId) // member rank
        this.agentGuild.set(memberId, main.id)
      }
    }

    // Merge treasury
    main.treasury += absorbed.treasury

    // Remove absorbed guild
    this.guilds.delete(absorbed.id)

    // Remove from alliances/rivals
    main.alliances = main.alliances.filter(id => id !== absorbed.id)
    main.rivals = main.rivals.filter(id => id !== absorbed.id)

    this.eventBus.emit({
      type: 'guild:drama',
      guildId: main.id,
      guildName: main.name,
      dramaType: 'merge',
      description: `${absorbed.name} has merged into ${main.name}. The guild grows stronger!`,
      involvedAgentIds: [...main.members],
      timestamp: tick,
    })

    return main
  }

  // ── Name generators (simple deterministic) ──

  private generateGuildName(type: GuildType): string {
    const prefixes: Record<GuildType, string[]> = {
      trade: ['Silver', 'Golden', 'Iron', 'Merchant'],
      combat: ['Steel', 'Iron', 'Crimson', 'Shadow'],
      craft: ['Forge', 'Anvil', 'Hammer', 'Crystal'],
      exploration: ['Far', 'Wild', 'Storm', 'Dawn'],
      social: ['Unity', 'Harmony', 'Silver', 'Common'],
    }
    const suffixes: Record<GuildType, string[]> = {
      trade: ['Exchange', 'Company', 'Consortium', 'Traders'],
      combat: ['Legion', 'Guard', 'Wolves', 'Blades'],
      craft: ['Makers', 'Guild', 'Artisans', 'Crafters'],
      exploration: ['Seekers', 'Rangers', 'Scouts', 'Pathfinders'],
      social: ['Circle', 'Brotherhood', 'Fellowship', 'Council'],
    }
    const p = prefixes[type]
    const s = suffixes[type]
    return `${p[Math.floor(Math.random() * p.length)]} ${s[Math.floor(Math.random() * s.length)]}`
  }

  private generateMotto(type: GuildType): string {
    const mottos: Record<GuildType, string[]> = {
      trade: ['Profit through partnership.', 'Fair trade, fair profit.', 'Commerce unites all.'],
      combat: ['Strength in unity.', 'Steel and honor.', 'Victory or death.'],
      craft: ['Every stroke a masterpiece.', 'Quality above all.', 'We forge the future.'],
      exploration: ['Beyond the horizon.', 'No path left untrodden.', 'Discovery awaits.'],
      social: ['Together we thrive.', 'One for all, all for one.', 'In fellowship, strength.'],
    }
    const m = mottos[type]
    return m[Math.floor(Math.random() * m.length)]
  }

  private generateFactionName(): string {
    const names = ['Reform Party', 'Traditionalists', 'War Hawks', 'Peace Circle', 'New Dawn', 'Old Guard', 'Progressives']
    return names[Math.floor(Math.random() * names.length)]
  }
}
