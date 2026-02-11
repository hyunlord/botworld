import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Race, CharacterClass, CharacterAppearance } from '@botworld/shared'
import { RACE_ICONS, CLASS_ICONS } from '../ui/constants.js'

// API calls go to same origin
const API_BASE = ''

interface ClaimInfo {
  agent: {
    id: string
    name: string
    status: string
    created_at: string
  }
  character: {
    name: string
    race: Race
    characterClass: CharacterClass
    appearance: CharacterAppearance
  } | null
  message: string
}

interface ClaimResult {
  message: string
  agent: {
    id: string
    name: string
    status: string
    owner_id: string
  }
  session: {
    token: string
    expiresAt: string
  }
  redirectUrl: string
}

export function ClaimPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [claimInfo, setClaimInfo] = useState<ClaimInfo | null>(null)
  const [email, setEmail] = useState('')
  const [claimed, setClaimed] = useState(false)

  // Fetch claim info on mount
  useEffect(() => {
    if (!code) {
      setError('Invalid claim link.')
      setLoading(false)
      return
    }

    fetchClaimInfo()
  }, [code])

  const fetchClaimInfo = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/agents/claim/${code}`)
      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'ALREADY_CLAIMED') {
          setError('This agent has already been claimed. If this is your bot, use the dashboard to manage it.')
        } else {
          setError(data.error || data.message || 'Invalid or expired claim link.')
        }
        setLoading(false)
        return
      }

      setClaimInfo(data)
      setLoading(false)
    } catch (err) {
      setError('Failed to load claim information. Please try again.')
      setLoading(false)
    }
  }

  const handleClaim = async () => {
    if (!email.trim() || !code) return

    setClaiming(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/api/agents/claim/${code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })

      const data: ClaimResult = await res.json()

      if (!res.ok) {
        throw new Error((data as unknown as { error: string }).error || 'Claim failed')
      }

      // Store session token
      sessionStorage.setItem('botworld_owner_token', data.session.token)

      setClaimed(true)

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        navigate(`/dashboard?session=${data.session.token}`)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Claim failed. Please try again.')
      setClaiming(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Loading claim information...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error && !claimInfo) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.errorTitle}>❌ Claim Error</h1>
          <p style={styles.errorText}>{error}</p>
          <button onClick={() => navigate('/')} style={styles.secondaryButton}>
            Go to Homepage
          </button>
        </div>
      </div>
    )
  }

  // Claimed success state
  if (claimed) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.successTitle}>🎉 Welcome to Botworld!</h1>
          <p style={styles.successText}>
            Your agent <strong>{claimInfo?.agent.name}</strong> is now linked to your account.
          </p>
          <p style={styles.redirectText}>Redirecting to dashboard...</p>
          <div style={styles.spinner} />
        </div>
      </div>
    )
  }

  // Main claim form
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Header */}
        <h1 style={styles.title}>🎮 Welcome to Botworld!</h1>
        <p style={styles.subtitle}>
          An AI agent has been created on your behalf
        </p>

        {/* Agent Info */}
        <div style={styles.agentBox}>
          <div style={styles.agentHeader}>
            <span style={styles.agentName}>{claimInfo?.agent.name}</span>
            <span style={styles.agentStatus}>Waiting for you</span>
          </div>
          <p style={styles.agentMeta}>
            Created {claimInfo?.agent.created_at
              ? new Date(claimInfo.agent.created_at).toLocaleDateString()
              : 'recently'}
          </p>
        </div>

        {/* Character Preview (if exists) */}
        {claimInfo?.character && (
          <div style={styles.characterPreview}>
            <h3 style={styles.characterTitle}>Your Character</h3>
            <div style={styles.characterInfo}>
              <div style={styles.characterBadges}>
                <span style={styles.raceBadge}>
                  {RACE_ICONS[claimInfo.character.race] ?? ''} {claimInfo.character.race}
                </span>
                <span style={styles.classBadge}>
                  {CLASS_ICONS[claimInfo.character.characterClass] ?? ''} {claimInfo.character.characterClass}
                </span>
              </div>
              <p style={styles.characterName}>{claimInfo.character.name}</p>
            </div>
          </div>
        )}

        {/* Claim Form */}
        <div style={styles.form}>
          <label style={styles.label}>
            Enter your email to claim this agent
          </label>
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleClaim()}
            style={styles.input}
            disabled={claiming}
            autoFocus
          />

          {error && <p style={styles.formError}>{error}</p>}

          <button
            onClick={handleClaim}
            disabled={claiming || !email.trim()}
            style={styles.claimButton}
          >
            {claiming ? 'Claiming...' : '✨ Claim My Agent'}
          </button>

          <p style={styles.privacyNote}>
            We'll use your email to link this agent to your account.
            You can log in anytime via magic link (no password needed).
          </p>
        </div>

        {/* What happens next */}
        <div style={styles.nextSteps}>
          <h4 style={styles.nextTitle}>What happens next?</h4>
          <ul style={styles.nextList}>
            <li>Your agent becomes active and starts playing</li>
            <li>You can watch your character explore the world</li>
            <li>View stats, inventory, and relationships in your dashboard</li>
            <li>Your AI bot handles everything automatically!</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0d1117 0%, #16213e 100%)',
    padding: 20,
  },
  card: {
    background: '#16213e',
    borderRadius: 16,
    padding: 32,
    width: '100%',
    maxWidth: 480,
    textAlign: 'center' as const,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: 32,
    color: '#e2b714',
  },
  subtitle: {
    margin: '0 0 24px 0',
    color: '#8899aa',
    fontSize: 15,
  },

  // Agent box
  agentBox: {
    background: '#0d1117',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  agentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  agentName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  agentStatus: {
    fontSize: 12,
    color: '#f39c12',
    background: '#f39c1222',
    padding: '4px 10px',
    borderRadius: 12,
  },
  agentMeta: {
    margin: 0,
    fontSize: 12,
    color: '#667788',
    textAlign: 'left' as const,
  },

  // Character preview
  characterPreview: {
    background: '#1a2a4a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  characterTitle: {
    margin: '0 0 12px 0',
    fontSize: 14,
    color: '#8899aa',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  characterInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 8,
  },
  characterBadges: {
    display: 'flex',
    gap: 8,
  },
  raceBadge: {
    fontSize: 13,
    color: '#e2b714',
    background: '#0d1117',
    borderRadius: 6,
    padding: '6px 12px',
    textTransform: 'capitalize' as const,
  },
  classBadge: {
    fontSize: 13,
    color: '#9ae6b4',
    background: '#0d1117',
    borderRadius: 6,
    padding: '6px 12px',
    textTransform: 'capitalize' as const,
  },
  characterName: {
    margin: 0,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },

  // Form
  form: {
    marginBottom: 24,
  },
  label: {
    display: 'block',
    fontSize: 14,
    color: '#8899aa',
    marginBottom: 8,
    textAlign: 'left' as const,
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    fontSize: 16,
    background: '#0d1117',
    border: '2px solid #1a2a4a',
    borderRadius: 8,
    color: '#ccddee',
    marginBottom: 12,
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.2s',
  },
  formError: {
    color: '#e74c3c',
    fontSize: 13,
    margin: '0 0 12px 0',
    textAlign: 'left' as const,
  },
  claimButton: {
    width: '100%',
    padding: '14px 24px',
    fontSize: 18,
    fontWeight: 'bold',
    background: 'linear-gradient(135deg, #e2b714 0%, #f39c12 100%)',
    color: '#0d1117',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    marginBottom: 12,
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  privacyNote: {
    fontSize: 11,
    color: '#556677',
    margin: 0,
    lineHeight: 1.5,
  },

  // Next steps
  nextSteps: {
    background: '#0d1117',
    borderRadius: 12,
    padding: 16,
    textAlign: 'left' as const,
  },
  nextTitle: {
    margin: '0 0 12px 0',
    fontSize: 14,
    color: '#9ae6b4',
  },
  nextList: {
    margin: 0,
    paddingLeft: 20,
    fontSize: 13,
    color: '#8899aa',
    lineHeight: 1.8,
  },

  // States
  spinner: {
    width: 40,
    height: 40,
    border: '3px solid #1a2a4a',
    borderTopColor: '#e2b714',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 16px',
  },
  loadingText: {
    color: '#8899aa',
    margin: 0,
  },
  errorTitle: {
    color: '#e74c3c',
    marginBottom: 12,
  },
  errorText: {
    color: '#8899aa',
    marginBottom: 20,
    lineHeight: 1.6,
  },
  secondaryButton: {
    padding: '12px 24px',
    fontSize: 14,
    background: '#1a2a4a',
    color: '#ccddee',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },
  successTitle: {
    color: '#2ecc71',
    marginBottom: 12,
  },
  successText: {
    color: '#ccddee',
    fontSize: 16,
    marginBottom: 16,
  },
  redirectText: {
    color: '#8899aa',
    fontSize: 14,
    marginBottom: 16,
  },
}
