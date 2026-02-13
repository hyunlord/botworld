import { io, Socket } from 'socket.io-client'
import type { WorldEvent, Agent, WorldClock, ChunkData, CharacterAppearanceMap, CharacterAppearance, CharacterClass, Race, WeatherState, ActiveWorldEvent, Monster, CombatState } from '@botworld/shared'

export interface WorldState {
  clock: WorldClock
  agents: Agent[]
  chunks: Record<string, ChunkData>
  recentEvents: WorldEvent[]
  weather?: WeatherState
  worldEvents?: ActiveWorldEvent[]
  monsters?: Monster[]
}

export interface SpeedState {
  paused: boolean
  speed: number
}

export interface CharacterUpdatePayload {
  agentId: string
  appearance: CharacterAppearance
  race: Race
  characterClass?: CharacterClass
  persona_reasoning?: string
  spriteHash: string
}

type StateCallback = (state: WorldState) => void
type EventCallback = (event: WorldEvent) => void
type AgentsCallback = (agents: Agent[]) => void
type SpeedCallback = (state: SpeedState) => void
type ChunksCallback = (chunks: Record<string, ChunkData>) => void
type CharactersCallback = (map: CharacterAppearanceMap) => void
type CharacterUpdateCallback = (update: CharacterUpdatePayload) => void
type WeatherCallback = (weather: WeatherState) => void
type WorldEventStartedCallback = (event: ActiveWorldEvent) => void
type WorldEventEndedCallback = (data: { eventId: string; eventType: string; title: string }) => void
type CombatEventCallback = (event: WorldEvent) => void
type MonsterEventCallback = (event: WorldEvent) => void

class SocketClient {
  private socket: Socket | null = null
  private stateCallbacks: StateCallback[] = []
  private eventCallbacks: EventCallback[] = []
  private agentsCallbacks: AgentsCallback[] = []
  private speedCallbacks: SpeedCallback[] = []
  private chunksCallbacks: ChunksCallback[] = []
  private charactersCallbacks: CharactersCallback[] = []
  private characterUpdateCallbacks: CharacterUpdateCallback[] = []
  private weatherCallbacks: WeatherCallback[] = []
  private worldEventStartedCallbacks: WorldEventStartedCallback[] = []
  private worldEventEndedCallbacks: WorldEventEndedCallback[] = []
  private combatEventCallbacks: CombatEventCallback[] = []
  private monsterEventCallbacks: MonsterEventCallback[] = []
  private spectatorCountCallbacks: ((count: number) => void)[] = []
  private connectCallbacks: (() => void)[] = []
  private disconnectCallbacks: (() => void)[] = []

  connect(url?: string): void {
    const base = url ?? window.location.origin
    this.socket = io(`${base}/spectator`)

    this.socket.on('world:state', (state: WorldState) => {
      for (const cb of this.stateCallbacks) cb(state)
    })

    this.socket.on('world:event', (event: WorldEvent) => {
      for (const cb of this.eventCallbacks) cb(event)
    })

    this.socket.on('world:agents', (agents: Agent[]) => {
      for (const cb of this.agentsCallbacks) cb(agents)
    })

    this.socket.on('world:speed', (state: SpeedState) => {
      for (const cb of this.speedCallbacks) cb(state)
    })

    this.socket.on('world:chunks', (chunks: Record<string, ChunkData>) => {
      for (const cb of this.chunksCallbacks) cb(chunks)
    })

    this.socket.on('world:characters', (map: CharacterAppearanceMap) => {
      for (const cb of this.charactersCallbacks) cb(map)
    })

    this.socket.on('world:character_updated', (update: CharacterUpdatePayload) => {
      for (const cb of this.characterUpdateCallbacks) cb(update)
    })

    this.socket.on('world:weather', (weather: WeatherState) => {
      for (const cb of this.weatherCallbacks) cb(weather)
    })

    this.socket.on('world:event_started', (event: ActiveWorldEvent) => {
      for (const cb of this.worldEventStartedCallbacks) cb(event)
    })

    this.socket.on('world:event_ended', (data: { eventId: string; eventType: string; title: string }) => {
      for (const cb of this.worldEventEndedCallbacks) cb(data)
    })

    this.socket.on('combat:event', (event: WorldEvent) => {
      for (const cb of this.combatEventCallbacks) cb(event)
    })

    this.socket.on('monster:event', (event: WorldEvent) => {
      for (const cb of this.monsterEventCallbacks) cb(event)
    })

    this.socket.on('spectator:count', (count: number) => {
      for (const cb of this.spectatorCountCallbacks) cb(count)
    })

    this.socket.on('connect', () => {
      console.log('[Socket] Connected to Botworld server')
      for (const cb of this.connectCallbacks) cb()
    })

    this.socket.on('disconnect', () => {
      console.log('[Socket] Disconnected from server')
      for (const cb of this.disconnectCallbacks) cb()
    })
  }

  requestState(): void {
    this.socket?.emit('request:state')
  }

  requestChunks(keys: string[]): void {
    this.socket?.emit('request:chunks', keys)
  }

  onState(callback: StateCallback): () => void {
    this.stateCallbacks.push(callback)
    return () => { this.stateCallbacks = this.stateCallbacks.filter(cb => cb !== callback) }
  }

  onEvent(callback: EventCallback): () => void {
    this.eventCallbacks.push(callback)
    return () => { this.eventCallbacks = this.eventCallbacks.filter(cb => cb !== callback) }
  }

  onAgents(callback: AgentsCallback): () => void {
    this.agentsCallbacks.push(callback)
    return () => { this.agentsCallbacks = this.agentsCallbacks.filter(cb => cb !== callback) }
  }

  onSpeed(callback: SpeedCallback): () => void {
    this.speedCallbacks.push(callback)
    return () => { this.speedCallbacks = this.speedCallbacks.filter(cb => cb !== callback) }
  }

  onChunks(callback: ChunksCallback): () => void {
    this.chunksCallbacks.push(callback)
    return () => { this.chunksCallbacks = this.chunksCallbacks.filter(cb => cb !== callback) }
  }

  onCharacters(callback: CharactersCallback): () => void {
    this.charactersCallbacks.push(callback)
    return () => { this.charactersCallbacks = this.charactersCallbacks.filter(cb => cb !== callback) }
  }

  onCharacterUpdate(callback: CharacterUpdateCallback): () => void {
    this.characterUpdateCallbacks.push(callback)
    return () => { this.characterUpdateCallbacks = this.characterUpdateCallbacks.filter(cb => cb !== callback) }
  }

  onWeather(callback: WeatherCallback): () => void {
    this.weatherCallbacks.push(callback)
    return () => { this.weatherCallbacks = this.weatherCallbacks.filter(cb => cb !== callback) }
  }

  onWorldEventStarted(callback: WorldEventStartedCallback): () => void {
    this.worldEventStartedCallbacks.push(callback)
    return () => { this.worldEventStartedCallbacks = this.worldEventStartedCallbacks.filter(cb => cb !== callback) }
  }

  onWorldEventEnded(callback: WorldEventEndedCallback): () => void {
    this.worldEventEndedCallbacks.push(callback)
    return () => { this.worldEventEndedCallbacks = this.worldEventEndedCallbacks.filter(cb => cb !== callback) }
  }

  onCombatEvent(callback: CombatEventCallback): () => void {
    this.combatEventCallbacks.push(callback)
    return () => { this.combatEventCallbacks = this.combatEventCallbacks.filter(cb => cb !== callback) }
  }

  onMonsterEvent(callback: MonsterEventCallback): () => void {
    this.monsterEventCallbacks.push(callback)
    return () => { this.monsterEventCallbacks = this.monsterEventCallbacks.filter(cb => cb !== callback) }
  }

  onSpectatorCount(callback: (count: number) => void): () => void {
    this.spectatorCountCallbacks.push(callback)
    return () => { this.spectatorCountCallbacks = this.spectatorCountCallbacks.filter(cb => cb !== callback) }
  }

  onConnect(callback: () => void): () => void {
    this.connectCallbacks.push(callback)
    return () => { this.connectCallbacks = this.connectCallbacks.filter(cb => cb !== callback) }
  }

  onDisconnect(callback: () => void): () => void {
    this.disconnectCallbacks.push(callback)
    return () => { this.disconnectCallbacks = this.disconnectCallbacks.filter(cb => cb !== callback) }
  }

  pause(): void { this.socket?.emit('world:pause') }
  resume(): void { this.socket?.emit('world:resume') }
  setSpeed(speed: number): void { this.socket?.emit('world:setSpeed', speed) }
  disconnect(): void { this.socket?.disconnect() }

  /** Send viewport bounds for NPC priority scheduling */
  sendViewport(bounds: { minX: number; maxX: number; minY: number; maxY: number }): void {
    this.socket?.emit('viewport:update', bounds)
  }

  /** Tell server which NPC is being followed */
  sendFollowNpc(npcId: string | null): void {
    this.socket?.emit('follow:npc', { npcId })
  }
}

export const socketClient = new SocketClient()
