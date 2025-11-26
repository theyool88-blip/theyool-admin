require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testCaseSchedules() {
  const caseNumber = '2025가단109347'

  console.log(`🔍 Testing schedules for case: ${caseNumber}\n`)

  try {
    // 1. 사건 정보 조회
    console.log('1️⃣ Fetching case info...')
    const { data: caseData, error: caseError } = await supabase
      .from('legal_cases')
      .select('*')
      .eq('court_case_number', caseNumber)
      .single()

    if (caseError) {
      console.error('❌ Case error:', caseError)
      return
    }

    if (!caseData) {
      console.log('❌ Case not found')
      return
    }

    console.log('✅ Case found:')
    console.log('   - ID:', caseData.id)
    console.log('   - Name:', caseData.case_name)
    console.log('   - Court Case Number:', caseData.court_case_number)
    console.log()

    // 2. court_hearings 조회 (case_id로)
    console.log('2️⃣ Fetching court hearings by case_id...')
    const { data: hearingsByCaseId, error: hearingError1 } = await supabase
      .from('court_hearings')
      .select('*')
      .eq('case_id', caseData.id)

    console.log('   Results:', hearingsByCaseId?.length || 0, 'hearings')
    if (hearingsByCaseId && hearingsByCaseId.length > 0) {
      hearingsByCaseId.forEach((h, i) => {
        console.log(`   [${i + 1}] ${h.hearing_type} - ${h.hearing_date} - case_id: ${h.case_id}`)
      })
    }
    console.log()

    // 3. court_hearings 조회 (case_number로)
    console.log('3️⃣ Fetching court hearings by case_number...')
    const { data: hearingsByCaseNumber, error: hearingError2 } = await supabase
      .from('court_hearings')
      .select('*')
      .eq('case_number', caseNumber)

    console.log('   Results:', hearingsByCaseNumber?.length || 0, 'hearings')
    if (hearingsByCaseNumber && hearingsByCaseNumber.length > 0) {
      hearingsByCaseNumber.forEach((h, i) => {
        console.log(`   [${i + 1}] ${h.hearing_type} - ${h.hearing_date} - case_id: ${h.case_id}`)
      })
    }
    console.log()

    // 4. case_deadlines 조회 (case_id로)
    console.log('4️⃣ Fetching deadlines by case_id...')
    const { data: deadlinesByCaseId, error: deadlineError1 } = await supabase
      .from('case_deadlines')
      .select('*')
      .eq('case_id', caseData.id)

    console.log('   Results:', deadlinesByCaseId?.length || 0, 'deadlines')
    if (deadlinesByCaseId && deadlinesByCaseId.length > 0) {
      deadlinesByCaseId.forEach((d, i) => {
        console.log(`   [${i + 1}] ${d.deadline_type} - ${d.deadline_date} - case_id: ${d.case_id}`)
      })
    }
    console.log()

    // 5. case_deadlines 조회 (case_number로)
    console.log('5️⃣ Fetching deadlines by case_number...')
    const { data: deadlinesByCaseNumber, error: deadlineError2 } = await supabase
      .from('case_deadlines')
      .select('*')
      .eq('case_number', caseNumber)

    console.log('   Results:', deadlinesByCaseNumber?.length || 0, 'deadlines')
    if (deadlinesByCaseNumber && deadlinesByCaseNumber.length > 0) {
      deadlinesByCaseNumber.forEach((d, i) => {
        console.log(`   [${i + 1}] ${d.deadline_type} - ${d.deadline_date} - case_id: ${d.case_id}`)
      })
    }
    console.log()

    // 6. Summary
    console.log('📊 Summary:')
    console.log('   - Hearings (by case_id):', hearingsByCaseId?.length || 0)
    console.log('   - Hearings (by case_number):', hearingsByCaseNumber?.length || 0)
    console.log('   - Deadlines (by case_id):', deadlinesByCaseId?.length || 0)
    console.log('   - Deadlines (by case_number):', deadlinesByCaseNumber?.length || 0)

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

testCaseSchedules()
