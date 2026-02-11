import { useState, useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

type NotificationType =
  | 'level_up'
  | 'rare_item'
  | 'trade_completed'
  | 'character_ko'
  | 'new_relationship'
  | 'security_warning'
  | 'bot_offline'

interface Notification {
  id: string
  agentId: string
  ownerId: string | null
  type: NotificationType
  title: string
  message: string
  data: Record<string, unknown>
  read: boolean
  createdAt: string
}

interface NotificationBellProps {
  token: string | null
  onNavigate?: (path: string) => void
}

// ──────────────────────────────────────────────
// Notification Type Icons & Colors
// ──────────────────────────────────────────────

const NOTIFICATION_CONFIG: Record<NotificationType, { icon: string; color: string }> = {
  level_up: { icon: '🎉', color: '#f1c40f' },
  rare_item: { icon: '✨', color: '#9b59b6' },
  trade_completed: { icon: '💰', color: '#2ecc71' },
  character_ko: { icon: '💀', color: '#e74c3c' },
  new_relationship: { icon: '🤝', color: '#3498db' },
  security_warning: { icon: '🚨', color: '#e74c3c' },
  bot_offline: { icon: '🔴', color: '#e67e22' },
}

// ──────────────────────────────────────────────
// NotificationBell Component
// ──────────────────────────────────────────────

export function NotificationBell({ token, onNavigate }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // ── WebSocket Connection ──

  useEffect(() => {
    if (!token) return

    const socket = io('/dashboard', {
      auth: { token },
    })

    socket.on('connect', () => {
      console.log('[NotificationBell] Connected to dashboard namespace')
    })

    socket.on('auth:success', () => {
      // Initial fetch of notifications
      socket.emit('notifications:get', { since: null }, (res: { notifications: Notification[]; unreadCount: number }) => {
        if (res.notifications) {
          setNotifications(res.notifications)
          setUnreadCount(res.unreadCount)
        }
      })
    })

    socket.on('notification:new', (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev])
      setUnreadCount((prev) => prev + 1)
      // Play notification sound or show toast here if desired
    })

    socket.on('notification:count', ({ unreadCount }: { unreadCount: number }) => {
      setUnreadCount(unreadCount)
    })

    socket.on('connect_error', (err) => {
      console.error('[NotificationBell] Connection error:', err.message)
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [token])

  // ── Click Outside to Close ──

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // ── Mark as Read ──

  const markAsRead = useCallback((ids: string[]) => {
    if (!socketRef.current) return

    socketRef.current.emit('notifications:read', { ids }, (res: { updated: number; unreadCount: number }) => {
      if (res.updated !== undefined) {
        setNotifications((prev) =>
          prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n))
        )
        setUnreadCount(res.unreadCount)
      }
    })
  }, [])

  const markAllAsRead = useCallback(() => {
    if (!socketRef.current) return

    socketRef.current.emit('notifications:read-all', (res: { updated: number; unreadCount: number }) => {
      if (res.updated !== undefined) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
        setUnreadCount(0)
      }
    })
  }, [])

  // ── Handle Notification Click ──

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      markAsRead([notification.id])
    }

    // Navigate based on notification type
    if (onNavigate) {
      switch (notification.type) {
        case 'level_up':
        case 'rare_item':
        case 'character_ko':
          onNavigate('/dashboard')
          break
        case 'trade_completed':
          onNavigate('/dashboard?tab=inventory')
          break
        case 'new_relationship':
          onNavigate('/dashboard?tab=relationships')
          break
        case 'bot_offline':
        case 'security_warning':
          onNavigate('/dashboard?tab=status')
          break
      }
    }

    setIsOpen(false)
  }

  // ── Format Time ──

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  if (!token) return null

  return (
    <div style={styles.container} ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={styles.bellButton}
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
      >
        <span style={styles.bellIcon}>🔔</span>
        {unreadCount > 0 && (
          <span style={styles.badge}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div style={styles.dropdown}>
          {/* Header */}
          <div style={styles.dropdownHeader}>
            <span style={styles.dropdownTitle}>Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} style={styles.markAllButton}>
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div style={styles.notificationList}>
            {notifications.length === 0 ? (
              <div style={styles.emptyState}>
                <span style={styles.emptyIcon}>🔕</span>
                <p style={styles.emptyText}>No notifications yet</p>
              </div>
            ) : (
              notifications.slice(0, 20).map((notification) => {
                const config = NOTIFICATION_CONFIG[notification.type]
                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    style={{
                      ...styles.notificationItem,
                      background: notification.read ? 'transparent' : '#1a2a4a',
                    }}
                  >
                    <span style={{ ...styles.notificationIcon, color: config.color }}>
                      {config.icon}
                    </span>
                    <div style={styles.notificationContent}>
                      <div style={styles.notificationTitle}>{notification.title}</div>
                      <div style={styles.notificationMessage}>{notification.message}</div>
                      <div style={styles.notificationTime}>{formatTime(notification.createdAt)}</div>
                    </div>
                    {!notification.read && <span style={styles.unreadDot} />}
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div style={styles.dropdownFooter}>
              <button
                onClick={() => {
                  onNavigate?.('/dashboard?tab=notifications')
                  setIsOpen(false)
                }}
                style={styles.viewAllButton}
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
  },
  bellButton: {
    position: 'relative',
    background: 'transparent',
    border: 'none',
    padding: '8px 12px',
    cursor: 'pointer',
    borderRadius: 6,
    transition: 'background 0.2s',
  },
  bellIcon: {
    fontSize: 20,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    padding: '0 5px',
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
    background: '#e74c3c',
    borderRadius: 9,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    width: 360,
    maxHeight: 480,
    background: '#16213e',
    border: '1px solid #1a2a4a',
    borderRadius: 8,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
    zIndex: 1000,
    overflow: 'hidden',
  },
  dropdownHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid #1a2a4a',
  },
  dropdownTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  markAllButton: {
    background: 'transparent',
    border: 'none',
    color: '#3498db',
    fontSize: 12,
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 4,
  },
  notificationList: {
    maxHeight: 360,
    overflowY: 'auto' as const,
  },
  emptyState: {
    padding: 40,
    textAlign: 'center' as const,
  },
  emptyIcon: {
    fontSize: 32,
    display: 'block',
    marginBottom: 8,
  },
  emptyText: {
    color: '#667788',
    fontSize: 13,
    margin: 0,
  },
  notificationItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '12px 16px',
    borderBottom: '1px solid #0d1117',
    cursor: 'pointer',
    transition: 'background 0.2s',
    position: 'relative' as const,
  },
  notificationIcon: {
    fontSize: 20,
    flexShrink: 0,
    marginTop: 2,
  },
  notificationContent: {
    flex: 1,
    minWidth: 0,
  },
  notificationTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  notificationMessage: {
    fontSize: 12,
    color: '#8899aa',
    lineHeight: 1.4,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  notificationTime: {
    fontSize: 10,
    color: '#556677',
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    background: '#3498db',
    borderRadius: '50%',
    flexShrink: 0,
    marginTop: 6,
  },
  dropdownFooter: {
    padding: '8px 16px',
    borderTop: '1px solid #1a2a4a',
  },
  viewAllButton: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    color: '#3498db',
    fontSize: 12,
    cursor: 'pointer',
    padding: '8px',
    borderRadius: 4,
    textAlign: 'center' as const,
  },
}
