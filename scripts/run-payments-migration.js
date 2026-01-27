require('dotenv').config({ path: '.env.local' })
const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function runMigration() {
  try {
    console.log('🚀 payments 테이블 마이그레이션 시작\n')

    const sql = fs.readFileSync(
      '/Users/hskim/luseed/supabase/migrations/20251124_create_payments_table.sql',
      'utf-8'
    )

    console.log('📝 SQL 파일 로드 완료')
    console.log(`📏 SQL 길이: ${sql.length} 바이트\n`)

    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
      throw error
    }

    console.log('✅ 마이그레이션 성공!\n')
    console.log('생성된 항목:')
    console.log('  - payments 테이블')
    console.log('  - payment_stats_by_office VIEW')
    console.log('  - payment_stats_by_category VIEW')
    console.log('  - payment_stats_by_month VIEW')
    console.log('  - case_payment_summary VIEW')
    console.log('  - consultation_payment_summary VIEW')
    console.log('  - RLS 정책')
    console.log('  - 인덱스 8개\n')
  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error)
    process.exit(1)
  }
}

runMigration()
