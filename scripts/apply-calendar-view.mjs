import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import * as dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

const sqlPath = path.join(__dirname, '../supabase/migrations/20260125000001_add_client_name_to_unified_calendar.sql')
const sql = fs.readFileSync(sqlPath, 'utf-8')

async function run() {
  console.log('Applying unified_calendar view migration...')

  // Try using the postgres REST API extension
  const { data, error } = await supabase.rpc('pg_exec', { query: sql })

  if (error) {
    console.log('pg_exec not available, trying raw query...')

    // Try direct query approach
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ sql_text: sql })
    })

    if (!response.ok) {
      console.log('Direct API approach failed')
      console.log('Please run the SQL manually in Supabase Dashboard SQL Editor')
      console.log('SQL file:', sqlPath)
    } else {
      console.log('Migration applied successfully!')
    }
  } else {
    console.log('Migration applied successfully!')
  }
}

run().catch(console.error)
