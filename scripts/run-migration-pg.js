const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

// PostgreSQL 연결 설정
const client = new Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.kqqyipnlkmmprfgygauk',
  password: 'Soofm9856!',
  ssl: {
    rejectUnauthorized: false
  }
})

async function runMigration() {
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║   법무법인 더율 - 지출 관리 시스템 마이그레이션 실행     ║')
  console.log('╚═══════════════════════════════════════════════════════════╝\n')

  try {
    console.log('🔌 데이터베이스 연결 중...')
    await client.connect()
    console.log('✅ 데이터베이스 연결 완료\n')

    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20251124_create_expense_management_system.sql')

    console.log('📖 마이그레이션 파일 읽기...')
    const sql = fs.readFileSync(migrationPath, 'utf8')

    console.log('🚀 마이그레이션 실행 중...\n')

    // 전체 SQL을 한 번에 실행
    const result = await client.query(sql)

    console.log('\n✅ 마이그레이션이 성공적으로 완료되었습니다!')
    console.log('\n📊 생성된 객체:')
    console.log('   - 테이블: expenses, recurring_templates, partner_withdrawals, monthly_settlements')
    console.log('   - View: 5개 (통계 뷰)')
    console.log('   - 인덱스: 15개')
    console.log('   - RLS 정책: 16개')
    console.log('   - 트리거: 4개')

    console.log('\n🎉 다음 단계: 데이터 임포트')
    console.log('━'.repeat(60))
    console.log('npm install csv-parse')
    console.log('npx ts-node scripts/import-expense-data.ts\n')

  } catch (error) {
    console.error('\n❌ 마이그레이션 실행 중 오류 발생:')
    console.error(error.message)

    if (error.message.includes('already exists')) {
      console.log('\n⚠️  일부 객체가 이미 존재합니다.')
      console.log('이미 마이그레이션이 실행되었을 수 있습니다.')
      console.log('\n확인 방법:')
      console.log('SELECT table_name FROM information_schema.tables')
      console.log('WHERE table_schema = \'public\'')
      console.log('AND table_name IN (\'expenses\', \'recurring_templates\', \'partner_withdrawals\', \'monthly_settlements\');')
    } else {
      console.log('\n수동 실행이 필요합니다:')
      console.log('https://supabase.com/dashboard/project/kqqyipnlkmmprfgygauk/sql/new')
    }

    process.exit(1)
  } finally {
    await client.end()
  }
}

runMigration()
