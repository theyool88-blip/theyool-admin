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
    console.log('╔═══════════════════════════════════════════════════════════╗')
    console.log('║   법무법인 더율 - 지출 관리 시스템 마이그레이션           ║')
    console.log('╚═══════════════════════════════════════════════════════════╝\n')

    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20251124_create_expense_management_system.sql')

    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ 마이그레이션 파일을 찾을 수 없습니다: ${migrationPath}`)
      process.exit(1)
    }

    console.log('📖 마이그레이션 파일 읽기...')
    const sql = fs.readFileSync(migrationPath, 'utf8')

    console.log('✅ 마이그레이션 파일 확인 완료\n')
    console.log('📊 생성될 항목:')
    console.log('   - 테이블: expenses, recurring_templates, partner_withdrawals, monthly_settlements')
    console.log('   - 뷰: 5개 (monthly_revenue_summary, monthly_expense_summary, 등)')
    console.log('   - 인덱스: 15개')
    console.log('   - RLS 정책: 16개')
    console.log('   - 트리거: 4개\n')

    console.log('⚠️  Supabase JS client는 DDL (CREATE TABLE, CREATE VIEW 등)을 직접 실행할 수 없습니다.')
    console.log('📋 다음 방법 중 하나를 선택하여 마이그레이션을 실행하세요:\n')

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('방법 1: Supabase Dashboard SQL Editor (권장)')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    console.log('1. 다음 URL로 접속:')
    console.log('   https://supabase.com/dashboard/project/kqqyipnlkmmprfgygauk/sql/new\n')
    console.log('2. 마이그레이션 파일 내용 복사:')
    console.log(`   cat ${migrationPath}\n`)
    console.log('3. SQL Editor에 붙여넣고 "Run" 버튼 클릭\n')

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('방법 2: psql 명령어 (psql 설치되어 있는 경우)')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    console.log('PGPASSWORD=\'Soofm9856!\' psql \\')
    console.log('  -h aws-0-ap-northeast-2.pooler.supabase.com \\')
    console.log('  -p 6543 \\')
    console.log('  -d postgres \\')
    console.log('  -U postgres.kqqyipnlkmmprfgygauk \\')
    console.log(`  -f ${migrationPath}\n`)

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('마이그레이션 완료 후 확인 사항')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    console.log('1. Table Editor에서 테이블 확인:')
    console.log('   - expenses')
    console.log('   - recurring_templates')
    console.log('   - partner_withdrawals')
    console.log('   - monthly_settlements\n')
    console.log('2. SQL Editor에서 뷰 확인:')
    console.log('   SELECT * FROM monthly_revenue_summary LIMIT 5;')
    console.log('   SELECT * FROM partner_debt_status;\n')
    console.log('3. RLS 정책 확인:')
    console.log('   Authentication > Policies 메뉴에서 각 테이블별 4개 정책 확인\n')

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('다음 단계: 데이터 임포트')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    console.log('마이그레이션 완료 후 다음 명령어로 기존 데이터를 임포트하세요:\n')
    console.log('   npm install csv-parse')
    console.log('   npx ts-node scripts/import-expense-data.ts\n')

  } catch (error) {
    console.error('❌ 오류:', error.message)
    process.exit(1)
  }
}

applyMigration()
