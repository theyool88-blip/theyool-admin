/**
 * Supabase 연결 테스트 스크립트
 * 실행: npx ts-node scripts/test-supabase-connection.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'

// ESM에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// .env.local 로드
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

async function testConnection() {
  console.log('=== Supabase 연결 테스트 ===\n')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // 1. 환경 변수 확인
  console.log('1. 환경 변수 확인')
  console.log('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓ 설정됨' : '✗ 누락')
  console.log('   SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? '✓ 설정됨' : '✗ 누락')

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('\n❌ 필수 환경 변수가 누락되었습니다.')
    process.exit(1)
  }

  // 2. 키 형식 확인
  console.log('\n2. 키 형식 확인')
  const isJwtFormat = serviceRoleKey.startsWith('eyJ')
  console.log('   Service Role Key JWT 형식:', isJwtFormat ? '✓ 올바름' : '✗ 잘못됨 (eyJ로 시작해야 함)')

  if (!isJwtFormat) {
    console.error('\n❌ SUPABASE_SERVICE_ROLE_KEY가 올바른 JWT 형식이 아닙니다.')
    console.log('   현재 값 시작 부분:', serviceRoleKey.substring(0, 20) + '...')
    console.log('\n   해결 방법:')
    console.log('   1. Supabase Dashboard → Project Settings → API')
    console.log('   2. "service_role" 키를 복사 (eyJ...로 시작하는 긴 문자열)')
    console.log('   3. .env.local 파일의 SUPABASE_SERVICE_ROLE_KEY 값 업데이트')
    process.exit(1)
  }

  // 3. 연결 테스트
  console.log('\n3. 데이터베이스 연결 테스트')
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // 간단한 쿼리 실행
    const { data, error } = await supabase
      .from('legal_cases')
      .select('id')
      .limit(1)

    if (error) {
      console.error('   ✗ 쿼리 실패:', error.code, error.message)
      if (error.message.includes('JWT') || error.message.includes('invalid')) {
        console.log('\n   💡 API 키가 유효하지 않습니다. Supabase Dashboard에서 키를 확인해주세요.')
      }
      process.exit(1)
    }

    console.log('   ✓ 연결 성공!')
    console.log('   조회된 사건 수:', data?.length ?? 0)

    // 4. 테이블 접근 권한 확인
    console.log('\n4. 테이블 접근 권한 확인')
    const tables = ['legal_cases', 'scourt_case_snapshots', 'case_parties']
    for (const table of tables) {
      const { error: tableError } = await supabase.from(table).select('id').limit(1)
      console.log(`   ${table}:`, tableError ? `✗ ${tableError.code}` : '✓ 접근 가능')
    }

    console.log('\n✅ 모든 테스트 통과!')

  } catch (err) {
    console.error('   ✗ 연결 오류:', err)
    process.exit(1)
  }
}

testConnection()
