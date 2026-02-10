import { io, Socket } from 'socket.io-client'
import type { WorldEvent, Agent, WorldClock, ChunkData } from '@botworld/shared'

export interface WorldState {
  clock: WorldClock
  agents: Agent[]
  chunks: Record<string, ChunkData>
  recentEvents: WorldEvent[]
}

export interface SpeedState {
  paused: boolean
  speed: number
}

type StateCallback = (state: WorldState) => void
type EventCallback = (event: WorldEvent) => void
type AgentsCallback = (agents: Agent[]) => void
type SpeedCallback = (state: SpeedState) => void
type ChunksCallback = (chunks: Record<string, ChunkData>) => void

class SocketClient {
  private socket: Socket | null = null
  private stateCallbacks: StateCallback[] = []
  private eventCallbacks: EventCallback[] = []
  private agentsCallbacks: AgentsCallback[] = []
  private speedCallbacks: SpeedCallback[] = []
  private chunksCallbacks: ChunksCallback[] = []

  connect(url?: string): void {
    this.socket = io(url ?? window.location.origin)

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

    this.socket.on('connect', () => {
      console.log('[Socket] Connected to Botworld server')
    })

    this.socket.on('disconnect', () => {
      console.log('[Socket] Disconnected from server')
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

  pause(): void { this.socket?.emit('world:pause') }
  resume(): void { this.socket?.emit('world:resume') }
  setSpeed(speed: number): void { this.socket?.emit('world:setSpeed', speed) }
  disconnect(): void { this.socket?.disconnect() }
}

export const socketClient = new SocketClient()
