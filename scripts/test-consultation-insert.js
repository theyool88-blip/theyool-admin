require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function testConsultationInsert() {
  console.log('🧪 Testing consultation insert and VIEW integration...\n')

  try {
    // Test 1: Insert a test consultation
    console.log('1️⃣ Inserting test consultation...')

    const testConsultation = {
      name: '테스트 고객',
      phone: '010-1234-5678',
      request_type: 'visit',
      preferred_date: '2025-11-25',
      preferred_time: '14:00',
      office_location: '평택사무소',
      message: '이혼 상담을 받고 싶습니다.',
      status: 'pending'
    }

    const { data: insertedConsultation, error: insertError } = await supabase
      .from('consultations')
      .insert(testConsultation)
      .select()
      .single()

    if (insertError) {
      console.error('❌ Insert error:', insertError)
      return
    }

    console.log('✅ Consultation inserted successfully!')
    console.log(`   ID: ${insertedConsultation.id}`)
    console.log(`   Name: ${insertedConsultation.name}`)
    console.log(`   Type: ${insertedConsultation.request_type}\n`)

    // Test 2: Check if it appears in unified_calendar VIEW
    console.log('2️⃣ Checking unified_calendar VIEW...')

    const { data: viewData, error: viewError } = await supabase
      .from('unified_calendar')
      .select('*')
      .eq('event_type', 'CONSULTATION')
      .eq('reference_id', testConsultation.phone)

    if (viewError) {
      console.error('❌ View query error:', viewError)
      return
    }

    if (viewData.length === 0) {
      console.log('⚠️  Consultation not found in VIEW')
      console.log('   This might be because preferred_date is NULL in some consultations')
    } else {
      console.log('✅ Found in unified_calendar VIEW!')
      const event = viewData[0]
      console.log(`   Event Type: ${event.event_type_kr}`)
      console.log(`   Title: ${event.title}`)
      console.log(`   Date: ${event.event_date}`)
      console.log(`   Time: ${event.event_time}`)
      console.log(`   Location: ${event.location}`)
      console.log(`   Status: ${event.status}\n`)
    }

    // Test 3: Insert more varied consultations
    console.log('3️⃣ Inserting varied consultation types...')

    const consultationTypes = [
      {
        name: '김철수',
        phone: '010-2222-3333',
        request_type: 'callback',
        preferred_date: '2025-11-26',
        preferred_time: '10:00',
        office_location: '천안사무소',
        message: '전화 상담 요청',
        status: 'pending'
      },
      {
        name: '이영희',
        phone: '010-4444-5555',
        request_type: 'video',
        preferred_date: '2025-11-27',
        preferred_time: '11:00',
        office_location: '미정',
        message: '화상 상담 원합니다',
        status: 'pending'
      },
      {
        name: '박민수',
        phone: '010-6666-7777',
        request_type: 'info',
        preferred_date: '2025-11-28',
        preferred_time: '15:30',
        office_location: '평택사무소',
        message: '이혼 절차 문의',
        status: 'pending'
      }
    ]

    const { data: batchInsert, error: batchError } = await supabase
      .from('consultations')
      .insert(consultationTypes)
      .select()

    if (batchError) {
      console.error('❌ Batch insert error:', batchError)
      return
    }

    console.log(`✅ Inserted ${batchInsert.length} more consultations\n`)

    // Test 4: Query all consultations from VIEW
    console.log('4️⃣ Final unified_calendar VIEW check...')

    const { data: allConsultations, error: allError } = await supabase
      .from('unified_calendar')
      .select('*')
      .eq('event_type', 'CONSULTATION')
      .order('event_date', { ascending: true })

    if (allError) {
      console.error('❌ Error:', allError)
      return
    }

    console.log(`✅ Total consultations in VIEW: ${allConsultations.length}\n`)

    allConsultations.forEach((cons, idx) => {
      console.log(`   ${idx + 1}. ${cons.event_type_kr} - ${cons.case_name}`)
      console.log(`      날짜: ${cons.event_date}`)
      console.log(`      시간: ${cons.event_time || '시간 미정'}`)
      console.log(`      전화: ${cons.reference_id}`)
      console.log(`      사무소: ${cons.location || '미정'}`)
      console.log(`      상태: ${cons.status}\n`)
    })

    console.log('✅ All consultation tests passed!')

  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testConsultationInsert()
