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
        {tile.elevation !== undefined && (
          <div style={statBoxStyle}>
            <div style={statLabelStyle}>Elevation</div>
            <div style={statValueStyle}>{tile.elevation}</div>
          </div>
        )}
        {tile.moisture !== undefined && (
          <div style={statBoxStyle}>
            <div style={statLabelStyle}>Moisture</div>
            <div style={statValueStyle}>{tile.moisture}</div>
          </div>
        )}
        {tile.movementCost !== undefined && (
          <div style={statBoxStyle}>
            <div style={statLabelStyle}>Movement Cost</div>
            <div style={statValueStyle}>{tile.movementCost}</div>
          </div>
        )}
        <div style={statBoxStyle}>
          <div style={statLabelStyle}>Position</div>
          <div style={statValueStyle}>
            {position.x}, {position.y}
          </div>
        </div>
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
