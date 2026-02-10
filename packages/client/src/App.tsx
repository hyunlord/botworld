import { useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import type { Agent, WorldClock, WorldEvent } from '@botworld/shared'
import { createGameConfig } from './game/config.js'
import { WorldScene } from './game/scenes/world-scene.js'
import { socketClient, type WorldState, type SpeedState } from './network/socket-client.js'
import { HUD } from './ui/HUD.js'
import { ChatLog } from './ui/ChatLog.js'
import { AgentInspector } from './ui/AgentInspector.js'

export function App() {
  const gameRef = useRef<Phaser.Game | null>(null)
  const sceneRef = useRef<WorldScene | null>(null)
  const sceneReady = useRef(false)
  const pendingState = useRef<WorldState | null>(null)

  const [clock, setClock] = useState<WorldClock | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [events, setEvents] = useState<WorldEvent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [connected, setConnected] = useState(false)
  const [speedState, setSpeedState] = useState<SpeedState>({ paused: false, speed: 1 })

  const agentNames = new Map(agents.map(a => [a.id, a.name]))

  /** Apply full world state to the Phaser scene */
  function applyState(state: WorldState) {
    const scene = sceneRef.current
    if (!scene || !sceneReady.current) {
      pendingState.current = state
      return
    }
    scene.setWorldData(state.map)
    scene.updateAgents(state.agents)
    scene.updateClock(state.clock)
    setClock(state.clock)
    setAgents(state.agents)
  }

  // Initialize Phaser game
  useEffect(() => {
    if (gameRef.current) return

    const config = createGameConfig('game-container')
    const game = new Phaser.Game(config)
    gameRef.current = game

    // Wait for the WorldScene to actually be created and running
    const checkScene = setInterval(() => {
      const scene = game.scene.getScene('WorldScene') as WorldScene | null
      if (scene && scene.scene.isActive()) {
        clearInterval(checkScene)
        sceneRef.current = scene
        sceneReady.current = true

        scene.events.on('agent:selected', (agentId: string) => {
          setAgents(prev => {
            const agent = prev.find(a => a.id === agentId) ?? null
            setSelectedAgent(agent)
            return prev
          })
        })

        // Apply any state that arrived before scene was ready
        if (pendingState.current) {
          applyState(pendingState.current)
          pendingState.current = null
        }

        // Ask server to re-send state now that scene is ready
        socketClient.requestState()
      }
    }, 100)

    return () => {
      clearInterval(checkScene)
      game.destroy(true)
      gameRef.current = null
    }
  }, [])

  // Connect to server
  useEffect(() => {
    socketClient.connect()
    setConnected(true)

    // Full state (on connect + on request)
    const unsubState = socketClient.onState((state: WorldState) => {
      applyState(state)
    })

    // Agent updates every tick from server
    const unsubAgents = socketClient.onAgents((newAgents: Agent[]) => {
      setAgents(newAgents)
      sceneRef.current?.updateAgents(newAgents)

      // Keep selected agent in sync
      setSelectedAgent(prev =>
        prev ? newAgents.find(a => a.id === prev.id) ?? null : null
      )
    })

    // Individual events (for chat log, speech bubbles, etc.)
    const unsubEvent = socketClient.onEvent((event: WorldEvent) => {
      setEvents(prev => [...prev.slice(-200), event])

      if (event.type === 'world:tick') {
        setClock(event.clock)
        sceneRef.current?.updateClock(event.clock)
      }

      sceneRef.current?.handleEvent(event)
    })

    // Speed state
    const unsubSpeed = socketClient.onSpeed((state: SpeedState) => {
      setSpeedState(state)
    })

    return () => {
      unsubState()
      unsubAgents()
      unsubEvent()
      unsubSpeed()
      socketClient.disconnect()
    }
  }, [])

  return (
    <div style={styles.app}>
      {/* Game canvas */}
      <div id="game-container" style={styles.game} />

      {/* Side panel */}
      <div style={styles.panel}>
        <div style={styles.header}>
          <h1 style={styles.logo}>Botworld</h1>
          <div style={{ ...styles.status, color: connected ? '#2ecc71' : '#e74c3c' }}>
            {connected ? 'Connected' : 'Disconnected'}
          </div>
        </div>

        <HUD clock={clock} agentCount={agents.length} speedState={speedState} />

        <div style={styles.agentList}>
          <h3 style={styles.sectionTitle}>Agents</h3>
          {agents.map(agent => (
            <div
              key={agent.id}
              style={{
                ...styles.agentItem,
                background: selectedAgent?.id === agent.id ? '#2a3a5e' : 'transparent',
              }}
              onClick={() => setSelectedAgent(agent)}
            >
              <span style={styles.agentName}>{agent.name}</span>
              <span style={styles.agentAction}>{agent.currentAction?.type ?? 'idle'}</span>
            </div>
          ))}
        </div>

        <AgentInspector agent={selectedAgent} />
        <ChatLog events={events} agentNames={agentNames} />
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    display: 'flex',
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
  },
  game: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  panel: {
    width: 320,
    flexShrink: 0,
    background: '#0d1117',
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    overflowY: 'auto',
    borderLeft: '1px solid #1a2a4a',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    margin: 0,
    fontSize: 20,
    color: '#e2b714',
    fontWeight: 'bold',
  },
  status: {
    fontSize: 11,
  },
  sectionTitle: {
    margin: '0 0 6px 0',
    fontSize: 13,
    color: '#8899aa',
  },
  agentList: {
    background: '#16213e',
    borderRadius: 8,
    padding: 10,
  },
  agentItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 8px',
    borderRadius: 4,
    cursor: 'pointer',
    marginBottom: 2,
    fontSize: 12,
  },
  agentName: {
    color: '#ccddee',
    fontWeight: 'bold',
  },
  agentAction: {
    color: '#667788',
    fontSize: 11,
  },
}
