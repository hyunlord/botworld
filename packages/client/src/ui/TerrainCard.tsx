import React, { useEffect } from 'react'
import { OV, glassPanel, interactive, gameButton } from './overlay-styles'

interface TerrainCardProps {
  tile: any
  position: { x: number; y: number }
  onClose: () => void
  onNavigate?: (x: number, y: number) => void
  onSelectAgent?: (agentId: string) => void
}

const BIOME_ICONS: Record<string, string> = {
  grassland: '🌾',
  forest: '🌲',
  mountain: '⛰️',
  desert: '🏜️',
  tundra: '🧊',
  swamp: '🐊',
  ocean: '🌊',
  river: '💧',
  beach: '🏖️',
  hills: '⛰️',
  deep_ocean: '🌊',
  ice_shelf: '🧊',
  snow_peak: '🏔️',
  alpine_meadow: '🌸',
  alpine_forest: '🌲',
  highland: '⛰️',
  dense_forest: '🌳',
  temperate_forest: '🌲',
  savanna: '🌿',
  meadow: '🌻',
  mangrove: '🌴',
  farmland: '🌾',
  volcanic: '🌋',
  ruins: '🏛️',
  ancient_forest: '🌳',
  cave: '🕳️',
  road: '🛤️',
  default: '🗺️',
}

const BIOME_DESCRIPTIONS: Record<string, string> = {
  grassland: 'Rolling plains with rich soil and abundant wildlife.',
  forest: 'Dense woodland with towering trees and hidden paths.',
  mountain: 'Rocky peaks with treacherous terrain and mineral deposits.',
  desert: 'Arid wasteland with scorching heat and scarce resources.',
  tundra: 'Frozen landscape with bitter cold and hardy vegetation.',
  swamp: 'Murky wetlands with dangerous creatures and rare herbs.',
  ocean: 'Deep waters teeming with life and mystery.',
  river: 'Flowing water connecting distant lands.',
  beach: 'Sandy shores where land meets sea.',
  hills: 'Gentle slopes with moderate elevation and good visibility.',
  deep_ocean: 'Vast and fathomless waters stretching beyond sight.',
  ice_shelf: 'A frozen expanse of sea ice, treacherous and cold.',
  snow_peak: 'A towering summit capped in eternal snow.',
  alpine_meadow: 'High-altitude meadow with wildflowers and thin air.',
  alpine_forest: 'Hardy conifers clinging to steep mountain slopes.',
  highland: 'Elevated plateau with sweeping views and strong winds.',
  dense_forest: 'Thick canopy blocks most sunlight, moss covers everything.',
  temperate_forest: 'Deciduous woodland alive with birdsong and dappled light.',
  savanna: 'Wide grassland with scattered trees and grazing herds.',
  meadow: 'Lush field of wildflowers and soft grasses.',
  mangrove: 'Tangled roots rising from brackish coastal waters.',
  farmland: 'Tilled earth ready for planting, rich and dark.',
  volcanic: 'Blackened rock and sulfurous vents mark this unstable ground.',
  ruins: 'Crumbling stone walls hint at a forgotten civilization.',
  ancient_forest: 'Primordial trees of immense size, thick with mystery.',
  cave: 'A dark opening in the rock, echoing with dripping water.',
  road: 'A well-worn path connecting distant settlements.',
}

export default function TerrainCard({
  tile,
  position,
  onClose,
  onNavigate,
  onSelectAgent,
}: TerrainCardProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const biome = tile.biome?.toLowerCase() || 'grassland'
  const icon = BIOME_ICONS[biome] || BIOME_ICONS.default
  const description = BIOME_DESCRIPTIONS[biome] || 'An unknown terrain type.'

  // Format elevation from elevationLevel (0-4) or raw float (0-1)
  const getElevationLabel = (): string => {
    const level = tile.elevationLevel
    if (level !== undefined && level !== null) {
      const labels: Record<number, string> = {
        0: 'Sea Level',
        1: 'Lowland',
        2: 'Midland',
        3: 'Highland',
        4: 'Peak',
      }
      return labels[level] ?? `Level ${level}`
    }
    if (tile.elevation !== undefined && tile.elevation !== null) {
      const pct = Math.round(tile.elevation * 100)
      if (pct <= 10) return 'Sea Level'
      if (pct <= 30) return 'Lowland'
      if (pct <= 55) return 'Midland'
      if (pct <= 75) return 'Highland'
      return 'Peak'
    }
    return 'Unknown'
  }

  // Format movement cost into a descriptive label
  const getMovementLabel = (): string => {
    const cost = tile.movementCost
    if (cost === undefined || cost === null) return 'Unknown'
    if (cost === 0) return 'Impassable'
    if (cost <= 0.5) return `Fast (${cost})`
    if (cost <= 1.0) return `Normal (${cost})`
    if (cost <= 1.5) return `Moderate (${cost})`
    if (cost <= 2.0) return `Difficult (${cost})`
    return `Very Difficult (${cost})`
  }

  const containerStyle: React.CSSProperties = {
    ...glassPanel,
    ...interactive,
    position: 'absolute',
    right: 16,
    top: 80,
    width: 380,
    padding: 20,
    animation: 'fadeSlideIn 0.3s ease-out',
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  }

  const iconStyle: React.CSSProperties = {
    fontSize: 40,
    lineHeight: 1,
  }

  const titleStyle: React.CSSProperties = {
    flex: 1,
    color: OV.text,
    fontSize: 18,
    fontWeight: 600,
    margin: 0,
    textTransform: 'capitalize',
  }

  const closeStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: OV.textDim,
    fontSize: 24,
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
    transition: 'color 0.15s',
  }

  const dividerStyle: React.CSSProperties = {
    height: 1,
    background: OV.borderActive,
    margin: '16px 0',
  }

  const sectionStyle: React.CSSProperties = {
    marginBottom: 12,
  }

  const labelStyle: React.CSSProperties = {
    color: OV.textDim,
    fontSize: 12,
    marginBottom: 4,
  }

  const valueStyle: React.CSSProperties = {
    color: OV.text,
    fontSize: 14,
  }

  const descriptionStyle: React.CSSProperties = {
    color: OV.textDim,
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 1.5,
  }

  const statsGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
    marginBottom: 12,
  }

  const statBoxStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.05)',
    padding: '6px 10px',
    borderRadius: OV.radiusSm,
  }

  const statLabelStyle: React.CSSProperties = {
    color: OV.textDim,
    fontSize: 11,
    marginBottom: 2,
  }

  const statValueStyle: React.CSSProperties = {
    color: OV.text,
    fontSize: 14,
    fontWeight: 600,
  }

  const eventListStyle: React.CSSProperties = {
    listStyle: 'none',
    padding: 0,
    margin: '4px 0 0 0',
  }

  const eventItemStyle: React.CSSProperties = {
    color: OV.textDim,
    fontSize: 12,
    padding: '6px 10px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: OV.radiusSm,
    marginBottom: 6,
    cursor: 'pointer',
    transition: 'background 0.15s',
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={iconStyle}>{icon}</div>
        <h3 style={titleStyle}>{biome}</h3>
        <button
          style={closeStyle}
          onClick={onClose}
          onMouseEnter={(e) => (e.currentTarget.style.color = OV.text)}
          onMouseLeave={(e) => (e.currentTarget.style.color = OV.textDim)}
        >
          ×
        </button>
      </div>

      <div style={dividerStyle} />

      <div style={sectionStyle}>
        <div style={descriptionStyle}>{description}</div>
      </div>

      <div style={statsGridStyle}>
        {(tile.elevation !== undefined || tile.elevationLevel !== undefined) && (
          <div style={statBoxStyle}>
            <div style={statLabelStyle}>Elevation</div>
            <div style={statValueStyle}>{getElevationLabel()}</div>
          </div>
        )}
        {tile.type && (
          <div style={statBoxStyle}>
            <div style={statLabelStyle}>Terrain</div>
            <div style={{ ...statValueStyle, textTransform: 'capitalize' as const }}>
              {tile.type.replace(/_/g, ' ')}
            </div>
          </div>
        )}
        {tile.movementCost !== undefined && (
          <div style={statBoxStyle}>
            <div style={statLabelStyle}>Movement</div>
            <div style={statValueStyle}>{getMovementLabel()}</div>
          </div>
        )}
        <div style={statBoxStyle}>
          <div style={statLabelStyle}>Position</div>
          <div style={statValueStyle}>
            {position.x}, {position.y}
          </div>
        </div>
        {tile.walkable !== undefined && (
          <div style={statBoxStyle}>
            <div style={statLabelStyle}>Walkable</div>
            <div style={{ ...statValueStyle, color: tile.walkable ? '#4ade80' : '#f87171' }}>
              {tile.walkable ? 'Yes' : 'No'}
            </div>
          </div>
        )}
      </div>

      {tile.territory && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Territory</div>
          <div style={valueStyle}>{tile.territory.name || tile.territory}</div>
        </div>
      )}

      {tile.recentEvents && tile.recentEvents.length > 0 && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Recent Events</div>
          <ul style={eventListStyle}>
            {tile.recentEvents.slice(0, 3).map((event: any, i: number) => (
              <div
                key={i}
                style={eventItemStyle}
                onClick={() => {
                  if (event.agentId && onSelectAgent) onSelectAgent(event.agentId)
                  if (event.location && onNavigate) onNavigate(event.location.x, event.location.y)
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
              >
                Day {event.day || '?'}: {event.description || event.type}
              </div>
            ))}
          </ul>
        </div>
      )}

      {tile.nearbyPOI && tile.nearbyPOI.length > 0 && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Nearby Points of Interest</div>
          <ul style={{ ...eventListStyle, marginTop: 4 }}>
            {tile.nearbyPOI.map((poi: any, i: number) => (
              <li
                key={i}
                style={{
                  color: OV.textDim,
                  fontSize: 13,
                  padding: '2px 0',
                }}
              >
                • {poi.name || poi.type} ({poi.distance || '?'} tiles)
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
