import { useState, useEffect } from 'react'
import { OV, glassPanel, gameButton, interactive } from './overlay-styles.js'

interface NotificationSystemProps {
  subscriptions: string[]
  events: any[]
  onNavigate?: (x: number, y: number) => void
  onSelectAgent?: (agentId: string) => void
  onToggleSubscription?: (agentId: string) => void
}

interface Toast {
  id: string
  type: string
  message: string
  agentId?: string
  location?: { x: number; y: number }
  timestamp: number
}

interface NotificationFilter {
  combat: boolean
  levelup: boolean
  items: boolean
  political: boolean
  death: boolean
}

const NOTIFICATION_ICONS: Record<string, string> = {
  combat: '⚔️',
  levelup: '⬆️',
  item: '💎',
  death: '💀',
  political: '👑',
}

const AUTO_DISMISS_MS = 8000

export function NotificationSystem({
  subscriptions,
  events,
  onNavigate,
  onSelectAgent,
  onToggleSubscription,
}: NotificationSystemProps) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [showPanel, setShowPanel] = useState(false)
  const [filters, setFilters] = useState<NotificationFilter>({
    combat: true,
    levelup: true,
    items: true,
    political: true,
    death: true,
  })

  // Process incoming events and create toasts
  useEffect(() => {
    if (!events || events.length === 0) return

    events.forEach(event => {
      // Only show notifications for subscribed agents
      if (!subscriptions.includes(event.agentId)) return

      let toast: Toast | null = null

      // Combat events
      if (filters.combat && (event.type === 'combat_start' || event.type === 'combat')) {
        const target = event.target ?? event.data?.target ?? 'unknown'
        toast = {
          id: `${Date.now()}-${Math.random()}`,
          type: 'combat',
          message: `${event.agentName ?? 'Agent'} entered combat with ${target}`,
          agentId: event.agentId,
          location: event.location,
          timestamp: Date.now(),
        }
      }

      // Level up events
      if (filters.levelup && (event.type === 'levelup' || event.type === 'level_up')) {
        const level = event.level ?? event.data?.level ?? '?'
        toast = {
          id: `${Date.now()}-${Math.random()}`,
          type: 'levelup',
          message: `${event.agentName ?? 'Agent'} reached level ${level}!`,
          agentId: event.agentId,
          location: event.location,
          timestamp: Date.now(),
        }
      }

      // Item events (legendary/rare)
      if (filters.items && (event.type === 'item_found' || event.type === 'loot')) {
        const itemName = event.itemName ?? event.data?.itemName ?? 'an item'
        const rarity = event.rarity ?? event.data?.rarity
        if (rarity === 'legendary' || rarity === 'epic') {
          toast = {
            id: `${Date.now()}-${Math.random()}`,
            type: 'item',
            message: `${event.agentName ?? 'Agent'} found ${itemName}!`,
            agentId: event.agentId,
            location: event.location,
            timestamp: Date.now(),
          }
        }
      }

      // Death/KO events
      if (filters.death && (event.type === 'death' || event.type === 'ko' || event.type === 'knocked_out')) {
        toast = {
          id: `${Date.now()}-${Math.random()}`,
          type: 'death',
          message: `${event.agentName ?? 'Agent'} was knocked out!`,
          agentId: event.agentId,
          location: event.location,
          timestamp: Date.now(),
        }
      }

      // Political events
      if (filters.political && (event.type === 'title_gained' || event.type === 'political')) {
        const title = event.title ?? event.data?.title ?? 'a title'
        toast = {
          id: `${Date.now()}-${Math.random()}`,
          type: 'political',
          message: `${event.agentName ?? 'Agent'} became ${title}`,
          agentId: event.agentId,
          location: event.location,
          timestamp: Date.now(),
        }
      }

      if (toast) {
        setToasts(prev => {
          const updated = [...prev, toast!]
          // Keep max 5 visible
          return updated.slice(-5)
        })

        // Auto-dismiss after 8 seconds
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== toast!.id))
        }, AUTO_DISMISS_MS)
      }
    })
  }, [events, subscriptions, filters])

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  const handleGoToLocation = (toast: Toast) => {
    if (toast.location && onNavigate) {
      onNavigate(toast.location.x, toast.location.y)
    }
    if (toast.agentId && onSelectAgent) {
      onSelectAgent(toast.agentId)
    }
  }

  const toggleFilter = (key: keyof NotificationFilter) => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div style={styles.wrapper}>
      {/* Subscription Bell Button */}
      <div style={styles.bellContainer}>
        <button onClick={() => setShowPanel(!showPanel)} style={{ ...gameButton, ...interactive, ...styles.bellButton }}>
          🔔
          {subscriptions.length > 0 && (
            <span style={styles.badge}>{subscriptions.length}</span>
          )}
        </button>

        {/* Subscription Panel */}
        {showPanel && (
          <div style={{ ...glassPanel, ...interactive, ...styles.panel }}>
            <div style={styles.panelHeader}>
              <span style={styles.panelTitle}>Subscriptions</span>
              <button onClick={() => setShowPanel(false)} style={styles.closeBtn}>×</button>
            </div>

            {/* Subscribed Agents */}
            <div style={styles.subscriptionList}>
              {subscriptions.length === 0 ? (
                <div style={styles.emptyText}>No subscriptions yet</div>
              ) : (
                subscriptions.map(agentId => (
                  <div key={agentId} style={styles.subscriptionItem}>
                    <span style={styles.agentName}>{agentId}</span>
                    <button
                      onClick={() => onToggleSubscription?.(agentId)}
                      style={styles.unsubBtn}
                    >
                      Unsubscribe
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Notification Type Filters */}
            <div style={styles.filterSection}>
              <div style={styles.filterHeader}>Notification Types</div>
              {(Object.keys(filters) as Array<keyof NotificationFilter>).map(key => (
                <label key={key} style={styles.filterLabel}>
                  <input
                    type="checkbox"
                    checked={filters[key]}
                    onChange={() => toggleFilter(key)}
                    style={styles.checkbox}
                  />
                  <span style={styles.filterText}>
                    {NOTIFICATION_ICONS[key] ?? ''} {key.charAt(0).toUpperCase() + key.slice(1)}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Toast Notifications */}
      <div style={styles.toastContainer}>
        {toasts.map((toast, idx) => (
          <div
            key={toast.id}
            style={{
              ...glassPanel,
              ...interactive,
              ...styles.toast,
              animation: 'slideInRight 0.3s ease-out',
              opacity: 1 - idx * 0.1,
            }}
          >
            <span style={styles.toastIcon}>{NOTIFICATION_ICONS[toast.type] ?? '📢'}</span>
            <span style={styles.toastMessage}>{toast.message}</span>
            <div style={styles.toastActions}>
              {(toast.location || toast.agentId) && (
                <button onClick={() => handleGoToLocation(toast)} style={styles.goBtn}>
                  Go
                </button>
              )}
              <button onClick={() => dismissToast(toast.id)} style={styles.dismissBtn}>
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: 'absolute',
    top: 0,
    right: 0,
    pointerEvents: 'none',
    zIndex: 300,
  },
  bellContainer: {
    position: 'relative',
    margin: '12px 12px 0 0',
  },
  bellButton: {
    width: 40,
    height: 40,
    fontSize: 18,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    padding: 0,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    background: OV.hp,
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    borderRadius: 10,
    padding: '2px 6px',
    lineHeight: 1,
  },
  panel: {
    position: 'absolute',
    top: 48,
    right: 0,
    width: 280,
    maxHeight: 400,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    borderBottom: `1px solid ${OV.border}`,
  },
  panelTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: OV.text,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: 24,
    color: OV.textDim,
    cursor: 'pointer',
    lineHeight: 1,
    padding: 0,
    width: 24,
    height: 24,
  },
  subscriptionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '8px 12px',
    maxHeight: 200,
    overflowY: 'auto',
    borderBottom: `1px solid ${OV.border}`,
  },
  emptyText: {
    fontSize: 11,
    color: OV.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: '12px 0',
  },
  subscriptionItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 8px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: OV.radiusSm,
  },
  agentName: {
    fontSize: 11,
    color: OV.text,
    fontWeight: 500,
  },
  unsubBtn: {
    background: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    color: OV.red,
    borderRadius: 4,
    padding: '3px 8px',
    fontSize: 9,
    fontWeight: 'bold',
    cursor: 'pointer',
    fontFamily: OV.font,
  },
  filterSection: {
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  filterHeader: {
    fontSize: 11,
    fontWeight: 'bold',
    color: OV.textDim,
    marginBottom: 4,
  },
  filterLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
    fontSize: 11,
    color: OV.text,
  },
  checkbox: {
    cursor: 'pointer',
    accentColor: OV.accent,
  },
  filterText: {
    flex: 1,
  },
  toastContainer: {
    position: 'fixed',
    top: 60,
    right: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxWidth: 320,
    pointerEvents: 'none',
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    minHeight: 48,
    pointerEvents: 'auto',
  },
  toastIcon: {
    fontSize: 20,
    flexShrink: 0,
  },
  toastMessage: {
    flex: 1,
    fontSize: 12,
    color: OV.text,
    lineHeight: 1.4,
  },
  toastActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  goBtn: {
    background: 'rgba(74, 222, 128, 0.2)',
    border: '1px solid rgba(74, 222, 128, 0.4)',
    color: OV.green,
    borderRadius: 4,
    padding: '4px 10px',
    fontSize: 10,
    fontWeight: 'bold',
    cursor: 'pointer',
    fontFamily: OV.font,
  },
  dismissBtn: {
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'none',
    color: OV.textDim,
    borderRadius: 4,
    width: 24,
    height: 24,
    fontSize: 18,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    lineHeight: 1,
  },
}

// Add slideInRight animation via injected styles
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = `
    @keyframes slideInRight {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }
  `
  if (!document.head.querySelector('style[data-notification-animations]')) {
    style.setAttribute('data-notification-animations', 'true')
    document.head.appendChild(style)
  }
}
