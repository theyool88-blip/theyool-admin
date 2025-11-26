require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function runMigration() {
  console.log('🚀 Starting case_id migration...\n')

  try {
    const migrationFile = path.join(__dirname, '../supabase/migrations/20251124_add_case_id_to_schedules.sql')
    const sql = fs.readFileSync(migrationFile, 'utf8')

    console.log('📋 Migration SQL will be displayed below.')
    console.log('   Please copy and run it in Supabase Dashboard → SQL Editor\n')
    console.log('---')
    console.log(sql)
    console.log('---\n')

    console.log('✅ Migration SQL ready!')
    console.log('\n📋 Next Steps:')
    console.log('   1. Go to Supabase Dashboard → SQL Editor')
    console.log('   2. Copy and run the SQL above')
    console.log('   3. This will:')
    console.log('      - Add case_id column to court_hearings and case_deadlines')
    console.log('      - Update existing records with case_id')
    console.log('      - Update unified_calendar VIEW to use case_id')

  } catch (error) {
    console.error('\n❌ Error:', error)
  }
}

runMigration()
