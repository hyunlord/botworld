import { generateId } from '@botworld/shared'
import type {
  WorldLayer,
  DungeonRoom,
  DungeonTrap,
  LayerPortal,
  LayerSpawnEntry,
  LayerResourceEntry,
} from '@botworld/shared'

export class UndergroundGenerator {
  /**
   * Generate all 3 underground layers
   */
  generateUnderground(surfaceEntrance: { x: number; y: number }): {
    mine: WorldLayer
    cavern: WorldLayer
    ruins: WorldLayer
    tiles: Map<string, number[][]>
    rooms: Map<string, DungeonRoom[]>
    traps: Map<string, DungeonTrap[]>
  } {
    const mineResult = this.generateMine(surfaceEntrance)
    const cavernResult = this.generateCavern()
    const ruinsResult = this.generateRuins()

    const tiles = new Map<string, number[][]>()
    tiles.set(mineResult.layer.id, mineResult.tiles)
    tiles.set(cavernResult.layer.id, cavernResult.tiles)
    tiles.set(ruinsResult.layer.id, ruinsResult.tiles)

    const rooms = new Map<string, DungeonRoom[]>()
    rooms.set(mineResult.layer.id, mineResult.rooms)
    rooms.set(cavernResult.layer.id, cavernResult.rooms)
    rooms.set(ruinsResult.layer.id, ruinsResult.rooms)

    const traps = new Map<string, DungeonTrap[]>()
    traps.set(ruinsResult.layer.id, ruinsResult.traps)

    return {
      mine: mineResult.layer,
      cavern: cavernResult.layer,
      ruins: ruinsResult.layer,
      tiles,
      rooms,
      traps,
    }
  }

  /**
   * Generate Mine (depth -1): 30x30, tunnel+room structure
   */
  private generateMine(entrancePos: { x: number; y: number }): {
    layer: WorldLayer
    tiles: number[][]
    rooms: DungeonRoom[]
  } {
    const width = 30
    const height = 30
    const tiles: number[][] = Array(height)
      .fill(0)
      .map(() => Array(width).fill(0))

    // Generate 6-10 rooms
    const numRooms = 6 + Math.floor(Math.random() * 5)
    const rooms = this.generateRooms(width, height, numRooms, numRooms)

    // Carve out rooms
    for (const room of rooms) {
      for (let y = room.y; y < room.y + room.height; y++) {
        for (let x = room.x; x < room.x + room.width; x++) {
          if (x >= 0 && x < width && y >= 0 && y < height) {
            tiles[y][x] = 1 // floor
          }
        }
      }
    }

    // Connect rooms with tunnels
    this.connectRooms(tiles, rooms)

    // Place resources
    const resourceTable: LayerResourceEntry[] = [
      { resourceType: 'iron_ore', abundance: 0.3, clusterSize: 3, respawnTicks: 600 },
      { resourceType: 'copper_ore', abundance: 0.2, clusterSize: 2, respawnTicks: 500 },
      { resourceType: 'tin_ore', abundance: 0.2, clusterSize: 2, respawnTicks: 500 },
      { resourceType: 'coal', abundance: 0.3, clusterSize: 3, respawnTicks: 400 },
    ]
    this.placeResources(tiles, rooms, resourceTable)

    const spawnTable: LayerSpawnEntry[] = [
      { creatureType: 'bat', weight: 5, minCount: 2, maxCount: 4, conditions: [] },
      { creatureType: 'rat', weight: 3, minCount: 1, maxCount: 3, conditions: [] },
      { creatureType: 'cave_spider', weight: 2, minCount: 1, maxCount: 2, conditions: [] },
    ]

    const mineId = generateId('layer_mine')
    const cavernId = generateId('layer_cavern')

    // Portal back to surface
    const surfacePortal: LayerPortal = {
      id: generateId('portal'),
      sourceLayerId: mineId,
      sourcePosition: { x: 15, y: 15 },
      targetLayerId: 'surface',
      targetPosition: entrancePos,
      portalType: 'mine_entrance',
      discovered: true,
      discoveredBy: [],
    }

    // Portal down to cavern (placed in random room)
    const randomRoom = rooms[Math.floor(Math.random() * rooms.length)]
    const caveHolePortal: LayerPortal = {
      id: generateId('portal'),
      sourceLayerId: mineId,
      sourcePosition: {
        x: randomRoom.x + Math.floor(randomRoom.width / 2),
        y: randomRoom.y + Math.floor(randomRoom.height / 2),
      },
      targetLayerId: cavernId,
      targetPosition: { x: 25, y: 25 },
      portalType: 'cave_hole',
      discovered: false,
      discoveredBy: [],
    }

    const layer: WorldLayer = {
      id: mineId,
      name: 'The Mine',
      type: 'mine',
      depth: -1,
      width,
      height,
      ambientLight: 0.1,
      dangerLevel: 3,
      portals: [surfacePortal, caveHolePortal],
      spawnTable,
      resourceTable,
      rules: {
        allowCombat: true,
        allowBuilding: false,
        requiresLight: true,
        fogOfWar: true,
        weatherAffected: false,
        timeOfDayAffected: false,
      },
    }

    return { layer, tiles, rooms }
  }

  /**
   * Generate Cavern (depth -2): 50x50, big caves + underground lake + mushroom forest + crystal veins
   */
  private generateCavern(): {
    layer: WorldLayer
    tiles: number[][]
    rooms: DungeonRoom[]
  } {
    const width = 50
    const height = 50
    const tiles: number[][] = Array(height)
      .fill(0)
      .map(() => Array(width).fill(0))

    // Generate 8-14 rooms, some large
    const numRooms = 8 + Math.floor(Math.random() * 7)
    const rooms: DungeonRoom[] = []

    for (let i = 0; i < numRooms; i++) {
      const w = Math.random() < 0.3 ? 8 + Math.floor(Math.random() * 8) : 3 + Math.floor(Math.random() * 4)
      const h = Math.random() < 0.3 ? 8 + Math.floor(Math.random() * 8) : 3 + Math.floor(Math.random() * 4)
      const x = 2 + Math.floor(Math.random() * (width - w - 4))
      const y = 2 + Math.floor(Math.random() * (height - h - 4))

      let roomType: DungeonRoom['type'] = 'normal'
      if (i === 0) roomType = 'lake'
      else if (i === 1) roomType = 'mushroom_forest'
      else if (i === 2) roomType = 'crystal_cave'

      rooms.push({
        id: generateId('room'),
        x,
        y,
        width: w,
        height: h,
        type: roomType,
        connected: [],
      })
    }

    // Carve out rooms with special tiles
    for (const room of rooms) {
      for (let y = room.y; y < room.y + room.height; y++) {
        for (let x = room.x; x < room.x + room.width; x++) {
          if (x >= 0 && x < width && y >= 0 && y < height) {
            if (room.type === 'lake') {
              tiles[y][x] = 2 // water
            } else if (room.type === 'mushroom_forest') {
              tiles[y][x] = Math.random() < 0.4 ? 5 : 1 // mushroom or floor
            } else if (room.type === 'crystal_cave') {
              tiles[y][x] = Math.random() < 0.3 ? 4 : 1 // crystal or floor
            } else {
              tiles[y][x] = 1 // floor
            }
          }
        }
      }
    }

    // Connect rooms
    this.connectRooms(tiles, rooms)

    const resourceTable: LayerResourceEntry[] = [
      { resourceType: 'gold_ore', abundance: 0.15, clusterSize: 2, respawnTicks: 800 },
      { resourceType: 'crystal', abundance: 0.2, clusterSize: 3, respawnTicks: 1000 },
      { resourceType: 'iron_ore', abundance: 0.1, clusterSize: 2, respawnTicks: 600 },
      { resourceType: 'underground_mushroom', abundance: 0.25, clusterSize: 4, respawnTicks: 300 },
    ]
    this.placeResources(tiles, rooms, resourceTable)

    const spawnTable: LayerSpawnEntry[] = [
      { creatureType: 'giant_spider', weight: 4, minCount: 1, maxCount: 2, conditions: [] },
      { creatureType: 'troll', weight: 2, minCount: 1, maxCount: 1, conditions: [] },
      { creatureType: 'blind_fish', weight: 3, minCount: 2, maxCount: 4, conditions: ['near_water'] },
      { creatureType: 'cave_beetle', weight: 5, minCount: 2, maxCount: 5, conditions: [] },
    ]

    const cavernId = generateId('layer_cavern')
    const ruinsId = generateId('layer_ruins')
    const mineId = generateId('layer_mine')

    // Portal back to mine
    const minePortal: LayerPortal = {
      id: generateId('portal'),
      sourceLayerId: cavernId,
      sourcePosition: { x: 25, y: 25 },
      targetLayerId: mineId,
      targetPosition: { x: 15, y: 15 },
      portalType: 'cave_hole',
      discovered: true,
      discoveredBy: [],
    }

    // Portal down to ruins (secret door in random room)
    const randomRoom = rooms.filter((r) => r.type === 'normal')[Math.floor(Math.random() * rooms.filter((r) => r.type === 'normal').length)] || rooms[0]
    const ruinsPortal: LayerPortal = {
      id: generateId('portal'),
      sourceLayerId: cavernId,
      sourcePosition: {
        x: randomRoom.x + Math.floor(randomRoom.width / 2),
        y: randomRoom.y + Math.floor(randomRoom.height / 2),
      },
      targetLayerId: ruinsId,
      targetPosition: { x: 20, y: 20 },
      portalType: 'secret_door',
      discovered: false,
      discoveredBy: [],
    }

    const layer: WorldLayer = {
      id: cavernId,
      name: 'The Deep Cavern',
      type: 'cavern',
      depth: -2,
      width,
      height,
      ambientLight: 0.15,
      dangerLevel: 6,
      portals: [minePortal, ruinsPortal],
      spawnTable,
      resourceTable,
      rules: {
        allowCombat: true,
        allowBuilding: false,
        requiresLight: true,
        fogOfWar: true,
        weatherAffected: false,
        timeOfDayAffected: false,
      },
    }

    return { layer, tiles, rooms }
  }

  /**
   * Generate Ancient Ruins (depth -3): 40x40, ancient buildings + traps + puzzle rooms
   */
  private generateRuins(): {
    layer: WorldLayer
    tiles: number[][]
    rooms: DungeonRoom[]
    traps: DungeonTrap[]
  } {
    const width = 40
    const height = 40
    const tiles: number[][] = Array(height)
      .fill(0)
      .map(() => Array(width).fill(0))

    // Generate 10-16 rooms in structured pattern
    const numRooms = 10 + Math.floor(Math.random() * 7)
    const rooms: DungeonRoom[] = []

    // Create grid-like structure
    const gridSize = Math.ceil(Math.sqrt(numRooms))
    const cellWidth = Math.floor(width / gridSize)
    const cellHeight = Math.floor(height / gridSize)

    for (let i = 0; i < numRooms; i++) {
      const gridX = i % gridSize
      const gridY = Math.floor(i / gridSize)

      const w = 3 + Math.floor(Math.random() * 4)
      const h = 3 + Math.floor(Math.random() * 4)
      const x = gridX * cellWidth + Math.floor(Math.random() * (cellWidth - w - 2)) + 1
      const y = gridY * cellHeight + Math.floor(Math.random() * (cellHeight - h - 2)) + 1

      let roomType: DungeonRoom['type'] = 'normal'
      if (i === 0) roomType = 'boss'
      else if (i === 1) roomType = 'treasure'
      else if (i === 2 || i === 3) roomType = 'puzzle'
      else if (i === 4) roomType = 'shrine'

      rooms.push({
        id: generateId('room'),
        x,
        y,
        width: w,
        height: h,
        type: roomType,
        connected: [],
      })
    }

    // Carve out rooms
    for (const room of rooms) {
      for (let y = room.y; y < room.y + room.height; y++) {
        for (let x = room.x; x < room.x + room.width; x++) {
          if (x >= 0 && x < width && y >= 0 && y < height) {
            tiles[y][x] = 1 // floor
          }
        }
      }
    }

    // Connect rooms
    this.connectRooms(tiles, rooms)

    // Add some rubble in corners
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (tiles[y][x] === 1 && Math.random() < 0.05) {
          tiles[y][x] = 8 // rubble
        }
      }
    }

    // Generate 5-10 traps
    const numTraps = 5 + Math.floor(Math.random() * 6)
    const traps: DungeonTrap[] = []
    const trapTypes: DungeonTrap['type'][] = ['spike', 'poison_dart', 'falling_rock', 'fire_vent']

    for (let i = 0; i < numTraps; i++) {
      // Place in corridors or rooms
      let x = 0
      let y = 0
      let attempts = 0
      do {
        x = Math.floor(Math.random() * width)
        y = Math.floor(Math.random() * height)
        attempts++
      } while (tiles[y][x] !== 1 && attempts < 100)

      if (tiles[y][x] === 1) {
        const trapType = trapTypes[Math.floor(Math.random() * trapTypes.length)]
        let detectionLevel = 3
        if (trapType === 'poison_dart') detectionLevel = 5
        else if (trapType === 'fire_vent') detectionLevel = 4
        else if (trapType === 'falling_rock') detectionLevel = 4

        traps.push({
          id: generateId('trap'),
          position: { x, y },
          type: trapType,
          damage: 10 + Math.floor(Math.random() * 20),
          detected: false,
          disarmed: false,
          detectionSkill: 'stealth',
          detectionLevel,
        })

        tiles[y][x] = 6 // trap tile
      }
    }

    const resourceTable: LayerResourceEntry[] = [
      { resourceType: 'mithril_ore', abundance: 0.1, clusterSize: 1, respawnTicks: 1200 },
      { resourceType: 'obsidian', abundance: 0.15, clusterSize: 2, respawnTicks: 1000 },
      { resourceType: 'ancient_artifact', abundance: 0.05, clusterSize: 1, respawnTicks: 2400 },
    ]
    this.placeResources(tiles, rooms, resourceTable)

    const spawnTable: LayerSpawnEntry[] = [
      { creatureType: 'ancient_golem', weight: 3, minCount: 1, maxCount: 2, conditions: [] },
      { creatureType: 'lich', weight: 1, minCount: 1, maxCount: 1, conditions: [] },
      { creatureType: 'skeleton', weight: 5, minCount: 2, maxCount: 4, conditions: [] },
      { creatureType: 'phantom', weight: 3, minCount: 1, maxCount: 3, conditions: [] },
    ]

    const ruinsId = generateId('layer_ruins')
    const cavernId = generateId('layer_cavern')

    // Portal back to cavern
    const cavernPortal: LayerPortal = {
      id: generateId('portal'),
      sourceLayerId: ruinsId,
      sourcePosition: { x: 20, y: 20 },
      targetLayerId: cavernId,
      targetPosition: { x: 25, y: 25 },
      portalType: 'secret_door',
      discovered: true,
      discoveredBy: [],
    }

    const layer: WorldLayer = {
      id: ruinsId,
      name: 'Ancient Ruins',
      type: 'ancient_ruins',
      depth: -3,
      width,
      height,
      ambientLight: 0.05,
      dangerLevel: 9,
      portals: [cavernPortal],
      spawnTable,
      resourceTable,
      rules: {
        allowCombat: true,
        allowBuilding: false,
        requiresLight: true,
        fogOfWar: true,
        weatherAffected: false,
        timeOfDayAffected: false,
      },
    }

    return { layer, tiles, rooms, traps }
  }

  /**
   * BSP-based room generation
   */
  private generateRooms(width: number, height: number, minRooms: number, maxRooms: number): DungeonRoom[] {
    const rooms: DungeonRoom[] = []
    const numRooms = minRooms + Math.floor(Math.random() * (maxRooms - minRooms + 1))

    for (let i = 0; i < numRooms; i++) {
      const w = 3 + Math.floor(Math.random() * 4) // 3-6 wide
      const h = 3 + Math.floor(Math.random() * 4) // 3-6 tall
      const x = 1 + Math.floor(Math.random() * (width - w - 2))
      const y = 1 + Math.floor(Math.random() * (height - h - 2))

      // Check for overlap
      let overlap = false
      for (const room of rooms) {
        if (
          x < room.x + room.width + 1 &&
          x + w + 1 > room.x &&
          y < room.y + room.height + 1 &&
          y + h + 1 > room.y
        ) {
          overlap = true
          break
        }
      }

      if (!overlap) {
        rooms.push({
          id: generateId('room'),
          x,
          y,
          width: w,
          height: h,
          type: 'normal',
          connected: [],
        })
      }
    }

    return rooms
  }

  /**
   * Connect rooms with tunnels (corridors)
   */
  private connectRooms(tiles: number[][], rooms: DungeonRoom[]): void {
    for (let i = 0; i < rooms.length - 1; i++) {
      const roomA = rooms[i]
      const roomB = rooms[i + 1]

      // Center points
      const x1 = Math.floor(roomA.x + roomA.width / 2)
      const y1 = Math.floor(roomA.y + roomA.height / 2)
      const x2 = Math.floor(roomB.x + roomB.width / 2)
      const y2 = Math.floor(roomB.y + roomB.height / 2)

      // L-shaped corridor
      if (Math.random() < 0.5) {
        // Horizontal then vertical
        this.carveTunnel(tiles, x1, y1, x2, y1)
        this.carveTunnel(tiles, x2, y1, x2, y2)
      } else {
        // Vertical then horizontal
        this.carveTunnel(tiles, x1, y1, x1, y2)
        this.carveTunnel(tiles, x1, y2, x2, y2)
      }

      roomA.connected.push(roomB.id)
      roomB.connected.push(roomA.id)
    }
  }

  /**
   * Carve a tunnel between two points
   */
  private carveTunnel(tiles: number[][], x1: number, y1: number, x2: number, y2: number): void {
    const minX = Math.min(x1, x2)
    const maxX = Math.max(x1, x2)
    const minY = Math.min(y1, y2)
    const maxY = Math.max(y1, y2)

    for (let x = minX; x <= maxX; x++) {
      if (y1 >= 0 && y1 < tiles.length && x >= 0 && x < tiles[0].length) {
        if (tiles[y1][x] === 0) {
          tiles[y1][x] = 1 // tunnel
        }
      }
    }

    for (let y = minY; y <= maxY; y++) {
      if (y >= 0 && y < tiles.length && x2 >= 0 && x2 < tiles[0].length) {
        if (tiles[y][x2] === 0) {
          tiles[y][x2] = 1 // tunnel
        }
      }
    }
  }

  /**
   * Place resources in the map based on layer resource table
   */
  private placeResources(tiles: number[][], rooms: DungeonRoom[], resourceTable: LayerResourceEntry[]): void {
    for (const resource of resourceTable) {
      const numClusters = Math.floor(rooms.length * resource.abundance)

      for (let i = 0; i < numClusters; i++) {
        // Pick random room
        const room = rooms[Math.floor(Math.random() * rooms.length)]

        // Pick random position in room
        const x = room.x + Math.floor(Math.random() * room.width)
        const y = room.y + Math.floor(Math.random() * room.height)

        // Place cluster (just marking tiles for now, actual resource placement would be done by world engine)
        for (let j = 0; j < resource.clusterSize; j++) {
          const dx = Math.floor(Math.random() * 3) - 1
          const dy = Math.floor(Math.random() * 3) - 1
          const nx = x + dx
          const ny = y + dy

          if (
            ny >= 0 &&
            ny < tiles.length &&
            nx >= 0 &&
            nx < tiles[0].length &&
            tiles[ny][nx] === 1
          ) {
            // Resource marking could be added here if needed
          }
        }
      }
    }
  }
}
