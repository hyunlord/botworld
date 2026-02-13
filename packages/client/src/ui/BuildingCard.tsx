import React, { useEffect } from 'react'
import { OV, glassPanel, interactive, gameButton } from './overlay-styles'

interface BuildingCardProps {
  building: any
  onClose: () => void
  onNavigate?: (x: number, y: number) => void
}

const BUILDING_ICONS: Record<string, string> = {
  house: '🏠',
  ruin: '🏚️',
  castle: '🏰',
  workshop: '⚒️',
  shop: '🏪',
  farm: '🌾',
  mine: '⛏️',
  tavern: '🍺',
  temple: '⛪',
  default: '🏛️',
}

export default function BuildingCard({ building, onClose, onNavigate }: BuildingCardProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const icon = BUILDING_ICONS[building.type?.toLowerCase()] || BUILDING_ICONS.default
  const hpPercent = ((building.hp || building.durability || 0) / (building.maxHp || building.maxDurability || 1)) * 100

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
  }

  const levelBadgeStyle: React.CSSProperties = {
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

  const durabilityBarBgStyle: React.CSSProperties = {
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 6,
    height: 8,
    overflow: 'hidden',
    marginBottom: 4,
  }

  const durabilityBarFillStyle: React.CSSProperties = {
    background: hpPercent > 50 ? OV.energyGrad : hpPercent > 25 ? OV.hungerGrad : OV.hpGrad,
    height: '100%',
    width: `${hpPercent}%`,
    transition: 'width 0.3s ease-out',
  }

  const durabilityTextStyle: React.CSSProperties = {
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

  const statusStyle: React.CSSProperties = {
    ...valueStyle,
    color:
      building.status === 'operational'
        ? OV.green
        : building.status === 'damaged'
        ? OV.red
        : OV.textDim,
  }

  const facilityListStyle: React.CSSProperties = {
    listStyle: 'none',
    padding: 0,
    margin: '4px 0 0 0',
  }

  const facilityItemStyle: React.CSSProperties = {
    color: OV.textDim,
    fontSize: 13,
    padding: '2px 0',
    display: 'flex',
    justifyContent: 'space-between',
  }

  const activityListStyle: React.CSSProperties = {
    listStyle: 'none',
    padding: 0,
    margin: '4px 0 0 0',
  }

  const activityItemStyle: React.CSSProperties = {
    color: OV.textDim,
    fontSize: 12,
    padding: '4px 8px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: OV.radiusSm,
    marginBottom: 4,
  }

  const buttonContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: 8,
    marginTop: 16,
  }

  const btnStyle: React.CSSProperties = {
    ...gameButton,
    flex: 1,
    padding: '8px 16px',
    fontSize: 13,
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={iconStyle}>{icon}</div>
        <h3 style={titleStyle}>{building.name || 'Unknown Building'}</h3>
        <div style={levelBadgeStyle}>Lv {building.level || 1}</div>
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

      <div style={durabilityBarBgStyle}>
        <div style={durabilityBarFillStyle} />
      </div>
      <div style={durabilityTextStyle}>
        Durability: {building.hp || building.durability || 0}/{building.maxHp || building.maxDurability || 0}
      </div>

      <div style={sectionStyle}>
        <div style={labelStyle}>Status</div>
        <div style={statusStyle}>{building.status || 'Unknown'}</div>
      </div>

      {building.owner && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Owner</div>
          <div style={valueStyle}>{building.owner.name || building.owner}</div>
        </div>
      )}

      {building.facilities && building.facilities.length > 0 && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Facilities</div>
          <ul style={facilityListStyle}>
            {building.facilities.map((facility: any, i: number) => (
              <li key={i} style={facilityItemStyle}>
                <span>• {facility.name || facility.type}</span>
                <span style={{ color: OV.accent }}>★{facility.quality || 1}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {building.recentActivity && building.recentActivity.length > 0 && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Recent Activity</div>
          <ul style={activityListStyle}>
            {building.recentActivity.slice(0, 3).map((activity: any, i: number) => (
              <li key={i} style={activityItemStyle}>
                {activity.description || `${activity.type}: ${activity.item || 'Unknown'}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={buttonContainerStyle}>
        <button
          style={btnStyle}
          onClick={() => {}}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 215, 0, 0.25)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 215, 0, 0.15)')}
        >
          View History
        </button>
        <button
          style={btnStyle}
          onClick={() => {}}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 215, 0, 0.25)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 215, 0, 0.15)')}
        >
          View Interior
        </button>
      </div>
    </div>
  )
}
