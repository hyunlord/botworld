import pg from 'pg'

const { Pool } = pg

function createPool(): pg.Pool {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    console.warn('[DB] DATABASE_URL not set — database features disabled')
    return new Pool({ connectionString: 'postgresql://localhost:5432/botworld' })
  }

  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  })
}

/** Singleton connection pool. */
export const pool = createPool()

/** Test database connectivity. Returns true if reachable. */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT NOW() AS now')
    console.log(`[DB] Connected to PostgreSQL at ${result.rows[0].now}`)
    return true
  } catch (err) {
    console.error('[DB] Connection failed:', err)
    return false
  }
}

/** Gracefully shut down the pool. Call on process exit. */
export async function closePool(): Promise<void> {
  await pool.end()
  console.log('[DB] Connection pool closed')
}
