/**
 * 법원 기일 관리 시스템 검증 스크립트
 *
 * 실행 방법:
 * node scripts/verify-court-hearing-system.js
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function verify() {
  console.log('🔍 법원 기일 관리 시스템 검증 시작...\n')

  let errors = 0

  // 1. 테이블 존재 확인
  console.log('📋 1. 테이블 존재 확인')
  const tables = ['court_hearings', 'case_deadlines', 'deadline_types']

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('id').limit(1)
      if (error) throw error
      console.log(`  ✅ ${table} 테이블 존재`)
    } catch (error) {
      console.error(`  ❌ ${table} 테이블 없음:`, error.message)
      errors++
    }
  }

  // 2. 뷰(View) 존재 확인
  console.log('\n📊 2. 뷰(View) 존재 확인')
  const views = ['upcoming_hearings', 'urgent_deadlines']

  for (const view of views) {
    try {
      const { error } = await supabase.from(view).select('*').limit(1)
      if (error) throw error
      console.log(`  ✅ ${view} 뷰 존재`)
    } catch (error) {
      console.error(`  ❌ ${view} 뷰 없음:`, error.message)
      errors++
    }
  }

  // 3. deadline_types 마스터 데이터 확인
  console.log('\n📚 3. deadline_types 마스터 데이터 확인')
  try {
    const { data, error } = await supabase
      .from('deadline_types')
      .select('*')
      .order('days', { ascending: false })

    if (error) throw error

    if (!data || data.length === 0) {
      console.error('  ❌ deadline_types에 데이터가 없습니다.')
      errors++
    } else {
      console.log(`  ✅ ${data.length}개의 불변기간 유형 발견:`)
      data.forEach(type => {
        console.log(`     - ${type.name}: ${type.days}일`)
      })
    }
  } catch (error) {
    console.error('  ❌ deadline_types 조회 실패:', error.message)
    errors++
  }

  // 4. 트리거 테스트 (데드라인 자동 계산)
  console.log('\n🔧 4. 트리거 테스트 (데드라인 자동 계산)')
  try {
    // 테스트용 사건번호 (실제 존재하지 않아도 됨)
    const testCaseNumber = 'TEST-2025-00001'
    const triggerDate = '2025-11-22'

    // 테스트 데이터 삽입
    const { data: insertedData, error: insertError } = await supabase
      .from('case_deadlines')
      .insert({
        case_number: testCaseNumber,
        deadline_type: 'APPEAL_PERIOD', // 14일
        trigger_date: triggerDate,
        notes: '트리거 테스트용 데이터',
        status: 'PENDING'
      })
      .select()
      .single()

    if (insertError) throw insertError

    // deadline_date가 자동 계산되었는지 확인
    if (!insertedData.deadline_date || !insertedData.deadline_datetime) {
      console.error('  ❌ 트리거가 실행되지 않았습니다 (deadline_date, deadline_datetime이 NULL)')
      errors++
    } else {
      const expectedDate = new Date(triggerDate)
      expectedDate.setDate(expectedDate.getDate() + 14)
      const calculatedDate = new Date(insertedData.deadline_date)

      if (calculatedDate.toDateString() === expectedDate.toDateString()) {
        console.log(`  ✅ 트리거 정상 동작 (${triggerDate} + 14일 = ${insertedData.deadline_date})`)
      } else {
        console.error(`  ❌ 계산 오류: 예상 ${expectedDate.toISOString().split('T')[0]}, 실제 ${insertedData.deadline_date}`)
        errors++
      }

      // 테스트 데이터 삭제
      await supabase.from('case_deadlines').delete().eq('id', insertedData.id)
      console.log('  🗑️  테스트 데이터 삭제 완료')
    }
  } catch (error) {
    console.error('  ❌ 트리거 테스트 실패:', error.message)
    errors++
  }

  // 5. API 접근성 테스트 (선택사항)
  console.log('\n🌐 5. API 접근성 테스트')
  const apiEndpoints = [
    '/api/admin/court-hearings',
    '/api/admin/case-deadlines',
    '/api/admin/deadline-types'
  ]

  console.log('  ℹ️  API 테스트는 로컬 서버가 실행 중일 때만 가능합니다.')
  console.log('  💡 수동 테스트: npm run dev 실행 후 브라우저에서 확인')

  // 6. 요약
  console.log('\n' + '='.repeat(60))
  if (errors === 0) {
    console.log('✅ 모든 검증 통과! 시스템이 정상적으로 설정되었습니다.')
  } else {
    console.log(`❌ ${errors}개의 오류 발견. 위의 로그를 확인하세요.`)
  }
  console.log('='.repeat(60) + '\n')
}

verify().catch(console.error)
