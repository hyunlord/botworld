import { useEffect, useRef, useState, useMemo } from 'react'
import Phaser from 'phaser'
import type { Agent, WorldClock, WorldEvent, ChunkData, CharacterAppearanceMap, WeatherState, ActiveWorldEvent } from '@botworld/shared'
import { CHUNK_SIZE } from '@botworld/shared'
import { createGameConfig } from '../game/config.js'
import { WorldScene } from '../game/scenes/world-scene.js'
import { socketClient, type WorldState, type SpeedState } from '../network/socket-client.js'
import { BottomHUD } from '../ui/BottomHUD.js'
import { CharacterCard } from '../ui/CharacterCard.js'
import { EventFeed } from '../ui/EventFeed.js'
import { Minimap } from '../ui/Minimap.js'
import { EventBanner } from '../ui/EventBanner.js'
import { SendAgentModal } from '../ui/SendAgentButton.js'
import { soundManager } from '../game/audio/sound-manager.js'

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
  const [characterMap, setCharacterMap] = useState<CharacterAppearanceMap>({})
  const [spectatorCount, setSpectatorCount] = useState(0)
  const [chunks, setChunks] = useState<Record<string, ChunkData>>({})
  const [worldEvents, setWorldEvents] = useState<ActiveWorldEvent[]>([])
  const [following, setFollowing] = useState(false)
  const [weather, setWeather] = useState<string | null>(null)
  const [agentChat, setAgentChat] = useState<Map<string, string[]>>(new Map())
  const [showSendModal, setShowSendModal] = useState(false)

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
    if (state.worldEvents) setWorldEvents(state.worldEvents)
    if (state.monsters) scene.updateMonsters(state.monsters)
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

        if (pendingState.current) {
          applyState(pendingState.current)
          pendingState.current = null
        }

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

    const unsubState = socketClient.onState((state: WorldState) => {
      applyState(state)
    })

    const unsubAgents = socketClient.onAgents((newAgents: Agent[]) => {
      setAgents(newAgents)
      sceneRef.current?.updateAgents(newAgents)
      setSelectedAgent(prev =>
        prev ? newAgents.find(a => a.id === prev.id) ?? null : null
      )
    })

    const unsubEvent = socketClient.onEvent((event: WorldEvent) => {
      setEvents(prev => [...prev.slice(-200), event])

      if (event.type === 'world:tick') {
        setClock(event.clock)
        sceneRef.current?.updateClock(event.clock)
      }

      sceneRef.current?.handleEvent(event)

      if (event.type === 'agent:spoke') {
        setAgentChat(prev => {
          const next = new Map(prev)
          const msgs = next.get(event.agentId) ?? []
          next.set(event.agentId, [...msgs.slice(-9), event.message])
          return next
        })
      }
    })

    const unsubSpeed = socketClient.onSpeed((state: SpeedState) => {
      setSpeedState(state)
    })

    const unsubChunks = socketClient.onChunks((newChunks: Record<string, ChunkData>) => {
      sceneRef.current?.addChunks(newChunks)
      setChunks(prev => ({ ...prev, ...newChunks }))
    })

    const unsubChars = socketClient.onCharacters((map: CharacterAppearanceMap) => {
      setCharacterMap(map)
      sceneRef.current?.setCharacterAppearances(map)
    })

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

    const unsubWeather = socketClient.onWeather((weather: WeatherState) => {
      setWeather(weather.current)
      sceneRef.current?.setWeather(weather)
      if (weather.current === 'rain' || weather.current === 'storm') {
        soundManager.startRain()
      } else {
        soundManager.stopRain()
      }
      if (weather.current === 'storm' || weather.windIntensity > 0.5) {
        soundManager.startWind()
      } else {
        soundManager.stopWind()
      }
      if (weather.current === 'storm') {
        soundManager.playThunder()
      }
    })

    const unsubEventStarted = socketClient.onWorldEventStarted((event) => {
      setWorldEvents(prev => {
        const next = [...prev.filter(e => e.id !== event.id), event]
        sceneRef.current?.setWorldEvents(next)
        return next
      })
    })
    const unsubEventEnded = socketClient.onWorldEventEnded((data) => {
      setWorldEvents(prev => {
        const next = prev.filter(e => e.id !== data.eventId)
        sceneRef.current?.setWorldEvents(next)
        return next
      })
    })

    const unsubSpectators = socketClient.onSpectatorCount(setSpectatorCount)

    const unsubCombat = socketClient.onCombatEvent((event) => {
      const scene = sceneRef.current
      if (!scene) return
      if (event.type === 'combat:started' && 'position' in event) {
        const pos = event.position as { x: number; y: number }
        scene.showCombatEffect(pos.x, pos.y)
        soundManager.setCombat(true)
        soundManager.playAttack()
      }
      if (event.type === 'combat:round' && 'round' in event) {
        soundManager.playAttack()
        soundManager.playDamageHit()
      }
      if (event.type === 'combat:ended') {
        soundManager.setCombat(false)
        if ('outcome' in event && event.outcome === 'victory') {
          soundManager.playMonsterDie()
        }
      }
    })

    const unsubMonster = socketClient.onMonsterEvent((_event) => {
      // Monster events logged in EventFeed via world:event
    })

    return () => {
      unsubState()
      unsubAgents()
      unsubEvent()
      unsubSpeed()
      unsubChunks()
      unsubChars()
      unsubCharUpdate()
      unsubWeather()
      unsubEventStarted()
      unsubEventEnded()
      unsubSpectators()
      unsubCombat()
      unsubMonster()
      socketClient.disconnect()
    }
  }, [])

  const handleFollow = (agentId: string) => {
    sceneRef.current?.followAgent(agentId)
    setFollowing(true)
  }

  const handleUnfollow = () => {
    sceneRef.current?.unfollowAgent()
    setFollowing(false)
  }

  const handleFeedSelectAgent = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId)
    if (agent) {
      setSelectedAgent(agent)
      sceneRef.current?.centerOnTile(agent.position.x, agent.position.y)
    }
  }

  const selectedCharData = selectedAgent ? characterMap[selectedAgent.id] : undefined

  return (
    <div style={styles.app}>
      {/* Full-screen game canvas */}
      <div id="game-container" style={styles.game} />

      {/* Connection indicator (subtle top-left dot) */}
      <div style={{
        ...styles.connectionDot,
        background: connected ? '#2ecc71' : '#e74c3c',
      }} title={connected ? 'Connected' : 'Disconnected'} />

      {/* Event Banner (top center) */}
      <EventBanner
        activeEvents={worldEvents}
        onNavigate={(x, y) => sceneRef.current?.centerOnTile(x, y)}
      />

      {/* Minimap (bottom-left) */}
      <Minimap
        agents={agents}
        pois={pois}
        selectedAgentId={selectedAgent?.id ?? null}
        onNavigate={(x, y) => sceneRef.current?.centerOnTile(x, y)}
      />

      {/* Event Feed (bottom-right, collapsible) */}
      <EventFeed
        events={events}
        agentNames={agentNames}
        onNavigate={(x, y) => sceneRef.current?.centerOnTile(x, y)}
        onSelectAgent={handleFeedSelectAgent}
      />

      {/* Bottom HUD bar */}
      <BottomHUD
        clock={clock}
        agentCount={agents.length}
        spectatorCount={spectatorCount}
        speedState={speedState}
        weather={weather}
        selectedAgent={selectedAgent}
        characterData={selectedCharData ? {
          race: selectedCharData.race,
          characterClass: selectedCharData.characterClass,
        } : undefined}
        onSendAgent={() => setShowSendModal(true)}
      />

      {/* Character Card popup (shown when agent is selected) */}
      {selectedAgent && (
        <CharacterCard
          agent={selectedAgent}
          characterData={selectedCharData}
          onFollow={handleFollow}
          onUnfollow={handleUnfollow}
          isFollowing={following}
          recentChat={agentChat.get(selectedAgent.id)}
          onClose={() => { setSelectedAgent(null); setFollowing(false) }}
        />
      )}

      {/* Send Agent modal */}
      {showSendModal && (
        <SendAgentModal onClose={() => setShowSendModal(false)} />
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    position: 'relative',
    background: '#000',
  },
  game: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    inset: 0,
  },
  connectionDot: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    zIndex: 50,
    pointerEvents: 'none',
  },
}
