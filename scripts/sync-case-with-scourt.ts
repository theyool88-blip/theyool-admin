import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

config({ path: resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const caseId = 'efedd7e3-2e80-49fe-81ec-310633da5a8e'

async function syncCase() {
  console.log('🔍 사건 정보 조회 중...\n')

  // 1. 사건 정보 가져오기
  const { data: caseData, error: caseError } = await supabase
    .from('legal_cases')
    .select('id, case_name, court_case_number, court_name, tenant_id')
    .eq('id', caseId)
    .single()

  if (caseError || !caseData) {
    console.error('❌ 사건 조회 실패:', caseError?.message)
    return
  }

  console.log('📁 사건 정보:')
  console.log('   이름:', caseData.case_name)
  console.log('   사건번호:', caseData.court_case_number)
  console.log('   법원:', caseData.court_name)
  console.log()

  if (!caseData.court_case_number) {
    console.error('❌ 사건번호가 없습니다')
    return
  }

  // 2. 당사자 정보 가져오기 (선택)
  const { data: parties } = await supabase
    .from('case_parties')
    .select('party_name, is_our_client')
    .eq('case_id', caseId)
    .eq('is_our_client', true)
    .limit(1)

  const partyName = parties && parties.length > 0 ? parties[0].party_name : null

  console.log('🔄 대법원 동기화 시작...\n')

  // 3. 동기화 API 호출
  try {
    const response = await fetch('http://localhost:3000/api/admin/scourt/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        legalCaseId: caseData.id,
        caseNumber: caseData.court_case_number,
        courtName: caseData.court_name,
        partyName: partyName,
        forceRefresh: true,
        syncType: 'full',
        triggerSource: 'manual'
      })
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('❌ 동기화 실패:', result.error || result.message)
      console.error('   코드:', result.code)
      console.log('\n전체 응답:', JSON.stringify(result, null, 2))
      return
    }

    console.log('✅ 동기화 완료!\n')
    console.log('📊 전체 응답:')
    console.log(JSON.stringify(result, null, 2))
    console.log()

    // 4. court_hearings 확인
    console.log('\n⚖️  동기화된 법원기일 확인 중...\n')
    const { data: hearings, count } = await supabase
      .from('court_hearings')
      .select('*', { count: 'exact' })
      .eq('case_id', caseId)
      .order('hearing_date', { ascending: true })

    console.log(`   총 ${count || 0}개의 법원기일\n`)

    if (hearings && hearings.length > 0) {
      hearings.forEach((h, i) => {
        console.log(`   ${i + 1}. ${h.hearing_date} ${h.hearing_time || ''}`)
        console.log(`      타입: ${h.hearing_type}`)
        console.log(`      장소: ${h.location || 'N/A'}`)
        console.log(`      상태: ${h.status}`)
        console.log()
      })
    }

  } catch (error) {
    console.error('❌ 동기화 중 오류:', error)
  }
}

syncCase()
