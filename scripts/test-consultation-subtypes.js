require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function testConsultationSubtypes() {
  console.log('🧪 Testing consultation event_subtype in unified_calendar...\n')

  const { data, error } = await supabase
    .from('unified_calendar')
    .select('id, event_type, event_subtype, title, event_date, status')
    .eq('event_type', 'CONSULTATION')
    .limit(10)

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log(`Found ${data.length} consultations:\n`)

  data.forEach((cons, idx) => {
    console.log(`${idx + 1}. ID: ${cons.id}`)
    console.log(`   Title: ${cons.title}`)
    console.log(`   Status: ${cons.status}`)
    console.log(`   Event Subtype: ${cons.event_subtype}`)
    console.log(`   Date: ${cons.event_date}`)
    console.log('')
  })

  // Check if event_subtype has the new format (pending_/confirmed_ prefix)
  const hasNewFormat = data.some(cons =>
    cons.event_subtype &&
    (cons.event_subtype.startsWith('pending_') || cons.event_subtype.startsWith('confirmed_'))
  )

  if (hasNewFormat) {
    console.log('✅ NEW MIGRATION APPLIED: event_subtype has status prefix (pending_/confirmed_)')
  } else {
    console.log('⚠️  OLD VERSION: event_subtype does not have status prefix')
    console.log('   Migration needs to be applied!')
  }
}

testConsultationSubtypes()
