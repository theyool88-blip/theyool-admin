require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

// Construct PostgreSQL connection string from Supabase URL
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL')
  process.exit(1)
}

// Extract project ref from Supabase URL (e.g., https://PROJECT_REF.supabase.co)
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

if (!projectRef) {
  console.error('❌ Could not extract project ref from Supabase URL')
  process.exit(1)
}

// Construct direct PostgreSQL connection URL
// Format: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.DATABASE_PASSWORD

if (!dbPassword) {
  console.log('⚠️  Direct database password not found in environment variables')
  console.log('   Looking for: SUPABASE_DB_PASSWORD or DATABASE_PASSWORD')
  console.log('\n📋 Please apply migration manually via Supabase Dashboard:')
  console.log('   https://supabase.com/dashboard/project/kqqyipnlkmmprfgygauk/sql/new')
  console.log('\n   Or add database password to .env.local:')
  console.log('   SUPABASE_DB_PASSWORD=your_db_password')
  process.exit(1)
}

const connectionString = `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`

async function applyMigration() {
  const client = new Client({ connectionString })

  try {
    console.log('🔗 Connecting to PostgreSQL database...')
    await client.connect()
    console.log('✅ Connected!\n')

    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20251125_update_consultations_in_calendar.sql')
    const sql = fs.readFileSync(migrationPath, 'utf8')

    console.log('📊 Executing migration...')
    console.log('━'.repeat(60))

    await client.query(sql)

    console.log('━'.repeat(60))
    console.log('✅ Migration applied successfully!\n')

    // Verify the migration
    console.log('🧪 Verifying migration...')
    const result = await client.query(`
      SELECT id, event_subtype, status, title
      FROM unified_calendar
      WHERE event_type = 'CONSULTATION'
      LIMIT 3
    `)

    console.log(`\nSample consultation subtypes (${result.rows.length} rows):`)
    result.rows.forEach((row, idx) => {
      console.log(`${idx + 1}. ${row.title}`)
      console.log(`   Status: ${row.status}`)
      console.log(`   Event Subtype: ${row.event_subtype}\n`)
    })

    const hasNewFormat = result.rows.some(row =>
      row.event_subtype &&
      (row.event_subtype.startsWith('pending_') || row.event_subtype.startsWith('confirmed_'))
    )

    if (hasNewFormat) {
      console.log('✅ Verification PASSED: event_subtype has status prefix')
      console.log('\n🎉 Migration completed and verified successfully!')
    } else {
      console.log('⚠️  Verification WARNING: event_subtype may not have status prefix')
      console.log('   This might be expected if no consultations exist with those statuses')
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Tip: Connection refused. Please check:')
      console.log('   1. Database password is correct')
      console.log('   2. Connection pooler is enabled in Supabase')
      console.log('   3. IP whitelist allows your connection')
    }
    process.exit(1)
  } finally {
    await client.end()
  }
}

applyMigration()
