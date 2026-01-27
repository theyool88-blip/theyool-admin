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

async function checkCalendarData() {
  console.log('📅 Checking calendar data...\n')

  try {
    // Check unified_calendar view
    const { data: calendarData, error: calendarError } = await supabase
      .from('unified_calendar')
      .select('*')
      .limit(10)

    if (calendarError) {
      console.error('❌ Error querying unified_calendar:', calendarError.message)
    } else {
      console.log(`📊 Unified Calendar: ${calendarData?.length || 0} events (showing first 10)`)
      if (calendarData && calendarData.length > 0) {
        console.log('\nSample events:')
        calendarData.forEach((event, i) => {
          console.log(`  ${i + 1}. ${event.event_type}: ${event.title} (${event.event_date})`)
        })
      }
    }

    // Check court hearings
    const { count: hearingsCount, error: hearingsError } = await supabase
      .from('court_hearings')
      .select('*', { count: 'exact', head: true })

    if (hearingsError) {
      console.error('\n❌ Error counting court_hearings:', hearingsError.message)
    } else {
      console.log(`\n⚖️  Court Hearings: ${hearingsCount || 0}`)
    }

    // Check case_deadlines
    const { count: deadlinesCount, error: deadlinesError } = await supabase
      .from('case_deadlines')
      .select('*', { count: 'exact', head: true })

    if (deadlinesError) {
      console.error('❌ Error counting case_deadlines:', deadlinesError.message)
    } else {
      console.log(`⏰ Case Deadlines: ${deadlinesCount || 0}`)
    }

    // Check consultations
    const { count: consultationsCount, error: consultationsError } = await supabase
      .from('consultations')
      .select('*', { count: 'exact', head: true })

    if (consultationsError) {
      console.error('❌ Error counting consultations:', consultationsError.message)
    } else {
      console.log(`💬 Consultations: ${consultationsCount || 0}`)
    }

    console.log('\n✅ Calendar data check completed!')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  }
}

checkCalendarData()
