import { createAdminClient } from '../lib/supabase/admin'
import * as fs from 'fs'
import * as path from 'path'

async function applyMigration() {
  const supabase = createAdminClient()

  const sqlPath = path.join(__dirname, '../supabase/migrations/20260125000001_add_client_name_to_unified_calendar.sql')
  const sql = fs.readFileSync(sqlPath, 'utf-8')

  console.log('Applying migration...')

  // Execute the entire SQL as a single statement
  const { error } = await supabase.rpc('exec_sql', { sql_text: sql })

  if (error) {
    console.error('Migration error:', error)
    // If exec_sql doesn't exist, we need to apply manually
    console.log('Note: You may need to apply this migration manually in Supabase dashboard')
    console.log('SQL file:', sqlPath)
  } else {
    console.log('Migration applied successfully!')
  }
}

applyMigration().catch(console.error)
