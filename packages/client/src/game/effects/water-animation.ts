import Phaser from 'phaser'
import type { Tile } from '@botworld/shared'
import { ISO_TILE_WIDTH, ISO_TILE_HEIGHT, worldToScreen, isoDepth } from '../utils/coordinates.js'

/**
 * Animates water tiles with shimmer effects by cycling tile indices,
 * and adds shore wave overlays near coastlines.
 * Also adds subtle sparkle particles on water surfaces.
 */

// Water tile index ranges in iso-terrain-sheet
const WATER_SHALLOW = [42, 43, 44]   // water_shallow_01-03
const WATER_DEEP = [39, 40, 41]      // water_deep_01-03
const WATER_RIVER = 57               // water_river_H (base)

interface WaterTileRef {
  tileX: number
  tileY: number
  type: 'water' | 'deep_water' | 'river'
  baseIndex: number
}

interface ShoreWave {
  sprite: Phaser.GameObjects.Ellipse
  tileX: number
  tileY: number
}

export class WaterAnimation {
  private scene: Phaser.Scene
  private waterTiles: WaterTileRef[] = []
  private shoreWaves: ShoreWave[] = []
  private sparkleGraphics: Phaser.GameObjects.Graphics
  private frameCount = 0
  private shimmerInterval = 90 // frames between tile index cycles (~1.5s at 60fps)
  private sparkleTimer = 0

  // Sparkle texture
  private sparkleKey = 'water_sparkle'

  constructor(scene: Phaser.Scene) {
    this.scene = scene

    // Sparkle overlay (world-space, above water tiles)
    this.sparkleGraphics = scene.add.graphics()
      .setDepth(1)

    this.createTextures()
  }

  private createTextures(): void {
    if (!this.scene.textures.exists(this.sparkleKey)) {
      const gfx = this.scene.add.graphics()
      gfx.fillStyle(0xffffff, 0.8)
      gfx.fillCircle(2, 2, 2)
      gfx.generateTexture(this.sparkleKey, 4, 4)
      gfx.destroy()
    }
  }

  /**
   * Register water tiles from a loaded chunk for animation.
   * Call during chunk rendering.
   */
  addChunkWater(tiles: Tile[][]): void {
    for (const row of tiles) {
      for (const tile of row) {
        if (tile.type === 'water' || tile.type === 'deep_water' || tile.type === 'river') {
          // Avoid duplicates
          const exists = this.waterTiles.some(
            w => w.tileX === tile.position.x && w.tileY === tile.position.y,
          )
          if (!exists) {
            let baseIndex: number
            if (tile.type === 'deep_water') {
              baseIndex = WATER_DEEP[0]
            } else if (tile.type === 'river') {
              baseIndex = WATER_RIVER
            } else {
              baseIndex = WATER_SHALLOW[0]
            }
            this.waterTiles.push({
              tileX: tile.position.x,
              tileY: tile.position.y,
              type: tile.type as 'water' | 'deep_water' | 'river',
              baseIndex,
            })
          }
        }
      }
    }
  }

  /** Remove water tiles for an unloaded chunk */
  removeChunkWater(originX: number, originY: number, size: number): void {
    this.waterTiles = this.waterTiles.filter(
      w => w.tileX < originX || w.tileX >= originX + size ||
           w.tileY < originY || w.tileY >= originY + size,
    )
  }

  /**
   * Called every frame. Handles shimmer cycling and sparkle rendering.
   * Returns tile updates to apply to the tilemap layer.
   */
  update(groundLayer: Phaser.Tilemaps.TilemapLayer | null, cam: Phaser.Cameras.Scene2D.Camera): { tileX: number; tileY: number; index: number }[] {
    this.frameCount++
    const updates: { tileX: number; tileY: number; index: number }[] = []

    // Shimmer: cycle water tile indices periodically
    if (this.frameCount % this.shimmerInterval === 0) {
      const cycle = Math.floor(this.frameCount / this.shimmerInterval) % 3

      for (const w of this.waterTiles) {
        let newIndex: number
        if (w.type === 'deep_water') {
          newIndex = WATER_DEEP[cycle % WATER_DEEP.length]
        } else if (w.type === 'water') {
          newIndex = WATER_SHALLOW[cycle % WATER_SHALLOW.length]
        } else {
          continue // River tiles don't cycle
        }
        updates.push({ tileX: w.tileX, tileY: w.tileY, index: newIndex })
      }
    }

    // Sparkle overlay: subtle white dots on water in viewport
    this.sparkleTimer++
    if (this.sparkleTimer % 8 === 0) {
      this.drawSparkles(cam)
    }

    return updates
  }

  private drawSparkles(cam: Phaser.Cameras.Scene2D.Camera): void {
    this.sparkleGraphics.clear()

    // Only draw sparkles for water tiles near the viewport
    const viewLeft = cam.scrollX - 100
    const viewRight = cam.scrollX + cam.width + 100
    const viewTop = cam.scrollY - 100
    const viewBottom = cam.scrollY + cam.height + 100

    let sparkleCount = 0
    const maxSparkles = 15

    for (const w of this.waterTiles) {
      if (sparkleCount >= maxSparkles) break

      const pos = worldToScreen(w.tileX, w.tileY)
      const sx = pos.x + ISO_TILE_WIDTH / 2
      const sy = pos.y + ISO_TILE_HEIGHT / 2

      if (sx < viewLeft || sx > viewRight || sy < viewTop || sy > viewBottom) continue

      // Pseudo-random sparkle based on position and frame
      const hash = ((w.tileX * 73856093) ^ (w.tileY * 19349663) ^ this.frameCount) >>> 0
      if ((hash % 60) !== 0) continue

      const jx = ((hash >> 4) % 20) - 10
      const jy = ((hash >> 12) % 10) - 5
      const alpha = 0.3 + (hash % 100) / 200

      this.sparkleGraphics.fillStyle(0xffffff, alpha)
      this.sparkleGraphics.fillCircle(sx + jx, sy + jy, 1.5)
      sparkleCount++
    }
  }

  destroy(): void {
    this.sparkleGraphics.destroy()
    for (const wave of this.shoreWaves) {
      wave.sprite.destroy()
    }
    this.shoreWaves = []
    this.waterTiles = []
  }
}
