import React, { useEffect } from 'react'
import { OV, glassPanel, interactive, gameButton } from './overlay-styles'

interface CreatureCardProps {
  creature: any
  onClose: () => void
  onFollow?: (creatureId: string) => void
  onNavigate?: (x: number, y: number) => void
}

const CREATURE_ICONS: Record<string, string> = {
  wolf: '🐺',
  spider: '🕷️',
  dragon: '🐉',
  deer: '🦌',
  rabbit: '🐰',
  bear: '🐻',
  boar: '🐗',
  snake: '🐍',
  default: '👾',
}

export default function CreatureCard({ creature, onClose, onFollow, onNavigate }: CreatureCardProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const icon = CREATURE_ICONS[creature.type?.toLowerCase()] || CREATURE_ICONS.default
  const hpPercent = ((creature.hp || 0) / (creature.maxHp || 1)) * 100
  const dangerStars = '★'.repeat(Math.min(creature.tier || 1, 5))

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

  const tierBadgeStyle: React.CSSProperties = {
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

  const hpBarBgStyle: React.CSSProperties = {
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 6,
    height: 8,
    overflow: 'hidden',
    marginBottom: 4,
  }

  const hpBarFillStyle: React.CSSProperties = {
    background: OV.hpGrad,
    height: '100%',
    width: `${hpPercent}%`,
    transition: 'width 0.3s ease-out',
  }

  const hpTextStyle: React.CSSProperties = {
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

  const dangerStyle: React.CSSProperties = {
    color: OV.red,
    fontSize: 16,
  }

  const lootListStyle: React.CSSProperties = {
    listStyle: 'none',
    padding: 0,
    margin: '4px 0 0 0',
  }

  const lootItemStyle: React.CSSProperties = {
    color: OV.textDim,
    fontSize: 13,
    padding: '2px 0',
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
        <h3 style={titleStyle}>{creature.name || 'Unknown Creature'}</h3>
        <div style={tierBadgeStyle}>Tier {creature.tier || 1}</div>
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

      <div style={hpBarBgStyle}>
        <div style={hpBarFillStyle} />
      </div>
      <div style={hpTextStyle}>
        HP: {creature.hp || 0}/{creature.maxHp || 0}
      </div>

      <div style={sectionStyle}>
        <div style={labelStyle}>Behavior</div>
        <div style={valueStyle}>{creature.behavior || 'Wandering'}</div>
      </div>

      {creature.pack && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Pack</div>
          <div style={valueStyle}>
            {creature.pack.name} ({creature.pack.memberCount || 0} members)
          </div>
          {creature.pack.territory && (
            <div style={{ ...valueStyle, fontSize: 12, marginTop: 2 }}>
              Territory: {creature.pack.territory}
            </div>
          )}
        </div>
      )}

      <div style={sectionStyle}>
        <div style={labelStyle}>Danger Rating</div>
        <div style={dangerStyle}>{dangerStars}</div>
      </div>

      {creature.lootDrops && creature.lootDrops.length > 0 && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Loot Drops</div>
          <ul style={lootListStyle}>
            {creature.lootDrops.map((loot: any, i: number) => (
              <li key={i} style={lootItemStyle}>
                • {loot.name || loot.type} ({loot.chance || 0}%)
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={buttonContainerStyle}>
        {onFollow && (
          <button
            style={btnStyle}
            onClick={() => onFollow(creature.id)}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 215, 0, 0.25)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 215, 0, 0.15)')}
          >
            Follow
          </button>
        )}
        {creature.pack && (
          <button
            style={btnStyle}
            onClick={() => {}}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 215, 0, 0.25)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 215, 0, 0.15)')}
          >
            View Pack
          </button>
        )}
      </div>
    </div>
  )
}
