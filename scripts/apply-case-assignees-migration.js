#!/usr/bin/env node
/**
 * Apply case_assignees and permissions migration directly
 * Run: node scripts/apply-case-assignees-migration.js
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function runMigration() {
  console.log('Reading migration file...')

  const migrationPath = path.join(__dirname, '../supabase/migrations/20260116100000_case_assignees_and_permissions.sql')
  const sql = fs.readFileSync(migrationPath, 'utf8')

  console.log('Executing migration...')

  // Split by statement (simple approach - may need adjustment for complex SQL)
  const statements = sql
    .split(/;[\r\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  console.log(`Found ${statements.length} statements to execute`)

  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    if (!stmt || stmt.startsWith('--')) continue

    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: stmt + ';' })
      if (error) {
        // Ignore "already exists" errors
        if (error.message.includes('already exists')) {
          console.log(`[${i + 1}/${statements.length}] Skipped (already exists)`)
        } else {
          console.error(`[${i + 1}/${statements.length}] Error:`, error.message)
          errorCount++
        }
      } else {
        successCount++
        console.log(`[${i + 1}/${statements.length}] Success`)
      }
    } catch (err) {
      console.error(`[${i + 1}/${statements.length}] Exception:`, err.message)
      errorCount++
    }
  }

  console.log(`\nMigration complete: ${successCount} succeeded, ${errorCount} failed`)
}

runMigration().catch(console.error)
