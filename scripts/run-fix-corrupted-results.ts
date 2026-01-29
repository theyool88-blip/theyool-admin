import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixCorruptedResults() {
  console.log('=== Step 1: 손상된 레코드 확인 ===')

  // Step 1: 손상된 레코드 확인
  const { data: corruptedRecords, error: selectError } = await supabase
    .from('court_hearings')
    .select('id, case_number, hearing_type, result, scourt_raw_data')
    .eq('result', 'adjourned')
    .not('scourt_raw_data->result', 'is', null)

  if (selectError) {
    console.error('조회 오류:', selectError)
    return
  }

  // 실제 손상된 레코드 필터링 (기일변경, 연기, 휴정이 아닌 것)
  const postponementKeywords = ['기일변경', '연기', '휴정']
  const actualCorrupted = corruptedRecords?.filter(record => {
    const scourtResult = record.scourt_raw_data?.result
    return scourtResult && !postponementKeywords.includes(scourtResult)
  }) || []

  console.log(`손상된 레코드 수: ${actualCorrupted.length}`)
  actualCorrupted.forEach(record => {
    console.log(`  - ${record.case_number} (${record.hearing_type}): result=${record.result}, scourt_result=${record.scourt_raw_data?.result}`)
  })

  if (actualCorrupted.length === 0) {
    console.log('수정할 레코드가 없습니다.')
    return
  }

  console.log('\n=== Step 2: 손상된 레코드 수정 (result를 NULL로 리셋) ===')

  // Step 2: 손상된 레코드 수정
  const idsToFix = actualCorrupted.map(r => r.id)

  const { error: updateError, count } = await supabase
    .from('court_hearings')
    .update({ result: null })
    .in('id', idsToFix)

  if (updateError) {
    console.error('업데이트 오류:', updateError)
    return
  }

  console.log(`${idsToFix.length}개 레코드 수정 완료`)

  console.log('\n=== Step 3: 수정 결과 확인 ===')

  // Step 3: 수정 결과 확인
  const { data: verifyRecords, error: verifyError } = await supabase
    .from('court_hearings')
    .select('id, case_number, result, scourt_raw_data')
    .in('id', idsToFix)

  if (verifyError) {
    console.error('검증 조회 오류:', verifyError)
    return
  }

  console.log('수정된 레코드 확인:')
  verifyRecords?.forEach(record => {
    console.log(`  - ${record.case_number}: result=${record.result}, scourt_result=${record.scourt_raw_data?.result}`)
  })

  console.log('\n=== 완료 ===')
}

fixCorruptedResults().catch(console.error)
