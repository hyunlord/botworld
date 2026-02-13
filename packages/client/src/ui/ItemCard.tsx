import React, { useEffect } from 'react'
import { OV, glassPanel, interactive, gameButton } from './overlay-styles'

interface ItemCardProps {
  item: any
  onClose: () => void
  onNavigate?: (x: number, y: number) => void
  onSelectAgent?: (agentId: string) => void
}

const ITEM_ICONS: Record<string, string> = {
  sword: '🗡️',
  axe: '🪓',
  shield: '🛡️',
  armor: '🛡️',
  potion: '🧪',
  food: '🍖',
  ore: '⛏️',
  wood: '🪵',
  stone: '🪨',
  gem: '💎',
  tool: '🔨',
  default: '📦',
}

const RARITY_GLOWS: Record<string, string> = {
  common: 'none',
  uncommon: '0 0 12px rgba(74, 222, 128, 0.5)',
  rare: '0 0 12px rgba(96, 165, 250, 0.5)',
  epic: '0 0 12px rgba(192, 132, 252, 0.5)',
  legendary: '0 0 16px rgba(255, 215, 0, 0.7)',
}

export default function ItemCard({ item, onClose, onNavigate, onSelectAgent }: ItemCardProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const icon = ITEM_ICONS[item.type?.toLowerCase()] || ITEM_ICONS.default
  const durabilityPercent = ((item.durability || 0) / (item.maxDurability || 1)) * 100
  const rarity = item.rarity?.toLowerCase() || 'common'
  const glow = RARITY_GLOWS[rarity] || RARITY_GLOWS.common

  const containerStyle: React.CSSProperties = {
    ...glassPanel,
    ...interactive,
    position: 'absolute',
    right: 16,
    top: 80,
    width: 380,
    padding: 20,
    animation: 'fadeSlideIn 0.3s ease-out',
    boxShadow: glow !== 'none' ? `${glow}, 0 4px 24px rgba(0, 0, 0, 0.4)` : '0 4px 24px rgba(0, 0, 0, 0.4)',
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
    filter: glow !== 'none' ? `drop-shadow(${glow})` : 'none',
  }

  const titleStyle: React.CSSProperties = {
    flex: 1,
    color: OV.text,
    fontSize: 18,
    fontWeight: 600,
    margin: 0,
  }

  const customNameStyle: React.CSSProperties = {
    fontSize: 14,
    color: OV.accent,
    fontStyle: 'italic',
    marginTop: 2,
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

  const durabilityBarBgStyle: React.CSSProperties = {
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 6,
    height: 8,
    overflow: 'hidden',
    marginBottom: 4,
  }

  const durabilityBarFillStyle: React.CSSProperties = {
    background: durabilityPercent > 50 ? OV.energyGrad : durabilityPercent > 25 ? OV.hungerGrad : OV.hpGrad,
    height: '100%',
    width: `${durabilityPercent}%`,
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
    marginBottom: 6,
  }

  const valueStyle: React.CSSProperties = {
    color: OV.accent,
    fontSize: 15,
    fontWeight: 600,
  }

  const historyContainerStyle: React.CSSProperties = {
    maxHeight: 200,
    overflowY: 'auto',
    padding: '4px 0',
  }

  const historyItemStyle: React.CSSProperties = {
    color: OV.textDim,
    fontSize: 12,
    padding: '6px 10px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: OV.radiusSm,
    marginBottom: 6,
    cursor: 'pointer',
    transition: 'background 0.15s',
  }

  const stats = item.stats || {}
  const nonZeroStats = Object.entries(stats).filter(([_, value]) => (value as number) > 0) as [string, number][]

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={iconStyle}>{icon}</div>
        <div style={{ flex: 1 }}>
          <h3 style={titleStyle}>{item.type || 'Unknown Item'}</h3>
          {item.customName && <div style={customNameStyle}>"{item.customName}"</div>}
        </div>
        <div style={qualityBadgeStyle}>{item.quality || item.rarity || 'Common'}</div>
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

      {nonZeroStats.length > 0 && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Stats</div>
          <div style={statsGridStyle}>
            {nonZeroStats.map(([key, value]) => (
              <div key={key} style={statBoxStyle}>
                <div style={statLabelStyle}>{key}</div>
                <div style={statValueStyle}>+{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {item.maxDurability && item.maxDurability > 0 && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Durability</div>
          <div style={durabilityBarBgStyle}>
            <div style={durabilityBarFillStyle} />
          </div>
          <div style={durabilityTextStyle}>
            {item.durability || 0}/{item.maxDurability}
          </div>
        </div>
      )}

      {item.marketValue && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Market Value</div>
          <div style={valueStyle}>{item.marketValue}G</div>
        </div>
      )}

      {item.history && item.history.length > 0 && (
        <div style={sectionStyle}>
          <div style={labelStyle}>History</div>
          <div style={historyContainerStyle}>
            {item.history.map((event: any, i: number) => (
              <div
                key={i}
                style={historyItemStyle}
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
          </div>
        </div>
      )}
    </div>
  )
}
