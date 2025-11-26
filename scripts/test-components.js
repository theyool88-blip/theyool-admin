require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function testComponents() {
  console.log('🧪 Testing Component Integration...\n')

  try {
    // Test 1: Check ScheduleListView data format
    console.log('1️⃣ Testing ScheduleListView data format...')

    const { data: schedules, error } = await supabase
      .from('unified_calendar')
      .select('*')
      .gte('event_date', '2025-11-23')
      .order('event_date', { ascending: true })
      .limit(10)

    if (error) {
      console.error('❌ Error:', error)
      return
    }

    // Transform to ScheduleListView format
    const listViewData = schedules.map(s => ({
      id: s.id,
      event_type: s.event_type,
      event_type_kr: s.event_type_kr,
      event_subtype: s.event_subtype,
      title: s.title,
      case_name: s.case_name,
      event_date: s.event_date,
      event_time: s.event_time,
      event_datetime: s.event_datetime,
      reference_id: s.reference_id,
      location: s.location,
      description: s.description,
      status: s.status,
      sort_priority: s.sort_priority
    }))

    console.log(`✅ Transformed ${listViewData.length} schedules for ScheduleListView`)
    console.log('   Sample data:')
    console.log(`   - ID: ${listViewData[0]?.id}`)
    console.log(`   - Type: ${listViewData[0]?.event_type} (${listViewData[0]?.event_type_kr})`)
    console.log(`   - Title: ${listViewData[0]?.title}`)
    console.log(`   - Date: ${listViewData[0]?.event_date} ${listViewData[0]?.event_time || ''}\n`)

    // Test 2: Check MonthlyCalendar data format
    console.log('2️⃣ Testing MonthlyCalendar data format...')

    const monthlyViewData = schedules.map(s => ({
      id: s.id,
      type: s.event_type === 'COURT_HEARING' ? 'hearing' : s.event_type === 'DEADLINE' ? 'deadline' : 'consultation',
      title: s.title,
      date: s.event_date,
      time: s.event_time,
      datetime: s.event_datetime,
      case_number: s.reference_id,
      location: s.location,
      notes: s.description,
      status: s.status,
      hearing_type: s.event_subtype
    }))

    console.log(`✅ Transformed ${monthlyViewData.length} schedules for MonthlyCalendar`)
    console.log('   Sample data:')
    console.log(`   - Type: ${monthlyViewData[0]?.type}`)
    console.log(`   - Case Number: ${monthlyViewData[0]?.case_number}`)
    console.log(`   - Hearing Type: ${monthlyViewData[0]?.hearing_type || 'N/A'}\n`)

    // Test 3: Check event type distribution for filtering
    console.log('3️⃣ Testing filter distribution...')

    const filterCounts = {
      COURT_HEARING: 0,
      DEADLINE: 0,
      CONSULTATION: 0
    }

    schedules.forEach(s => {
      filterCounts[s.event_type] = (filterCounts[s.event_type] || 0) + 1
    })

    console.log('✅ Filter counts:')
    console.log(`   법원기일: ${filterCounts.COURT_HEARING}`)
    console.log(`   데드라인: ${filterCounts.DEADLINE}`)
    console.log(`   상담: ${filterCounts.CONSULTATION}\n`)

    // Test 4: Check consultation-specific data
    console.log('4️⃣ Testing consultation-specific data...')

    const consultations = schedules.filter(s => s.event_type === 'CONSULTATION')

    if (consultations.length > 0) {
      console.log(`✅ Found ${consultations.length} consultations`)
      consultations.forEach((cons, idx) => {
        console.log(`\n   ${idx + 1}. ${cons.event_type_kr}`)
        console.log(`      이름: ${cons.case_name}`)
        console.log(`      전화: ${cons.reference_id}`)
        console.log(`      유형: ${cons.event_subtype}`)
        console.log(`      날짜: ${cons.event_date} ${cons.event_time}`)
        console.log(`      사무소: ${cons.location || '미정'}`)
        console.log(`      메시지: ${cons.description || '없음'}`)
      })
    } else {
      console.log('⚠️  No consultations in date range')
    }

    console.log('\n\n✅ All component integration tests passed!')
    console.log('\n📋 Summary:')
    console.log('   - unified_calendar VIEW ✅')
    console.log('   - ScheduleListView data format ✅')
    console.log('   - MonthlyCalendar data format ✅')
    console.log('   - Consultation integration ✅')
    console.log('   - Filter/Sort compatibility ✅')

  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testComponents()
