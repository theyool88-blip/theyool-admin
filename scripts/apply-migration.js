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

async function applyMigration() {
  try {
    console.log('📖 Reading migration file...')
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20251124_fix_unified_calendar_consultations.sql')
    const sql = fs.readFileSync(migrationPath, 'utf8')

    console.log('🔄 Executing SQL migration...')
    console.log('\n' + sql + '\n')

    // Since we can't execute raw SQL directly, we'll use PGPASSWORD and psql
    console.log('⚠️  Supabase JS client cannot execute raw DDL (CREATE VIEW)')
    console.log('📋 Please run this migration manually:')
    console.log('\n1. Using Supabase Dashboard SQL Editor:')
    console.log('   - Go to: https://supabase.com/dashboard/project/kqqyipnlkmmprfgygauk/sql/new')
    console.log('   - Paste the SQL from the migration file')
    console.log('   - Click "Run"\n')
    console.log('2. Or using psql command:')
    console.log('   PGPASSWORD=\'Soofm9856!\' psql -h aws-0-ap-northeast-2.pooler.supabase.com -p 6543 -d postgres -U postgres.kqqyipnlkmmprfgygauk -f supabase/migrations/20251124_fix_unified_calendar_consultations.sql')

  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

applyMigration()
