import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function checkSchemaDetail() {
  console.log('=== Detailed Schema Check ===\n')

  // 1. Check specific columns in case_parties
  console.log('1. case_parties 특정 컬럼 확인:')
  try {
    const { data, error } = await supabase
      .from('case_parties')
      .select('is_our_client, client_id')
      .limit(1)
    if (error) {
      console.log('   ❌ is_our_client, client_id 컬럼 없음:', error.message)
    } else {
      console.log('   ✅ is_our_client, client_id 컬럼 존재')
    }
  } catch (e) {
    console.log('   ❌ Error:', e)
  }

  // 2. Check court_hearings scourt_result_raw vs result
  console.log('\n2. court_hearings 결과 컬럼 확인:')
  try {
    const { data: d1, error: e1 } = await supabase
      .from('court_hearings')
      .select('scourt_result_raw')
      .limit(1)
    if (e1) {
      console.log('   ❌ scourt_result_raw 컬럼 없음')
    } else {
      console.log('   ✅ scourt_result_raw 컬럼 존재')
    }
  } catch (e) {}

  try {
    const { data: d2, error: e2 } = await supabase
      .from('court_hearings')
      .select('result')
      .limit(1)
    if (e2) {
      console.log('   ❌ result 컬럼 없음')
    } else {
      console.log('   ✅ result 컬럼 존재')
    }
  } catch (e) {}

  try {
    const { data: d3, error: e3 } = await supabase
      .from('court_hearings')
      .select('hearing_sequence')
      .limit(1)
    if (e3) {
      console.log('   ❌ hearing_sequence 컬럼 없음')
    } else {
      console.log('   ✅ hearing_sequence 컬럼 존재')
    }
  } catch (e) {}

  // 3. Check case_deadlines columns
  console.log('\n3. case_deadlines 컬럼 확인:')
  try {
    const { data, error } = await supabase
      .from('case_deadlines')
      .select('custom_deadline_name, party_side')
      .limit(1)
    if (error) {
      console.log('   Error:', error.message)
      // Try to get any data to see columns
      const { data: d2, error: e2 } = await supabase
        .from('case_deadlines')
        .select('*')
        .limit(0)
      if (e2) {
        console.log('   테이블 접근 불가:', e2.message)
      }
    } else {
      console.log('   ✅ custom_deadline_name, party_side 컬럼 존재')
    }
  } catch (e) {}

  // 4. Check consultations assigned_to
  console.log('\n4. consultations assigned_to 컬럼 확인:')
  try {
    const { data, error } = await supabase
      .from('consultations')
      .select('assigned_to')
      .limit(1)
    if (error) {
      console.log('   ❌ assigned_to 컬럼 없음:', error.message)
    } else {
      console.log('   ✅ assigned_to 컬럼 존재')
    }
  } catch (e) {}

  // 5. Check general_schedules structure
  console.log('\n5. general_schedules 구조 확인:')
  try {
    const { data, error } = await supabase
      .from('general_schedules')
      .select('schedule_type, schedule_date, schedule_time')
      .limit(1)
    if (error) {
      console.log('   ❌ 에러:', error.message)
    } else {
      console.log('   ✅ 컬럼 존재')
    }
  } catch (e) {}

  // 6. Get actual unified_calendar view definition
  console.log('\n6. 현재 unified_calendar 샘플 데이터:')
  try {
    const { data, error } = await supabase
      .from('unified_calendar')
      .select('*')
      .limit(3)
    if (error) {
      console.log('   Error:', error.message)
    } else if (data && data.length > 0) {
      console.log('   Sample event types:', [...new Set(data.map(d => d.event_type))].join(', '))
      console.log('   Columns:', Object.keys(data[0]).join(', '))
    }
  } catch (e) {}

  console.log('\n=== Check Complete ===')
}

checkSchemaDetail().catch(console.error)
