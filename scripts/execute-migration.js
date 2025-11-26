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
  console.log('║   법무법인 더율 - 지출 관리 시스템 마이그레이션 실행     ║')
  console.log('╚═══════════════════════════════════════════════════════════╝\n')

  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20251124_create_expense_management_system.sql')

  console.log('📖 마이그레이션 파일 읽기...')
  const sql = fs.readFileSync(migrationPath, 'utf8')

  // SQL을 개별 명령문으로 분리
  const statements = sql
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => {
      // 빈 줄과 주석만 있는 줄 제거
      const cleaned = stmt.replace(/--[^\n]*\n/g, '').trim()
      return cleaned.length > 0
    })

  console.log(`📊 총 ${statements.length}개의 SQL 명령문을 실행합니다...\n`)

  let successCount = 0
  let errorCount = 0
  const errors = []

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';'

    // 명령문 타입 추출
    const match = statement.match(/^(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|COMMENT ON)\s+(\w+)/i)
    const commandType = match ? `${match[1]} ${match[2]}` : 'SQL'

    // 간단한 설명 추출
    let description = commandType
    if (statement.includes('CREATE TABLE') && statement.includes('expenses')) {
      description = 'CREATE TABLE expenses'
    } else if (statement.includes('CREATE TABLE') && statement.includes('recurring_templates')) {
      description = 'CREATE TABLE recurring_templates'
    } else if (statement.includes('CREATE TABLE') && statement.includes('partner_withdrawals')) {
      description = 'CREATE TABLE partner_withdrawals'
    } else if (statement.includes('CREATE TABLE') && statement.includes('monthly_settlements')) {
      description = 'CREATE TABLE monthly_settlements'
    } else if (statement.includes('CREATE VIEW') && statement.includes('monthly_revenue_summary')) {
      description = 'CREATE VIEW monthly_revenue_summary'
    } else if (statement.includes('CREATE VIEW') && statement.includes('monthly_expense_summary')) {
      description = 'CREATE VIEW monthly_expense_summary'
    } else if (statement.includes('CREATE VIEW') && statement.includes('partner_debt_status')) {
      description = 'CREATE VIEW partner_debt_status'
    } else if (statement.includes('CREATE VIEW') && statement.includes('expense_stats_by_category')) {
      description = 'CREATE VIEW expense_stats_by_category'
    } else if (statement.includes('CREATE VIEW') && statement.includes('settlement_dashboard')) {
      description = 'CREATE VIEW settlement_dashboard'
    } else if (statement.includes('CREATE POLICY')) {
      const policyMatch = statement.match(/CREATE POLICY "([^"]+)"/i)
      description = policyMatch ? `CREATE POLICY ${policyMatch[1].substring(0, 30)}...` : 'CREATE POLICY'
    }

    try {
      // Supabase의 rpc를 사용하여 SQL 실행 시도
      const { data, error } = await supabase.rpc('exec_sql', { sql: statement })

      if (error) {
        // 특정 에러는 무시 (이미 존재하는 객체 등)
        if (
          error.message.includes('already exists') ||
          error.message.includes('does not exist')
        ) {
          console.log(`⏭️  [${i + 1}/${statements.length}] ${description} (already exists)`)
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
      // RPC 함수가 없는 경우, 다른 방법 시도 필요
      if (err.message.includes('function exec_sql') || err.message.includes('Could not find')) {
        console.log(`⚠️  RPC 함수가 없습니다. Supabase Dashboard에서 수동 실행이 필요합니다.`)
        console.log(`\n다음 URL로 이동하여 SQL을 직접 실행해주세요:`)
        console.log(`https://supabase.com/dashboard/project/kqqyipnlkmmprfgygauk/sql/new\n`)
        console.log(`마이그레이션 파일 위치:`)
        console.log(`${migrationPath}\n`)
        process.exit(1)
      }
      console.error(`❌ [${i + 1}/${statements.length}] ${description}`)
      console.error(`   Error: ${err.message}`)
      errors.push({ index: i + 1, description, error: err.message })
      errorCount++
    }

    // 너무 빠르게 실행하지 않도록 약간의 딜레이
    await new Promise(resolve => setTimeout(resolve, 50))
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`✅ 마이그레이션 완료: ${successCount}개 성공, ${errorCount}개 실패`)
  console.log('='.repeat(60))

  if (errors.length > 0) {
    console.log('\n⚠️  다음 명령문에서 오류가 발생했습니다:\n')
    errors.forEach(err => {
      console.log(`${err.index}. ${err.description}`)
      console.log(`   ${err.error}\n`)
    })
  }

  if (errorCount === 0) {
    console.log('\n🎉 모든 마이그레이션이 성공적으로 완료되었습니다!')
    console.log('\n다음 단계: 데이터 임포트')
    console.log('━'.repeat(60))
    console.log('npm install csv-parse')
    console.log('npx ts-node scripts/import-expense-data.ts\n')
  }
}

executeMigration().catch(error => {
  console.error('❌ 마이그레이션 실행 중 오류 발생:', error.message)
  process.exit(1)
})
