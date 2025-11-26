#!/usr/bin/env ts-node
// ============================================================================
// Supabase 마이그레이션 실행 스크립트
// ============================================================================

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// 환경 변수에서 Supabase 정보 가져오기
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase 환경 변수가 설정되지 않았습니다.')
  console.error('NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 확인하세요.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function runMigration() {
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║   법무법인 더율 - 지출 관리 시스템 마이그레이션           ║')
  console.log('╚═══════════════════════════════════════════════════════════╝\n')

  const migrationFile = path.join(__dirname, '../supabase/migrations/20251124_create_expense_management_system.sql')

  if (!fs.existsSync(migrationFile)) {
    console.error(`❌ 마이그레이션 파일을 찾을 수 없습니다: ${migrationFile}`)
    process.exit(1)
  }

  console.log(`📄 마이그레이션 파일 읽기: ${path.basename(migrationFile)}\n`)
  const sql = fs.readFileSync(migrationFile, 'utf-8')

  // SQL을 개별 명령문으로 분리 (주석 제거 및 빈 줄 제거)
  const statements = sql
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

  console.log(`📊 총 ${statements.length}개의 SQL 명령문을 실행합니다...\n`)

  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';'

    // 명령문 타입 추출 (CREATE TABLE, CREATE INDEX 등)
    const match = statement.match(/^(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|COMMENT ON)\s+(\w+)/i)
    const commandType = match ? `${match[1]} ${match[2]}` : 'UNKNOWN'

    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql_query: statement })

      if (error) {
        // RPC 함수가 없는 경우 직접 실행 시도
        const { error: directError } = await supabase.from('_sql_exec').insert({ query: statement })

        if (directError) {
          console.error(`❌ [${i + 1}/${statements.length}] ${commandType}: ${directError.message}`)
          errorCount++
        } else {
          console.log(`✅ [${i + 1}/${statements.length}] ${commandType}`)
          successCount++
        }
      } else {
        console.log(`✅ [${i + 1}/${statements.length}] ${commandType}`)
        successCount++
      }
    } catch (err: any) {
      console.error(`❌ [${i + 1}/${statements.length}] ${commandType}: ${err.message}`)
      errorCount++
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`✅ 마이그레이션 완료: ${successCount}개 성공, ${errorCount}개 실패`)
  console.log('='.repeat(60))

  if (errorCount > 0) {
    console.log('\n⚠️  일부 명령문 실행에 실패했습니다.')
    console.log('Supabase Dashboard에서 SQL Editor를 통해 마이그레이션 파일을 직접 실행하세요.')
    console.log(`URL: ${supabaseUrl.replace('https://', 'https://supabase.com/dashboard/project/')}/editor`)
  }
}

// 실행
runMigration().catch(error => {
  console.error('❌ 마이그레이션 실행 중 오류 발생:', error)
  process.exit(1)
})
