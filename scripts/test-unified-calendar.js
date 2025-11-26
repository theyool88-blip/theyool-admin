require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'OK' : 'MISSING')
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'OK' : 'MISSING')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testUnifiedCalendar() {
  console.log('🧪 Testing unified_calendar VIEW...\n')

  try {
    // Test 1: Check if VIEW exists and returns data
    console.log('1️⃣ Testing VIEW query...')
    const { data, error } = await supabase
      .from('unified_calendar')
      .select('*')
      .gte('event_date', new Date().toISOString().split('T')[0])
      .order('event_date', { ascending: true })
      .limit(10)

    if (error) {
      console.error('❌ Error:', error)
      return
    }

    console.log(`✅ Found ${data.length} upcoming events\n`)

    // Test 2: Check for different event types
    const types = {
      COURT_HEARING: 0,
      DEADLINE: 0,
      CONSULTATION: 0
    }

    data.forEach(event => {
      types[event.event_type] = (types[event.event_type] || 0) + 1
    })

    console.log('2️⃣ Event type distribution:')
    console.log(`   법원기일 (COURT_HEARING): ${types.COURT_HEARING}`)
    console.log(`   데드라인 (DEADLINE): ${types.DEADLINE}`)
    console.log(`   상담 (CONSULTATION): ${types.CONSULTATION}\n`)

    // Test 3: Display sample events
    console.log('3️⃣ Sample events:')
    data.slice(0, 5).forEach((event, idx) => {
      console.log(`\n   ${idx + 1}. ${event.event_type_kr} - ${event.title}`)
      console.log(`      날짜: ${event.event_date}`)
      console.log(`      시간: ${event.event_time || '시간 없음'}`)
      console.log(`      참조: ${event.reference_id}`)
      console.log(`      장소: ${event.location || '장소 없음'}`)
      console.log(`      상태: ${event.status}`)
    })

    // Test 4: Check consultations specifically
    console.log('\n\n4️⃣ Checking consultations in VIEW...')
    const { data: consultations, error: consError } = await supabase
      .from('unified_calendar')
      .select('*')
      .eq('event_type', 'CONSULTATION')
      .limit(5)

    if (consError) {
      console.error('❌ Error fetching consultations:', consError)
      return
    }

    console.log(`✅ Found ${consultations.length} consultations in VIEW\n`)

    consultations.forEach((cons, idx) => {
      console.log(`   ${idx + 1}. ${cons.event_type_kr} - ${cons.title}`)
      console.log(`      날짜: ${cons.event_date || '날짜 없음'}`)
      console.log(`      전화: ${cons.reference_id}`)
      console.log(`      사무소: ${cons.location || '미정'}`)
    })

    console.log('\n\n✅ All tests passed!')

  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testUnifiedCalendar()
