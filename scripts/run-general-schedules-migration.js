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
  console.log('🚀 Starting general_schedules migration...\n')

  try {
    // 1. general_schedules 테이블 생성
    console.log('1️⃣ Creating general_schedules table...')
    const migration1 = fs.readFileSync(
      path.join(__dirname, '../supabase/migrations/20251124_add_general_schedules.sql'),
      'utf8'
    )

    const { error: error1 } = await supabase.rpc('exec_sql', { sql: migration1 })
    if (error1) {
      console.error('❌ Error creating table:', error1)
      throw error1
    }
    console.log('✅ general_schedules table created\n')

    // 2. unified_calendar VIEW 업데이트
    console.log('2️⃣ Updating unified_calendar VIEW...')
    const migration2 = fs.readFileSync(
      path.join(__dirname, '../supabase/migrations/20251124_update_unified_calendar_with_general.sql'),
      'utf8'
    )

    const { error: error2 } = await supabase.rpc('exec_sql', { sql: migration2 })
    if (error2) {
      console.error('❌ Error updating VIEW:', error2)
      throw error2
    }
    console.log('✅ unified_calendar VIEW updated\n')

    // 3. 테스트 데이터 확인
    console.log('3️⃣ Verifying migration...')
    const { data, error: verifyError } = await supabase
      .from('general_schedules')
      .select('count')
      .single()

    if (verifyError && verifyError.code !== 'PGRST116') {
      console.error('❌ Verification error:', verifyError)
    } else {
      console.log('✅ Migration verified successfully\n')
    }

    console.log('🎉 All migrations completed successfully!')
    console.log('\n📋 Summary:')
    console.log('   - general_schedules table ✅')
    console.log('   - unified_calendar VIEW updated ✅')
    console.log('\n💡 You can now add general schedules without case numbers!')

  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  }
}

runMigration()
