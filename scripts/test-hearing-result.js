require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testHearingResult() {
  console.log('🧪 변론기일 결과 테스트\n')

  try {
    // 1. 첫 번째 법원기일 조회
    const { data: hearings, error: fetchError } = await supabase
      .from('court_hearings')
      .select('*')
      .limit(3)

    if (fetchError) throw fetchError

    console.log(`📋 조회된 법원기일: ${hearings?.length || 0}건\n`)

    if (hearings && hearings.length > 0) {
      hearings.forEach((h, i) => {
        console.log(`[${i + 1}] ${h.case_number} - ${h.hearing_date}`)
        console.log(`    현재 result: ${h.result || '(없음)'}`)
      })

      console.log('\n💡 테스트 방법:')
      console.log('1. 사건 상세 페이지에서 법원기일을 클릭')
      console.log('2. "수정" 버튼 클릭')
      console.log('3. "변론기일 결과" 선택 (속행, 종결, 연기, 추정)')
      console.log('4. 저장 후 일정 목록에서 결과 배지 확인')
    }

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

testHearingResult()
