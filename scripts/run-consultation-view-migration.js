require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function executeMigration() {
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║   Consultation Calendar View Migration                   ║')
  console.log('╚═══════════════════════════════════════════════════════════╝\n')

  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20251125_update_consultations_in_calendar.sql')

  console.log('📖 Reading migration file...')
  const sql = fs.readFileSync(migrationPath, 'utf8')

  // Split SQL into individual statements
  const statements = sql
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => {
      const cleaned = stmt.replace(/--[^\n]*\n/g, '').trim()
      return cleaned.length > 0
    })

  console.log(`📊 Executing ${statements.length} SQL statements...\n`)

  let successCount = 0
  let errorCount = 0
  const errors = []

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';'

    // Extract command type
    let description = 'SQL'
    if (statement.includes('DROP VIEW')) {
      description = 'DROP VIEW unified_calendar'
    } else if (statement.includes('CREATE OR REPLACE VIEW unified_calendar')) {
      description = 'CREATE VIEW unified_calendar (with consultation status)'
    } else if (statement.includes('COMMENT ON VIEW')) {
      description = 'COMMENT ON VIEW unified_calendar'
    }

    try {
      // Try to execute using Supabase RPC
      const { data, error } = await supabase.rpc('exec_sql', { sql: statement })

      if (error) {
        if (
          error.message.includes('already exists') ||
          error.message.includes('does not exist')
        ) {
          console.log(`⏭️  [${i + 1}/${statements.length}] ${description} (already processed)`)
          successCount++
        } else {
          console.error(`❌ [${i + 1}/${statements.length}] ${description}`)
          console.error(`   Error: ${error.message}`)
          errors.push({ index: i + 1, description, error: error.message })
          errorCount++
        }
      } else {
        console.log(`✅ [${i + 1}/${statements.length}] ${description}`)
        successCount++
      }
    } catch (err) {
      // RPC function doesn't exist
      if (err.message.includes('function exec_sql') || err.message.includes('Could not find')) {
        console.log(`⚠️  RPC function not available. Manual execution required.`)
        console.log(`\nPlease go to this URL and execute the SQL manually:`)
        console.log(`https://supabase.com/dashboard/project/kqqyipnlkmmprfgygauk/sql/new\n`)
        console.log(`Migration file location:`)
        console.log(`${migrationPath}\n`)
        process.exit(1)
      }
      console.error(`❌ [${i + 1}/${statements.length}] ${description}`)
      console.error(`   Error: ${err.message}`)
      errors.push({ index: i + 1, description, error: err.message })
      errorCount++
    }

    await new Promise(resolve => setTimeout(resolve, 50))
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`✅ Migration complete: ${successCount} successful, ${errorCount} failed`)
  console.log('='.repeat(60))

  if (errors.length > 0) {
    console.log('\n⚠️  Errors occurred in these statements:\n')
    errors.forEach(err => {
      console.log(`${err.index}. ${err.description}`)
      console.log(`   ${err.error}\n`)
    })
  }

  if (errorCount === 0) {
    console.log('\n🎉 Migration completed successfully!')
    console.log('\n✅ Next step: Verify the migration')
    console.log('━'.repeat(60))
    console.log('node scripts/test-consultation-subtypes.js\n')
  }
}

executeMigration().catch(error => {
  console.error('❌ Error during migration:', error.message)
  process.exit(1)
})
