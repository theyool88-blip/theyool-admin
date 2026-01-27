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

async function checkSchema() {
  console.log('=== Checking Database Schema ===\n')

  // 1. Check case_parties columns
  console.log('1. case_parties 테이블 컬럼:')
  const { data: casePartiesCols, error: error1 } = await supabase.rpc('exec_sql', {
    sql_text: `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'case_parties' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `
  })

  if (error1) {
    // Try alternative approach
    const { data, error } = await supabase
      .from('case_parties')
      .select('*')
      .limit(1)

    if (error) {
      console.log('  Error:', error.message)
    } else {
      console.log('  Available columns:', data && data[0] ? Object.keys(data[0]).join(', ') : 'No data')
    }
  } else {
    console.log(casePartiesCols)
  }

  // 2. Check legal_cases columns
  console.log('\n2. legal_cases 테이블 컬럼:')
  const { data: legalCasesSample, error: error2 } = await supabase
    .from('legal_cases')
    .select('*')
    .limit(1)

  if (error2) {
    console.log('  Error:', error2.message)
  } else {
    console.log('  Available columns:', legalCasesSample && legalCasesSample[0] ? Object.keys(legalCasesSample[0]).join(', ') : 'No data')
  }

  // 3. Check if unified_calendar view exists and its columns
  console.log('\n3. unified_calendar 뷰 컬럼:')
  const { data: calendarSample, error: error3 } = await supabase
    .from('unified_calendar')
    .select('*')
    .limit(1)

  if (error3) {
    console.log('  Error:', error3.message)
  } else {
    console.log('  Available columns:', calendarSample && calendarSample[0] ? Object.keys(calendarSample[0]).join(', ') : 'No data')
  }

  // 4. Check general_schedules table exists
  console.log('\n4. general_schedules 테이블:')
  const { data: genSchedules, error: error4 } = await supabase
    .from('general_schedules')
    .select('*')
    .limit(1)

  if (error4) {
    console.log('  Error:', error4.message)
    console.log('  => general_schedules 테이블이 없을 수 있음!')
  } else {
    console.log('  Available columns:', genSchedules && genSchedules[0] ? Object.keys(genSchedules[0]).join(', ') : 'Table exists but no data')
  }

  // 5. Check court_hearings columns
  console.log('\n5. court_hearings 테이블 컬럼:')
  const { data: hearingsSample, error: error5 } = await supabase
    .from('court_hearings')
    .select('*')
    .limit(1)

  if (error5) {
    console.log('  Error:', error5.message)
  } else {
    console.log('  Available columns:', hearingsSample && hearingsSample[0] ? Object.keys(hearingsSample[0]).join(', ') : 'No data')
  }

  // 6. Check case_deadlines columns
  console.log('\n6. case_deadlines 테이블 컬럼:')
  const { data: deadlinesSample, error: error6 } = await supabase
    .from('case_deadlines')
    .select('*')
    .limit(1)

  if (error6) {
    console.log('  Error:', error6.message)
  } else {
    console.log('  Available columns:', deadlinesSample && deadlinesSample[0] ? Object.keys(deadlinesSample[0]).join(', ') : 'No data')
  }

  // 7. Check consultations columns (specifically assigned_to)
  console.log('\n7. consultations 테이블 컬럼:')
  const { data: consultSample, error: error7 } = await supabase
    .from('consultations')
    .select('*')
    .limit(1)

  if (error7) {
    console.log('  Error:', error7.message)
  } else {
    console.log('  Available columns:', consultSample && consultSample[0] ? Object.keys(consultSample[0]).join(', ') : 'No data')
  }

  console.log('\n=== Schema Check Complete ===')
}

checkSchema().catch(console.error)
