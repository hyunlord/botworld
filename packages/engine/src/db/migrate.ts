import { config } from 'dotenv'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import pg from 'pg'

const { Pool } = pg

// Load .env from monorepo root (same pattern as server.ts)
config({ path: resolve(import.meta.dirname, '../../../../.env') })

async function migrate(): Promise<void> {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('[Migrate] DATABASE_URL is not set. Aborting.')
    process.exit(1)
  }

  const pool = new Pool({ connectionString })

  try {
    const { rows } = await pool.query('SELECT current_database() AS db, NOW() AS time')
    console.log(`[Migrate] Connected to database: ${rows[0].db} at ${rows[0].time}`)

    const schemaPath = resolve(import.meta.dirname, 'schema.sql')
    const schema = readFileSync(schemaPath, 'utf-8')

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(schema)
      await client.query('COMMIT')
      console.log('[Migrate] Schema applied successfully.')
    } catch (err) {
      await client.query('ROLLBACK')
      console.error('[Migrate] Schema application failed, rolled back:', err)
      process.exit(1)
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('[Migrate] Migration failed:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

migrate()
