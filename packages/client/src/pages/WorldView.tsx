import { useEffect, useRef, useState, useMemo } from 'react'
import Phaser from 'phaser'
import type { Agent, WorldClock, WorldEvent, ChunkData, CharacterAppearanceMap, WeatherState, ActiveWorldEvent } from '@botworld/shared'
import { CHUNK_SIZE } from '@botworld/shared'
import { createGameConfig } from '../game/config.js'
import { WorldScene } from '../game/scenes/world-scene.js'
import { socketClient, type WorldState, type SpeedState } from '../network/socket-client.js'
import { BottomHUD } from '../ui/BottomHUD.js'
import CharacterCard from '../ui/CharacterCard.js'
import { EventFeed } from '../ui/EventFeed.js'
import { Minimap } from '../ui/Minimap.js'
import { EventBanner } from '../ui/EventBanner.js'
import { PoliticsPanel } from '../ui/PoliticsPanel.js'
import { HistoryPanel } from '../ui/HistoryPanel.js'
import { SendAgentModal } from '../ui/SendAgentButton.js'
import CreatureCard from '../ui/CreatureCard.js'
import BuildingCard from '../ui/BuildingCard.js'
import ItemCard from '../ui/ItemCard.js'
import ResourceCard from '../ui/ResourceCard.js'
import TerrainCard from '../ui/TerrainCard.js'
import { FollowHUD } from '../ui/FollowHUD.js'
import { NotificationSystem } from '../ui/NotificationSystem.js'
import { soundManager } from '../game/audio/sound-manager.js'
import { OV, injectGameStyles } from '../ui/overlay-styles.js'
import { RankingsPanel } from '../ui/RankingsPanel.js'
import { StatsDashboard } from '../ui/StatsDashboard.js'
import { TimelineView } from '../ui/TimelineView.js'
import { AgentCompare } from '../ui/AgentCompare.js'
import { FavoritesPanel } from '../ui/FavoritesPanel.js'
import { SoundSettings } from '../ui/SoundSettings.js'
import { ContextualHints } from '../ui/ContextualHints.js'
import { ErrorBoundary } from '../ui/ErrorBoundary.js'
import { LayerTabs } from '../ui/LayerTabs.js'

injectGameStyles()

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
  const [selectedCreature, setSelectedCreature] = useState<any>(null)
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null)
  const [selectedResource, setSelectedResource] = useState<any>(null)
  const [selectedTerrain, setSelectedTerrain] = useState<any>(null)
  const [followActionLog, setFollowActionLog] = useState<string[]>([])
  const [notifSubscriptions, setNotifSubscriptions] = useState<string[]>([])
  const [showRankings, setShowRankings] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [showTimeline, setShowTimeline] = useState(false)
  const [showCompare, setShowCompare] = useState(false)
  const [cinematicDone, setCinematicDone] = useState(false)
  const [layers, setLayers] = useState<{ id: string; name: string; type: string; depth: number; agentCount: number }[]>([])
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null)
  const [layerMapData, setLayerMapData] = useState<any>(null)

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
            setSelectedCreature(null)
            setSelectedBuilding(null)
            setSelectedResource(null)
            setSelectedTerrain(null)
            return prev
          })
        })

        scene.events.on('creature:selected', (creature: any) => {
          setSelectedCreature(creature)
          setSelectedAgent(null)
          setSelectedBuilding(null)
          setSelectedResource(null)
          setSelectedTerrain(null)
        })

        scene.events.on('building:selected', (building: any) => {
          setSelectedBuilding(building)
          setSelectedAgent(null)
          setSelectedCreature(null)
          setSelectedResource(null)
          setSelectedTerrain(null)
        })

        scene.events.on('resource:selected', (resource: any) => {
          setSelectedResource(resource)
          setSelectedAgent(null)
          setSelectedCreature(null)
          setSelectedBuilding(null)
          setSelectedTerrain(null)
        })

        scene.events.on('terrain:selected', (terrain: any) => {
          setSelectedTerrain(terrain)
          setSelectedAgent(null)
          setSelectedCreature(null)
          setSelectedBuilding(null)
          setSelectedResource(null)
        })

        scene.events.on('follow:stopped', () => {
          setFollowing(false)
        })

        scene.events.on('cinematic:complete', () => {
          setCinematicDone(true)
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

    const unsubConnect = socketClient.onConnect(() => {
      setConnected(true)
      socketClient.requestState()
    })
    const unsubDisconnect = socketClient.onDisconnect(() => {
      setConnected(false)
    })

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

      // Track action log for followed agent
      if (following && selectedAgent &&
          'agentId' in event && event.agentId === selectedAgent.id) {
        const description = event.type === 'agent:spoke' ? `Said: "${event.message}"`
          : event.type === 'agent:moved' ? `Moved to (${event.to.x}, ${event.to.y})`
          : event.type === 'combat:started' ? 'Entered combat!'
          : event.type === 'item:crafted' ? `Crafted ${event.item.name}`
          : event.type === 'resource:gathered' ? `Gathered ${event.resourceType}`
          : null
        if (description) {
          setFollowActionLog(prev => [...prev.slice(-49), description])
        }
      }

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
        soundManager.playBattleStart()
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

    const unsubLayerList = socketClient.onLayerList((layerList) => {
      setLayers(layerList)
      // Default to surface layer
      if (!activeLayerId && layerList.length > 0) {
        const surface = layerList.find(l => l.type === 'surface')
        if (surface) setActiveLayerId(surface.id)
      }
    })

    const unsubLayerMapData = socketClient.onLayerMapData((data) => {
      setLayerMapData(data)
      // Update Phaser scene with underground map if needed
      const scene = sceneRef.current
      if (scene && sceneReady.current && data.tiles) {
        scene.showUndergroundLayer(data)
      }
    })

    const unsubLayerTransition = socketClient.onLayerTransition((data) => {
      // Refresh layer list to update agent counts
      socketClient.requestLayers()
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
      unsubLayerList()
      unsubLayerMapData()
      unsubLayerTransition()
      unsubConnect()
      unsubDisconnect()
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

  const handleToggleSubscription = (agentId: string) => {
    setNotifSubscriptions(prev =>
      prev.includes(agentId)
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    )
  }

  const handleLayerSelect = (layerId: string) => {
    setActiveLayerId(layerId)
    const layer = layers.find(l => l.id === layerId)
    if (layer && layer.type !== 'surface') {
      // Request underground map data
      socketClient.requestLayerMap(layerId)
    } else {
      // Switch back to surface
      setLayerMapData(null)
      const scene = sceneRef.current
      if (scene && sceneReady.current) {
        scene.showSurfaceLayer()
      }
    }
  }

  const selectedCharData = selectedAgent ? characterMap[selectedAgent.id] : undefined

  return (
    <div style={styles.app}>
      {/* Full-screen game canvas */}
      <div id="game-container" style={styles.game} />

      {/* UI Overlay — pointer-events: none so Phaser canvas receives drag/scroll */}
      <div style={styles.overlay}>

      {/* Connection indicator */}
      {connected ? (
        <div style={{
          ...styles.connectionDot,
          background: '#2ecc71',
        }} title="Connected" />
      ) : (
        <div style={styles.reconnectBanner}>
          <div style={{ ...styles.connectionDot, background: '#e74c3c', position: 'relative', top: 0, left: 0 }} />
          <span>Reconnecting...</span>
        </div>
      )}

      {/* Layer Tabs (top center) */}
      <LayerTabs
        layers={layers}
        activeLayerId={activeLayerId}
        onLayerSelect={handleLayerSelect}
      />

      {/* Event Banner (top center) */}
      <EventBanner
        activeEvents={worldEvents}
        onNavigate={(x, y) => sceneRef.current?.centerOnTile(x, y)}
      />

      {/* Favorites Panel (top-left) */}
      <FavoritesPanel
        agents={agents}
        onNavigate={(x, y) => sceneRef.current?.centerOnTile(x, y)}
        onSelectAgent={handleFeedSelectAgent}
      />

      {/* Minimap (bottom-left) */}
      <Minimap
        agents={agents}
        pois={pois}
        selectedAgentId={selectedAgent?.id ?? null}
        onNavigate={(x, y) => sceneRef.current?.centerOnTile(x, y)}
      />

      {/* Politics Panel (top-right, collapsible) */}
      <PoliticsPanel agentNames={agentNames} />

      {/* History Panel (top-right, below Politics, collapsible) */}
      <HistoryPanel
        onNavigate={(x, y) => sceneRef.current?.centerOnTile(x, y)}
      />

      {/* Event Feed (bottom-right, collapsible) */}
      <EventFeed
        events={events}
        agentNames={agentNames}
        onNavigate={(x, y) => sceneRef.current?.centerOnTile(x, y)}
        onSelectAgent={handleFeedSelectAgent}
      />

      {/* Spectator Toolbar */}
      <div style={{
        position: 'absolute',
        bottom: 52,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 200,
        display: 'flex',
        gap: 6,
        pointerEvents: 'auto',
      }}>
        <button
          style={{ ...styles.toolbarBtn }}
          onClick={() => setShowRankings(true)}
          title="Rankings"
        >🏆</button>
        <button
          style={{ ...styles.toolbarBtn }}
          onClick={() => setShowStats(true)}
          title="Statistics"
        >📊</button>
        <button
          style={{ ...styles.toolbarBtn }}
          onClick={() => setShowTimeline(true)}
          title="Timeline"
        >📜</button>
        <button
          style={{ ...styles.toolbarBtn }}
          onClick={() => setShowCompare(true)}
          title="Compare Agents"
        >⚖️</button>
      </div>

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
        <ErrorBoundary>
          <CharacterCard
            agent={selectedAgent}
            allAgents={agents}
            onClose={() => { setSelectedAgent(null); setFollowing(false) }}
            onFollow={handleFollow}
            onNavigate={(x, y) => sceneRef.current?.centerOnTile(x, y)}
            isFollowing={following}
            characterData={selectedCharData}
          />
        </ErrorBoundary>
      )}

      {/* Creature Card */}
      {selectedCreature && (
        <ErrorBoundary>
          <CreatureCard
            creature={selectedCreature}
            onClose={() => setSelectedCreature(null)}
            onNavigate={(x, y) => sceneRef.current?.centerOnTile(x, y)}
          />
        </ErrorBoundary>
      )}

      {/* Building Card */}
      {selectedBuilding && (
        <ErrorBoundary>
          <BuildingCard
            building={selectedBuilding}
            onClose={() => setSelectedBuilding(null)}
            onNavigate={(x, y) => sceneRef.current?.centerOnTile(x, y)}
          />
        </ErrorBoundary>
      )}

      {/* Resource Card */}
      {selectedResource && (
        <ErrorBoundary>
          <ResourceCard
            resource={selectedResource}
            position={selectedResource.position || { x: 0, y: 0 }}
            onClose={() => setSelectedResource(null)}
            onNavigate={(x, y) => sceneRef.current?.centerOnTile(x, y)}
          />
        </ErrorBoundary>
      )}

      {/* Terrain Card */}
      {selectedTerrain && (
        <ErrorBoundary>
          <TerrainCard
            tile={selectedTerrain}
            position={selectedTerrain.position || { x: 0, y: 0 }}
            onClose={() => setSelectedTerrain(null)}
            onNavigate={(x, y) => sceneRef.current?.centerOnTile(x, y)}
          />
        </ErrorBoundary>
      )}

      {/* Follow HUD (shown when following an agent) */}
      {following && selectedAgent && (
        <FollowHUD
          agent={selectedAgent}
          actionLog={followActionLog}
          onStopFollow={handleUnfollow}
          onNavigate={(x, y) => sceneRef.current?.centerOnTile(x, y)}
        />
      )}

      {/* Notification System */}
      <NotificationSystem
        subscriptions={notifSubscriptions}
        events={events}
        onNavigate={(x, y) => sceneRef.current?.centerOnTile(x, y)}
        onSelectAgent={handleFeedSelectAgent}
        onToggleSubscription={handleToggleSubscription}
      />

      {/* Sound Settings */}
      <SoundSettings />

      {/* Contextual Hints (after cinematic intro) */}
      <ContextualHints active={cinematicDone} />

      </div>{/* end UI overlay */}

      {/* Send Agent modal */}
      {showSendModal && (
        <ErrorBoundary>
          <SendAgentModal onClose={() => setShowSendModal(false)} />
        </ErrorBoundary>
      )}

      {/* Rankings Panel */}
      {showRankings && (
        <ErrorBoundary>
          <RankingsPanel
            onClose={() => setShowRankings(false)}
            onSelectAgent={handleFeedSelectAgent}
            onNavigate={(x, y) => sceneRef.current?.centerOnTile(x, y)}
          />
        </ErrorBoundary>
      )}

      {/* Statistics Dashboard */}
      {showStats && (
        <ErrorBoundary>
          <StatsDashboard onClose={() => setShowStats(false)} />
        </ErrorBoundary>
      )}

      {/* Timeline View */}
      {showTimeline && (
        <ErrorBoundary>
          <TimelineView
            onClose={() => setShowTimeline(false)}
            onNavigate={(x, y) => sceneRef.current?.centerOnTile(x, y)}
            onSelectAgent={handleFeedSelectAgent}
          />
        </ErrorBoundary>
      )}

      {/* Agent Compare */}
      {showCompare && (
        <ErrorBoundary>
          <AgentCompare
            agents={agents}
            onClose={() => setShowCompare(false)}
            onSelectAgent={handleFeedSelectAgent}
          />
        </ErrorBoundary>
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
  overlay: {
    position: 'absolute',
    inset: 0,
    zIndex: 100,
    pointerEvents: 'none' as const,
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
  reconnectBanner: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 500,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(20, 20, 30, 0.85)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(231, 76, 60, 0.4)',
    borderRadius: 8,
    padding: '6px 12px',
    color: '#ff8888',
    fontSize: 12,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    pointerEvents: 'none',
    animation: 'pulse 2s ease-in-out infinite',
  },
  toolbarBtn: {
    background: OV.bg,
    backdropFilter: OV.blur,
    border: `1px solid ${OV.border}`,
    borderRadius: OV.radiusSm,
    color: OV.text,
    fontSize: 16,
    padding: '6px 10px',
    cursor: 'pointer',
    fontFamily: OV.font,
    transition: 'all 0.15s',
  },
}
