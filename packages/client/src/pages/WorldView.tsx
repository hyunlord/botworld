import { useEffect, useRef, useState, useMemo } from 'react'
import Phaser from 'phaser'
import type { Agent, WorldClock, WorldEvent, ChunkData, CharacterAppearanceMap, WeatherState } from '@botworld/shared'
import { CHUNK_SIZE } from '@botworld/shared'
import { createGameConfig } from '../game/config.js'
import { WorldScene } from '../game/scenes/world-scene.js'
import { socketClient, type WorldState, type SpeedState } from '../network/socket-client.js'
import { HUD } from '../ui/HUD.js'
import { ChatLog } from '../ui/ChatLog.js'
import { AgentInspector } from '../ui/AgentInspector.js'
import { Minimap } from '../ui/Minimap.js'
import { RACE_ICONS, CLASS_ICONS, ACTION_ICONS } from '../ui/constants.js'

export function WorldView() {
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
  const [panelOpen, setPanelOpen] = useState(true)
  const [characterMap, setCharacterMap] = useState<CharacterAppearanceMap>({})
  const [spectatorCount, setSpectatorCount] = useState(0)
  const [chunks, setChunks] = useState<Record<string, ChunkData>>({})

  const agentNames = new Map(agents.map(a => [a.id, a.name]))

  const pois = useMemo(() => {
    const result: { name: string; type: string; x: number; y: number }[] = []
    for (const chunk of Object.values(chunks)) {
      if (chunk.poi) {
        result.push({
          name: chunk.poi.name,
          type: chunk.poi.type,
          x: chunk.cx * CHUNK_SIZE + chunk.poi.localX,
          y: chunk.cy * CHUNK_SIZE + chunk.poi.localY,
        })
      }
    }
    return result
  }, [chunks])

  /** Apply full world state to the Phaser scene */
  function applyState(state: WorldState) {
    const scene = sceneRef.current
    if (!scene || !sceneReady.current) {
      pendingState.current = state
      return
    }
    scene.addChunks(state.chunks)
    scene.updateAgents(state.agents)
    scene.updateClock(state.clock)
    if (state.weather) scene.setWeather(state.weather)
    setClock(state.clock)
    setAgents(state.agents)
    setChunks(prev => ({ ...prev, ...state.chunks }))
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

    // New chunks generated on the fly
    const unsubChunks = socketClient.onChunks((newChunks: Record<string, ChunkData>) => {
      sceneRef.current?.addChunks(newChunks)
      setChunks(prev => ({ ...prev, ...newChunks }))
    })

    // Character appearances (sent once on connect)
    const unsubChars = socketClient.onCharacters((map: CharacterAppearanceMap) => {
      setCharacterMap(map)
      sceneRef.current?.setCharacterAppearances(map)
    })

    // Individual character appearance updates
    const unsubCharUpdate = socketClient.onCharacterUpdate((update) => {
      setCharacterMap(prev => ({
        ...prev,
        [update.agentId]: {
          appearance: update.appearance,
          race: update.race,
          characterClass: update.characterClass,
          persona_reasoning: update.persona_reasoning,
          spriteHash: update.spriteHash,
        },
      }))
      sceneRef.current?.updateCharacterAppearance(
        update.agentId, update.appearance, update.race, update.spriteHash,
      )
    })

    // Weather changes
    const unsubWeather = socketClient.onWeather((weather: WeatherState) => {
      sceneRef.current?.setWeather(weather)
    })

    // Spectator count
    const unsubSpectators = socketClient.onSpectatorCount(setSpectatorCount)

    return () => {
      unsubState()
      unsubAgents()
      unsubEvent()
      unsubSpeed()
      unsubChunks()
      unsubChars()
      unsubCharUpdate()
      unsubWeather()
      unsubSpectators()
      socketClient.disconnect()
    }
  }, [])

  return (
    <div style={styles.app}>
      {/* Game canvas + minimap overlay */}
      <div id="game-container" style={styles.game}>
        <Minimap
          agents={agents}
          pois={pois}
          selectedAgentId={selectedAgent?.id ?? null}
          onNavigate={(x, y) => sceneRef.current?.centerOnTile(x, y)}
        />
      </div>

      {/* Panel toggle button */}
      <button
        style={{ ...styles.toggleBtn, right: panelOpen ? 320 : 0 }}
        onClick={() => setPanelOpen(prev => !prev)}
        title={panelOpen ? 'Hide panel' : 'Show panel'}
      >
        {panelOpen ? '\u25B6' : '\u25C0'}
      </button>

      {/* Side panel */}
      {panelOpen && (
        <div style={styles.panel}>
          <div style={styles.header}>
            <h1 style={styles.logo}>Botworld</h1>
            <div style={{ ...styles.status, color: connected ? '#2ecc71' : '#e74c3c' }}>
              {connected ? 'Connected' : 'Disconnected'}
            </div>
          </div>

          <HUD clock={clock} agentCount={agents.length} spectatorCount={spectatorCount} speedState={speedState} />

          <div style={styles.agentList}>
            <h3 style={styles.sectionTitle}>Agents</h3>
            {agents.map(agent => {
              const charData = characterMap[agent.id]
              return (
                <div
                  key={agent.id}
                  style={{
                    ...styles.agentItem,
                    background: selectedAgent?.id === agent.id ? '#2a3a5e' : 'transparent',
                  }}
                  onClick={() => setSelectedAgent(agent)}
                >
                  <div style={styles.agentItemRow}>
                    {charData && (
                      <span style={styles.agentBadges}>
                        {RACE_ICONS[charData.race] ?? ''}{charData.characterClass ? CLASS_ICONS[charData.characterClass] ?? '' : ''}
                      </span>
                    )}
                    <span style={styles.agentName}>{agent.name}</span>
                    <span style={styles.agentLevel}>Lv{agent.level}</span>
                  </div>
                  <span style={styles.agentAction}>
                    {ACTION_ICONS[agent.currentAction?.type ?? 'idle'] ?? ''} {agent.currentAction?.type ?? 'idle'}
                  </span>
                </div>
              )
            })}
          </div>

          <AgentInspector
            agent={selectedAgent}
            characterData={selectedAgent ? characterMap[selectedAgent.id] : undefined}
          />
          <ChatLog events={events} agentNames={agentNames} />
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    display: 'flex',
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    position: 'relative',
  },
  game: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  toggleBtn: {
    position: 'absolute',
    right: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 100,
    width: 24,
    height: 48,
    background: '#16213e',
    border: '1px solid #1a2a4a',
    borderRight: 'none',
    borderRadius: '6px 0 0 6px',
    color: '#8899aa',
    fontSize: 12,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
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
    padding: '4px 8px',
    borderRadius: 4,
    cursor: 'pointer',
    marginBottom: 2,
    fontSize: 12,
  },
  agentItemRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  agentBadges: {
    fontSize: 11,
    lineHeight: 1,
  },
  agentName: {
    color: '#ccddee',
    fontWeight: 'bold',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  agentLevel: {
    fontSize: 9,
    color: '#e2b714',
    background: '#0d1117',
    borderRadius: 3,
    padding: '0 4px',
    flexShrink: 0,
  },
  agentAction: {
    color: '#667788',
    fontSize: 11,
    marginLeft: 19,
  },
}
