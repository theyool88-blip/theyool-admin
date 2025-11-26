require('dotenv').config({ path: '.env.local' })
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

    // 1. payments 테이블이 이미 존재하는지 확인
    const { data: existingTables, error: checkError } = await supabase
      .from('payments')
      .select('id')
      .limit(1)

    if (!checkError || checkError.code !== 'PGRST116') {
      console.log('✅ payments 테이블이 이미 존재합니다.')
      console.log('   스키마 확인을 위해 테스트 데이터를 삽입해보겠습니다.\n')

      // 테스트 삽입
      const testData = {
        payment_date: '2025-11-24',
        depositor_name: '테스트입금',
        amount: 100000,
        office_location: '평택',
        payment_category: '모든 상담',
        imported_from_csv: false,
      }

      const { data: testResult, error: testError } = await supabase
        .from('payments')
        .insert(testData)
        .select()

      if (testError) {
        console.error('❌ 테스트 삽입 실패:', testError)
        console.log('\n⚠️  Supabase Dashboard에서 수동으로 마이그레이션을 실행해주세요.')
        console.log('   마이그레이션 파일: /Users/hskim/theyool-admin/supabase/migrations/20251124_create_payments_table.sql\n')
        process.exit(1)
      } else {
        console.log('✅ 테스트 삽입 성공!')
        console.log('   ID:', testResult[0].id)

        // 테스트 데이터 삭제
        await supabase.from('payments').delete().eq('id', testResult[0].id)
        console.log('   (테스트 데이터 삭제 완료)\n')
      }
    } else {
      console.log('⚠️  payments 테이블이 존재하지 않습니다.')
      console.log('   Supabase Dashboard에서 SQL을 직접 실행해주세요.\n')
      console.log('1. https://supabase.com/dashboard/project/kqqyipnlkmmprfgygauk/sql/new 접속')
      console.log('2. 아래 파일의 내용을 붙여넣기:')
      console.log('   /Users/hskim/theyool-admin/supabase/migrations/20251124_create_payments_table.sql\n')
      process.exit(1)
    }

    // 2. 뷰들이 존재하는지 확인
    console.log('📊 통계 뷰 확인 중...\n')

    const views = [
      'payment_stats_by_office',
      'payment_stats_by_category',
      'payment_stats_by_month',
      'case_payment_summary',
      'consultation_payment_summary',
    ]

    for (const viewName of views) {
      const { data, error } = await supabase.from(viewName).select('*').limit(1)
      if (error) {
        console.log(`❌ ${viewName} 뷰가 존재하지 않습니다.`)
      } else {
        console.log(`✅ ${viewName} 뷰 확인 완료`)
      }
    }

    console.log('\n✅ 마이그레이션 확인 완료!\n')
    console.log('다음 단계: CSV 임포트')
    console.log('  node scripts/import-payments-csv.js\n')
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

runMigration()
