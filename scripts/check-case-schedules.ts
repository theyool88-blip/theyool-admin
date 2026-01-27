import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function checkCaseSchedules() {
  console.log('📋 Checking case schedules...\n')

  try {
    // Check legal_cases
    const { data: cases, error: casesError } = await supabase
      .from('legal_cases')
      .select('id, case_number, case_name, created_at')
      .order('created_at', { ascending: false })

    if (casesError) {
      console.error('❌ Error querying legal_cases:', casesError.message)
    } else {
      console.log(`📁 Legal Cases: ${cases?.length || 0}`)
      if (cases && cases.length > 0) {
        console.log('\nCases:')
        cases.forEach((c, i) => {
          console.log(`  ${i + 1}. [${c.case_number}] ${c.case_name}`)
        })
      }
    }

    // Check court_hearings
    const { data: hearings, error: hearingsError } = await supabase
      .from('court_hearings')
      .select('*')
      .limit(10)

    if (hearingsError) {
      console.error('\n❌ Error querying court_hearings:', hearingsError.message)
    } else {
      console.log(`\n⚖️  Court Hearings: ${hearings?.length || 0}`)
      if (hearings && hearings.length > 0) {
        console.log('\nHearings:')
        hearings.forEach((h, i) => {
          console.log(`  ${i + 1}. ${h.case_number} - ${h.hearing_date} ${h.hearing_time || ''}`)
        })
      }
    }

    // Check case_deadlines
    const { data: deadlines, error: deadlinesError } = await supabase
      .from('case_deadlines')
      .select('*')
      .limit(10)

    if (deadlinesError) {
      console.error('❌ Error querying case_deadlines:', deadlinesError.message)
    } else {
      console.log(`\n⏰ Case Deadlines: ${deadlines?.length || 0}`)
      if (deadlines && deadlines.length > 0) {
        console.log('\nDeadlines:')
        deadlines.forEach((d, i) => {
          console.log(`  ${i + 1}. ${d.case_number} - ${d.deadline_type} (${d.trigger_date})`)
        })
      }
    }

    // Check unified_calendar view
    const { data: calendar, error: calendarError } = await supabase
      .from('unified_calendar')
      .select('event_type, title, event_date, event_time')
      .limit(10)

    if (calendarError) {
      console.error('\n❌ Error querying unified_calendar:', calendarError.message)
    } else {
      console.log(`\n📅 Unified Calendar: ${calendar?.length || 0}`)
      if (calendar && calendar.length > 0) {
        console.log('\nCalendar Events:')
        calendar.forEach((e, i) => {
          console.log(`  ${i + 1}. ${e.event_type}: ${e.title} (${e.event_date} ${e.event_time || ''})`)
        })
      }
    }

    console.log('\n✅ Check completed!')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  }
}

checkCaseSchedules()
