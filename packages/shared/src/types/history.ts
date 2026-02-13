// ──────────────────────────────────────────────
// World History — auto-recorded significant events
// ──────────────────────────────────────────────

export type HistoryEventType =
  | 'founding'
  | 'battle'
  | 'alliance'
  | 'betrayal'
  | 'discovery'
  | 'disaster'
  | 'achievement'
  | 'election'
  | 'treaty'
  | 'cultural'

export interface WorldHistoryEntry {
  id: string
  tick: number
  day: number
  season: string
  type: HistoryEventType
  title: string
  description: string
  participants: string[]
  location: string
  significance: number // 1-10
  narrative?: string   // AI-generated prose description
}
