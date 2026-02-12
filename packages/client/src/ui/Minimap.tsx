import { useEffect, useRef, useCallback } from 'react'
import type { Agent } from '@botworld/shared'
import { POI_COLORS } from './constants.js'
import { OV } from './overlay-styles.js'

interface MinimapProps {
  agents: Agent[]
  pois: { name: string; type: string; x: number; y: number }[]
  selectedAgentId: string | null
  onNavigate: (tileX: number, tileY: number) => void
  size?: number
}

const PADDING = 14

// Biome-like terrain colors for background (placeholder, since we don't have full terrain data)
const TERRAIN_BG = '#1a2a1a'

export function Minimap({
  agents,
  pois,
  selectedAgentId,
  onNavigate,
  size = 160,
}: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const getBounds = useCallback(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

    for (const a of agents) {
      if (a.position.x < minX) minX = a.position.x
      if (a.position.y < minY) minY = a.position.y
      if (a.position.x > maxX) maxX = a.position.x
      if (a.position.y > maxY) maxY = a.position.y
    }

    for (const p of pois) {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    }

    if (!isFinite(minX)) {
      return { minX: -10, minY: -10, maxX: 10, maxY: 10 }
    }

    const padX = Math.max((maxX - minX) * 0.12, 5)
    const padY = Math.max((maxY - minY) * 0.12, 5)
    return { minX: minX - padX, minY: minY - padY, maxX: maxX + padX, maxY: maxY + padY }
  }, [agents, pois])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    // Background with rounded corners
    ctx.fillStyle = OV.bg
    ctx.beginPath()
    ctx.roundRect(0, 0, size, size, 10)
    ctx.fill()

    // Subtle terrain background
    ctx.fillStyle = 'rgba(30, 45, 60, 0.3)'
    ctx.beginPath()
    ctx.roundRect(PADDING / 2, PADDING / 2, size - PADDING, size - PADDING, 6)
    ctx.fill()

    const bounds = getBounds()
    const rangeX = bounds.maxX - bounds.minX || 1
    const rangeY = bounds.maxY - bounds.minY || 1
    const drawSize = size - PADDING * 2

    const toCanvas = (wx: number, wy: number) => ({
      cx: PADDING + ((wx - bounds.minX) / rangeX) * drawSize,
      cy: PADDING + ((wy - bounds.minY) / rangeY) * drawSize,
    })

    // Draw POIs (small colored squares with subtle glow)
    for (const poi of pois) {
      const { cx, cy } = toCanvas(poi.x, poi.y)
      const color = POI_COLORS[poi.type] ?? '#888888'
      // Glow
      ctx.shadowColor = color
      ctx.shadowBlur = 4
      ctx.fillStyle = color
      ctx.fillRect(cx - 3, cy - 3, 6, 6)
      ctx.shadowBlur = 0
    }

    // Draw agents (dots)
    for (const agent of agents) {
      const { cx, cy } = toCanvas(agent.position.x, agent.position.y)
      const isSelected = agent.id === selectedAgentId
      if (isSelected) {
        // Gold glow for selected
        ctx.shadowColor = OV.accent
        ctx.shadowBlur = 6
        ctx.fillStyle = OV.accent
        ctx.beginPath()
        ctx.arc(cx, cy, 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
        ctx.beginPath()
        ctx.arc(cx, cy, 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Border
    ctx.strokeStyle = OV.border
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(0.5, 0.5, size - 1, size - 1, 10)
    ctx.stroke()
  }, [agents, pois, selectedAgentId, size, getBounds])

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const bounds = getBounds()
    const rangeX = bounds.maxX - bounds.minX || 1
    const rangeY = bounds.maxY - bounds.minY || 1
    const drawSize = size - PADDING * 2

    const tileX = Math.round(bounds.minX + ((x - PADDING) / drawSize) * rangeX)
    const tileY = Math.round(bounds.minY + ((y - PADDING) / drawSize) * rangeY)

    onNavigate(tileX, tileY)
  }

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      style={{
        position: 'absolute',
        bottom: 64,
        left: 12,
        zIndex: 100,
        width: size,
        height: size,
        cursor: 'crosshair',
        borderRadius: 10,
        pointerEvents: 'auto',
      }}
      title="Click to navigate"
    />
  )
}
