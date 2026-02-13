import { useState, useEffect } from 'react'
import { OV, glassPanel, interactive, gameButton } from './overlay-styles.js'

interface StatsDashboardProps {
  onClose: () => void
}

interface StatisticsData {
  economy?: {
    totalGold?: number
    avgPrice?: number
    tradeVolume?: number
    gdp?: number
    gdpTrend?: number
    priceHistory?: Array<{ item: string; values: Array<{ value: number }> }>
    wealthDistribution?: { top10: number; middle40: number; bottom50: number }
  }
  combat?: {
    dailyBattles?: number
    monsterKills?: number
    pvpKills?: number
    pveKills?: number
    avgDuration?: number
    dangerZones?: Array<{ x: number; y: number; battles: number }>
    battleHistory?: Array<{ value: number }>
  }
  population?: {
    totalAgents?: number
    levelDistribution?: Array<{ level: number; count: number }>
    raceDistribution?: Array<{ race: string; count: number }>
    classDistribution?: Array<{ class: string; count: number }>
    populationHistory?: Array<{ value: number }>
  }
  ecology?: {
    creaturePopulations?: Array<{ species: string; population: number; trend: Array<{ value: number }> }>
    resourceStatus?: Array<{ resource: string; regen: number; consumption: number }>
    desertificationWarnings?: string[]
  }
  politics?: {
    guilds?: Array<{ name: string; power: number; members: number }>
    recentElections?: Array<{ guild: string; date: string; winner: string }>
    activeWars?: Array<{ attacker: string; defender: string; duration: number }>
    treaties?: Array<{ parties: string[]; type: string }>
  }
}

type TabKey = 'economy' | 'combat' | 'population' | 'ecology' | 'politics'

// Chart Components
function MiniLineChart({
  data,
  width = 300,
  height = 100,
  color = OV.accent
}: {
  data: Array<{ value: number }>
  width?: number
  height?: number
  color?: string
}) {
  if (!data || data.length < 2) {
    return <div style={{ color: OV.textMuted, fontSize: 11 }}>No data</div>
  }

  const values = data.map(d => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values) || 1
  const range = max - min || 1

  const points = values.map((v, i) =>
    `${(i / (values.length - 1)) * width},${height - ((v - min) / range) * height * 0.9 - height * 0.05}`
  ).join(' ')

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  )
}

function BarChart({
  items,
  maxValue
}: {
  items: Array<{ label: string; value: number; color?: string }>
  maxValue?: number
}) {
  const max = maxValue || Math.max(...items.map(i => i.value)) || 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: OV.text, minWidth: 80, textAlign: 'right' }}>{item.label}</span>
          <div style={{ flex: 1, height: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 3 }}>
            <div style={{
              width: `${(item.value / max) * 100}%`,
              height: '100%',
              background: item.color || OV.accent,
              borderRadius: 3,
              transition: 'width 0.3s',
            }} />
          </div>
          <span style={{ fontSize: 11, color: OV.accent, minWidth: 50 }}>{item.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

function PieChart({
  segments
}: {
  segments: Array<{ label: string; value: number; color: string }>
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1
  let cumulative = 0
  const gradientParts = segments.map(seg => {
    const start = (cumulative / total) * 360
    cumulative += seg.value
    const end = (cumulative / total) * 360
    return `${seg.color} ${start}deg ${end}deg`
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: `conic-gradient(${gradientParts.join(', ')})`,
      }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: seg.color }} />
            <span style={{ color: OV.text }}>{seg.label}: {Math.round(seg.value / total * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MultiLineChart({
  series,
  width = 400,
  height = 150,
}: {
  series: Array<{ label: string; data: Array<{ value: number }>; color: string }>
  width?: number
  height?: number
}) {
  if (!series || series.length === 0) {
    return <div style={{ color: OV.textMuted, fontSize: 11 }}>No data</div>
  }

  const allValues = series.flatMap(s => s.data.map(d => d.value))
  const min = Math.min(...allValues)
  const max = Math.max(...allValues) || 1
  const range = max - min || 1

  return (
    <div>
      <svg width={width} height={height} style={{ display: 'block' }}>
        {series.map((s, idx) => {
          const points = s.data.map((v, i) =>
            `${(i / (s.data.length - 1)) * width},${height - ((v.value - min) / range) * height * 0.85 - height * 0.05}`
          ).join(' ')
          return <polyline key={idx} points={points} fill="none" stroke={s.color} strokeWidth="2" />
        })}
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
        {series.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <div style={{ width: 12, height: 2, background: s.color }} />
            <span style={{ color: OV.text }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatCard({
  title,
  children,
  span = 1
}: {
  title: string
  children: React.ReactNode
  span?: number
}) {
  return (
    <div style={{ ...glassPanel, padding: 16, gridColumn: span > 1 ? `span ${span}` : undefined }}>
      <h4 style={{ color: OV.accent, margin: '0 0 12px 0', fontSize: 13, fontWeight: 600 }}>{title}</h4>
      {children}
    </div>
  )
}

function BigStat({
  value,
  label,
  trend
}: {
  value: string | number
  label: string
  trend?: number
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 32, fontWeight: 700, color: OV.accent, marginBottom: 4 }}>
        {value}
        {trend !== undefined && (
          <span style={{
            fontSize: 16,
            marginLeft: 8,
            color: trend > 0 ? '#4ade80' : trend < 0 ? '#f87171' : OV.textMuted
          }}>
            {trend > 0 ? '↗' : trend < 0 ? '↘' : '→'}
          </span>
        )}
      </div>
      <div style={{ fontSize: 11, color: OV.textMuted, textTransform: 'uppercase' }}>{label}</div>
    </div>
  )
}

export function StatsDashboard({ onClose }: StatsDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('economy')
  const [data, setData] = useState<StatisticsData>({})
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      const response = await fetch('/api/statistics')
      const result = await response.json()
      setData(result)
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch statistics:', error)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 15000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'economy', label: 'Economy' },
    { key: 'combat', label: 'Combat' },
    { key: 'population', label: 'Population' },
    { key: 'ecology', label: 'Ecology' },
    { key: 'politics', label: 'Politics' },
  ]

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      background: 'rgba(0, 0, 0, 0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        ...glassPanel,
        width: '90vw',
        maxWidth: 1200,
        height: '85vh',
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: `1px solid ${OV.border}`,
        }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: OV.text }}>World Statistics</h2>
          <button
            onClick={onClose}
            style={{
              ...gameButton,
              padding: '6px 16px',
              fontSize: 13,
            }}
          >
            Close
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: 4,
          padding: '12px 20px',
          borderBottom: `1px solid ${OV.border}`,
        }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                ...interactive,
                padding: '8px 16px',
                fontSize: 13,
                background: activeTab === tab.key ? OV.accent : 'transparent',
                color: activeTab === tab.key ? '#000' : OV.text,
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: activeTab === tab.key ? 600 : 400,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: 20,
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: OV.textMuted }}>Loading...</div>
          ) : (
            <>
              {activeTab === 'economy' && <EconomyTab data={data.economy} />}
              {activeTab === 'combat' && <CombatTab data={data.combat} />}
              {activeTab === 'population' && <PopulationTab data={data.population} />}
              {activeTab === 'ecology' && <EcologyTab data={data.ecology} />}
              {activeTab === 'politics' && <PoliticsTab data={data.politics} />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function EconomyTab({ data }: { data?: StatisticsData['economy'] }) {
  const priceChartColors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981']

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
      <StatCard title="GDP" span={1}>
        <BigStat
          value={(data?.gdp || 0).toLocaleString()}
          label="Total GDP"
          trend={data?.gdpTrend}
        />
      </StatCard>

      <StatCard title="Total Gold" span={1}>
        <BigStat value={(data?.totalGold || 0).toLocaleString()} label="In Circulation" />
      </StatCard>

      <StatCard title="Trade Volume" span={1}>
        <BigStat value={(data?.tradeVolume || 0).toLocaleString()} label="Total Trades" />
      </StatCard>

      <StatCard title="Price Trends" span={2}>
        <MultiLineChart
          series={(data?.priceHistory || []).map((item, i) => ({
            label: item.item,
            data: item.values,
            color: priceChartColors[i % priceChartColors.length],
          }))}
          width={500}
          height={150}
        />
      </StatCard>

      <StatCard title="Wealth Distribution" span={1}>
        <BarChart
          items={[
            { label: 'Top 10%', value: data?.wealthDistribution?.top10 || 0, color: '#3b82f6' },
            { label: 'Middle 40%', value: data?.wealthDistribution?.middle40 || 0, color: '#8b5cf6' },
            { label: 'Bottom 50%', value: data?.wealthDistribution?.bottom50 || 0, color: '#6b7280' },
          ]}
        />
      </StatCard>
    </div>
  )
}

function CombatTab({ data }: { data?: StatisticsData['combat'] }) {
  const pvpVsPve = [
    { label: 'PvP', value: data?.pvpKills || 0, color: '#ef4444' },
    { label: 'PvE', value: data?.pveKills || 0, color: '#3b82f6' },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
      <StatCard title="Daily Battles" span={1}>
        <BigStat value={data?.dailyBattles || 0} label="Battles Today" />
      </StatCard>

      <StatCard title="Battle Duration" span={1}>
        <BigStat value={`${(data?.avgDuration || 0).toFixed(1)}s`} label="Average Duration" />
      </StatCard>

      <StatCard title="Battle History" span={2}>
        <MiniLineChart data={data?.battleHistory || []} width={500} height={120} color="#ef4444" />
      </StatCard>

      <StatCard title="Monster Kills" span={1}>
        <BarChart
          items={[
            { label: 'Total Kills', value: data?.monsterKills || 0, color: '#10b981' },
          ]}
        />
      </StatCard>

      <StatCard title="PvP vs PvE" span={1}>
        <PieChart segments={pvpVsPve} />
      </StatCard>

      <StatCard title="Danger Zones" span={2}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(data?.dangerZones || []).slice(0, 5).map((zone, i) => (
            <div key={i} style={{ fontSize: 11, color: OV.text }}>
              <span style={{ color: '#ef4444', fontWeight: 600 }}>({zone.x}, {zone.y})</span> - {zone.battles} battles
            </div>
          ))}
          {(!data?.dangerZones || data.dangerZones.length === 0) && (
            <div style={{ fontSize: 11, color: OV.textMuted }}>No danger zones recorded</div>
          )}
        </div>
      </StatCard>
    </div>
  )
}

function PopulationTab({ data }: { data?: StatisticsData['population'] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
      <StatCard title="Total Agents" span={1}>
        <BigStat value={data?.totalAgents || 0} label="Active Agents" />
      </StatCard>

      <StatCard title="Population Trend" span={2}>
        <MiniLineChart data={data?.populationHistory || []} width={500} height={120} color="#10b981" />
      </StatCard>

      <StatCard title="Level Distribution" span={2}>
        <BarChart
          items={(data?.levelDistribution || []).map(lvl => ({
            label: `Level ${lvl.level}`,
            value: lvl.count,
            color: '#8b5cf6',
          }))}
        />
      </StatCard>

      <StatCard title="Race Distribution" span={1}>
        <BarChart
          items={(data?.raceDistribution || []).map(race => ({
            label: race.race,
            value: race.count,
            color: '#3b82f6',
          }))}
        />
      </StatCard>

      <StatCard title="Class Distribution" span={2}>
        <BarChart
          items={(data?.classDistribution || []).map(cls => ({
            label: cls.class,
            value: cls.count,
            color: '#ec4899',
          }))}
        />
      </StatCard>
    </div>
  )
}

function EcologyTab({ data }: { data?: StatisticsData['ecology'] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
      <StatCard title="Creature Populations" span={3}>
        <MultiLineChart
          series={(data?.creaturePopulations || []).slice(0, 5).map((creature, i) => ({
            label: creature.species,
            data: creature.trend,
            color: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'][i % 5],
          }))}
          width={800}
          height={180}
        />
      </StatCard>

      <StatCard title="Resource Status" span={2}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(data?.resourceStatus || []).map((resource, i) => (
            <div key={i}>
              <div style={{ fontSize: 11, color: OV.text, marginBottom: 4, fontWeight: 600 }}>
                {resource.resource}
              </div>
              <BarChart
                items={[
                  { label: 'Regen', value: resource.regen, color: '#10b981' },
                  { label: 'Consumption', value: resource.consumption, color: '#ef4444' },
                ]}
              />
            </div>
          ))}
          {(!data?.resourceStatus || data.resourceStatus.length === 0) && (
            <div style={{ fontSize: 11, color: OV.textMuted }}>No resource data</div>
          )}
        </div>
      </StatCard>

      <StatCard title="Desertification Warnings" span={1}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(data?.desertificationWarnings || []).map((warning, i) => (
            <div
              key={i}
              style={{
                padding: 8,
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 4,
                fontSize: 11,
                color: '#fca5a5',
              }}
            >
              ⚠️ {warning}
            </div>
          ))}
          {(!data?.desertificationWarnings || data.desertificationWarnings.length === 0) && (
            <div style={{ fontSize: 11, color: '#10b981' }}>✓ Ecosystem stable</div>
          )}
        </div>
      </StatCard>
    </div>
  )
}

function PoliticsTab({ data }: { data?: StatisticsData['politics'] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
      <StatCard title="Guild Power Rankings" span={2}>
        <BarChart
          items={(data?.guilds || []).map(guild => ({
            label: `${guild.name} (${guild.members})`,
            value: guild.power,
            color: '#8b5cf6',
          }))}
        />
      </StatCard>

      <StatCard title="Recent Elections" span={1}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(data?.recentElections || []).slice(0, 5).map((election, i) => (
            <div
              key={i}
              style={{
                padding: 8,
                background: 'rgba(139, 92, 246, 0.1)',
                borderRadius: 4,
                fontSize: 11,
              }}
            >
              <div style={{ color: OV.accent, fontWeight: 600 }}>{election.guild}</div>
              <div style={{ color: OV.textMuted, fontSize: 10 }}>
                {election.date} - Winner: {election.winner}
              </div>
            </div>
          ))}
          {(!data?.recentElections || data.recentElections.length === 0) && (
            <div style={{ fontSize: 11, color: OV.textMuted }}>No recent elections</div>
          )}
        </div>
      </StatCard>

      <StatCard title="Active Wars" span={2}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(data?.activeWars || []).map((war, i) => (
            <div
              key={i}
              style={{
                padding: 12,
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 4,
                fontSize: 11,
              }}
            >
              <div style={{ color: '#fca5a5', fontWeight: 600 }}>
                ⚔️ {war.attacker} vs {war.defender}
              </div>
              <div style={{ color: OV.textMuted, fontSize: 10, marginTop: 4 }}>
                Duration: {war.duration} days
              </div>
            </div>
          ))}
          {(!data?.activeWars || data.activeWars.length === 0) && (
            <div style={{ fontSize: 11, color: '#10b981' }}>✓ No active wars</div>
          )}
        </div>
      </StatCard>

      <StatCard title="Active Treaties" span={1}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(data?.treaties || []).map((treaty, i) => (
            <div
              key={i}
              style={{
                padding: 8,
                background: 'rgba(16, 185, 129, 0.1)',
                borderRadius: 4,
                fontSize: 11,
              }}
            >
              <div style={{ color: '#10b981', fontWeight: 600 }}>{treaty.type}</div>
              <div style={{ color: OV.textMuted, fontSize: 10 }}>
                {treaty.parties.join(', ')}
              </div>
            </div>
          ))}
          {(!data?.treaties || data.treaties.length === 0) && (
            <div style={{ fontSize: 11, color: OV.textMuted }}>No treaties</div>
          )}
        </div>
      </StatCard>
    </div>
  )
}
