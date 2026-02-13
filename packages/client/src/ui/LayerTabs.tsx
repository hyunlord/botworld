import { type FC } from 'react'
import { OV } from './overlay-styles.js'

interface LayerInfo {
  id: string
  name: string
  type: string
  depth: number
  agentCount: number
}

interface LayerTabsProps {
  layers: LayerInfo[]
  activeLayerId: string | null
  onLayerSelect: (layerId: string) => void
}

const LAYER_ICONS: Record<string, string> = {
  surface: '🌍',
  mine: '⛏️',
  cavern: '🕯️',
  ancient_ruins: '🏛️',
  ocean: '🌊',
  special: '✨',
}

const LAYER_COLORS: Record<string, string> = {
  surface: '#4ade80',
  mine: '#a78bfa',
  cavern: '#60a5fa',
  ancient_ruins: '#f59e0b',
  ocean: '#38bdf8',
  special: '#f472b6',
}

export const LayerTabs: FC<LayerTabsProps> = ({ layers, activeLayerId, onLayerSelect }) => {
  // Sort layers by depth (surface first, then mine, cavern, ruins)
  const sortedLayers = [...layers].sort((a, b) => b.depth - a.depth)

  if (sortedLayers.length <= 1) return null // Don't show tabs if only surface

  return (
    <div style={{
      position: 'absolute',
      top: 8,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: 4,
      padding: '4px 6px',
      borderRadius: 8,
      background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(255,255,255,0.1)',
      zIndex: 100,
      pointerEvents: 'auto' as const,
      fontFamily: OV.font,
      fontSize: 12,
    }}>
      {sortedLayers.map(layer => {
        const isActive = layer.id === activeLayerId
        const icon = LAYER_ICONS[layer.type] ?? '📍'
        const color = LAYER_COLORS[layer.type] ?? '#94a3b8'

        return (
          <button
            key={layer.id}
            onClick={() => onLayerSelect(layer.id)}
            title={`${layer.name} (${layer.agentCount} agents)`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              borderRadius: 6,
              border: isActive ? `1px solid ${color}` : '1px solid transparent',
              background: isActive ? `${color}22` : 'transparent',
              color: isActive ? color : '#94a3b8',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontSize: 12,
              fontFamily: OV.font,
              whiteSpace: 'nowrap',
            }}
          >
            <span>{icon}</span>
            <span>{layer.name}</span>
            {layer.agentCount > 0 && (
              <span style={{
                fontSize: 10,
                padding: '1px 4px',
                borderRadius: 4,
                background: isActive ? `${color}33` : 'rgba(255,255,255,0.1)',
                color: isActive ? color : '#64748b',
              }}>
                {layer.agentCount}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
