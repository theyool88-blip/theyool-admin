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

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function applyMigration() {
  console.log('🔄 Applying unified_calendar VIEW migration...\n')

  // Read the migration file
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20251125_update_consultations_in_calendar.sql')
  const sql = fs.readFileSync(migrationPath, 'utf8')

  console.log('📄 Migration SQL loaded')
  console.log('📊 Executing migration...\n')

  try {
    // Execute the SQL using the RPC endpoint
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
      // If exec_sql doesn't exist, we need to use a different approach
      console.log('⚠️  Direct RPC not available, trying alternative approach...\n')

      // Try to drop and recreate view using Supabase client
      // This is a workaround since we can't execute raw SQL directly
      console.log('❌ Cannot execute DDL directly from Node.js client')
      console.log('📋 Please apply the migration manually:\n')
      console.log('1. Go to Supabase Dashboard SQL Editor:')
      console.log('   https://supabase.com/dashboard/project/kqqyipnlkmmprfgygauk/sql/new')
      console.log('\n2. Copy and paste the SQL from:')
      console.log(`   ${migrationPath}`)
      console.log('\n3. Click "Run" button')
      console.log('\n4. Verify with: node scripts/test-consultation-subtypes.js')
      return
    }

    console.log('✅ Migration applied successfully!')
    console.log('🧪 Running verification test...\n')

    // Verify the migration
    const { data: testData, error: testError } = await supabase
      .from('unified_calendar')
      .select('event_subtype, status, title')
      .eq('event_type', 'CONSULTATION')
      .limit(3)

    if (testError) {
      console.error('❌ Verification failed:', testError)
      return
    }

    console.log('Sample consultation subtypes:')
    testData.forEach((cons, idx) => {
      console.log(`${idx + 1}. ${cons.title}`)
      console.log(`   Status: ${cons.status}`)
      console.log(`   Event Subtype: ${cons.event_subtype}\n`)
    })

    const hasNewFormat = testData.some(cons =>
      cons.event_subtype &&
      (cons.event_subtype.startsWith('pending_') || cons.event_subtype.startsWith('confirmed_'))
    )

    if (hasNewFormat) {
      console.log('✅ Verification PASSED: event_subtype has status prefix')
    } else {
      console.log('⚠️  Verification FAILED: event_subtype does not have status prefix')
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    console.log('\n📋 Please apply the migration manually via Supabase Dashboard')
  }
}

applyMigration()
