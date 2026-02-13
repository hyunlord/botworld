import React, { useEffect } from 'react'
import { OV, glassPanel, interactive, gameButton } from './overlay-styles'

interface ResourceCardProps {
  resource: any
  position: { x: number; y: number }
  onClose: () => void
  onNavigate?: (x: number, y: number) => void
}

const RESOURCE_ICONS: Record<string, string> = {
  tree: '🌳',
  wood: '🪵',
  stone: '🪨',
  rock: '🪨',
  ore: '⛏️',
  iron: '⛏️',
  gold: '💰',
  gem: '💎',
  crop: '🌾',
  wheat: '🌾',
  berry: '🫐',
  herb: '🌿',
  default: '📦',
}

export default function ResourceCard({ resource, position, onClose, onNavigate }: ResourceCardProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const icon = RESOURCE_ICONS[resource.type?.toLowerCase()] || RESOURCE_ICONS.default
  const amountPercent = ((resource.amount || 0) / (resource.maxAmount || 1)) * 100
  const isDepleted = (resource.amount || 0) === 0

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
    opacity: isDepleted ? 0.4 : 1,
  }

  const titleStyle: React.CSSProperties = {
    flex: 1,
    color: OV.text,
    fontSize: 18,
    fontWeight: 600,
    margin: 0,
  }

  const qualityBadgeStyle: React.CSSProperties = {
    background: OV.accentDim,
    border: `1px solid ${OV.borderActive}`,
    color: OV.accent,
    padding: '4px 8px',
    borderRadius: OV.radiusSm,
    fontSize: 12,
    fontWeight: 'bold',
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

  const amountBarBgStyle: React.CSSProperties = {
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 6,
    height: 8,
    overflow: 'hidden',
    marginBottom: 4,
  }

  const amountBarFillStyle: React.CSSProperties = {
    background: isDepleted ? OV.textMuted : amountPercent > 50 ? OV.energyGrad : OV.hungerGrad,
    height: '100%',
    width: `${amountPercent}%`,
    transition: 'width 0.3s ease-out',
  }

  const amountTextStyle: React.CSSProperties = {
    color: OV.textDim,
    fontSize: 12,
    marginBottom: 12,
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

  const respawnTimerStyle: React.CSSProperties = {
    ...valueStyle,
    color: OV.blue,
  }

  const provenanceListStyle: React.CSSProperties = {
    listStyle: 'none',
    padding: 0,
    margin: '4px 0 0 0',
  }

  const provenanceItemStyle: React.CSSProperties = {
    color: OV.textDim,
    fontSize: 13,
    padding: '2px 0',
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={iconStyle}>{icon}</div>
        <h3 style={titleStyle}>{resource.name || resource.type || 'Unknown Resource'}</h3>
        {resource.quality && <div style={qualityBadgeStyle}>★{resource.quality}</div>}
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
        <div style={labelStyle}>Amount Remaining</div>
        <div style={amountBarBgStyle}>
          <div style={amountBarFillStyle} />
        </div>
        <div style={amountTextStyle}>
          {resource.amount || 0}/{resource.maxAmount || 0} harvests
        </div>
      </div>

      {isDepleted && resource.respawnTimer && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Respawn Timer</div>
          <div style={respawnTimerStyle}>{resource.respawnTimer} days</div>
        </div>
      )}

      {resource.lastHarvestedBy && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Last Harvested By</div>
          <div style={valueStyle}>
            {resource.lastHarvestedBy.name} (Day {resource.lastHarvestedBy.day || '?'})
          </div>
        </div>
      )}

      {resource.biome && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Biome</div>
          <div style={valueStyle}>{resource.biome}</div>
        </div>
      )}

      {resource.provenance && resource.provenance.length > 0 && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Items Made from This Resource</div>
          <ul style={provenanceListStyle}>
            {resource.provenance.map((item: any, i: number) => (
              <li key={i} style={provenanceItemStyle}>
                • {item.name || item.type}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={sectionStyle}>
        <div style={labelStyle}>Location</div>
        <div style={valueStyle}>
          ({position.x}, {position.y})
        </div>
      </div>
    </div>
  )
}
