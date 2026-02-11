import { useEffect, useRef, useCallback } from 'react'
import type { Agent } from '@botworld/shared'
import { POI_COLORS } from './constants.js'

interface MinimapProps {
  agents: Agent[]
  pois: { name: string; type: string; x: number; y: number }[]
  selectedAgentId: string | null
  onNavigate: (tileX: number, tileY: number) => void
  size?: number
}

const PADDING = 12

export function Minimap({
  agents,
  pois,
  selectedAgentId,
  onNavigate,
  size = 180,
}: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Compute bounding box of all points
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

    // Fallback if nothing to show
    if (!isFinite(minX)) {
      return { minX: -10, minY: -10, maxX: 10, maxY: 10 }
    }

    // Add some padding around bounds
    const padX = Math.max((maxX - minX) * 0.1, 5)
    const padY = Math.max((maxY - minY) * 0.1, 5)
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

    // Background
    ctx.fillStyle = 'rgba(13, 17, 23, 0.85)'
    ctx.beginPath()
    ctx.roundRect(0, 0, size, size, 8)
    ctx.fill()

    const bounds = getBounds()
    const rangeX = bounds.maxX - bounds.minX || 1
    const rangeY = bounds.maxY - bounds.minY || 1
    const drawSize = size - PADDING * 2

    const toCanvas = (wx: number, wy: number) => ({
      cx: PADDING + ((wx - bounds.minX) / rangeX) * drawSize,
      cy: PADDING + ((wy - bounds.minY) / rangeY) * drawSize,
    })

    // Draw POIs (squares)
    for (const poi of pois) {
      const { cx, cy } = toCanvas(poi.x, poi.y)
      ctx.fillStyle = POI_COLORS[poi.type] ?? '#888888'
      ctx.fillRect(cx - 3, cy - 3, 6, 6)
    }

    // Draw agents (dots)
    for (const agent of agents) {
      const { cx, cy } = toCanvas(agent.position.x, agent.position.y)
      const isSelected = agent.id === selectedAgentId
      ctx.fillStyle = isSelected ? '#e2b714' : '#63b3ed'
      ctx.beginPath()
      ctx.arc(cx, cy, isSelected ? 4 : 2.5, 0, Math.PI * 2)
      ctx.fill()
    }
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
        top: 12,
        left: 12,
        zIndex: 50,
        width: size,
        height: size,
        cursor: 'crosshair',
        borderRadius: 8,
        pointerEvents: 'auto',
      }}
      title="Click to navigate"
    />
  )
}
