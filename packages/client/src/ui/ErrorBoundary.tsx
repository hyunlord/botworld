import React from 'react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] UI component crashed:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div style={{
          position: 'absolute',
          top: 80,
          right: 16,
          background: 'rgba(20, 20, 30, 0.9)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 80, 80, 0.3)',
          borderRadius: 12,
          padding: '16px 20px',
          color: '#ff8888',
          fontSize: 13,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          zIndex: 999,
          maxWidth: 300,
          pointerEvents: 'auto',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>UI Error</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 12 }}>
            A panel encountered an error. The game continues running.
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 6,
              color: '#fff',
              padding: '6px 14px',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
