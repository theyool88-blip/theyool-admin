import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
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

async function deleteAllData() {
  console.log('🗑️  Starting data deletion process...\n')

  try {
    // 1. Delete case-related data (외래 키가 있는 테이블부터)
    console.log('1️⃣  Deleting case_parties...')
    const { error: partiesError, count: partiesCount } = await supabase
      .from('case_parties')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (partiesError) {
      console.error('❌ Error deleting case_parties:', partiesError.message)
    } else {
      console.log(`✅ Deleted ${partiesCount || 0} case parties\n`)
    }

    // 2. Delete court hearings
    console.log('2️⃣  Deleting court_hearings...')
    const { error: hearingsError, count: hearingsCount } = await supabase
      .from('court_hearings')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (hearingsError) {
      console.error('❌ Error deleting court_hearings:', hearingsError.message)
    } else {
      console.log(`✅ Deleted ${hearingsCount || 0} court hearings\n`)
    }

    // 3. Delete legal deadlines
    console.log('3️⃣  Deleting legal_deadlines...')
    const { error: deadlinesError, count: deadlinesCount } = await supabase
      .from('legal_deadlines')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (deadlinesError) {
      console.error('❌ Error deleting legal_deadlines:', deadlinesError.message)
    } else {
      console.log(`✅ Deleted ${deadlinesCount || 0} legal deadlines\n`)
    }

    // 4. Delete payments
    console.log('4️⃣  Deleting payments...')
    const { error: paymentsError, count: paymentsCount } = await supabase
      .from('payments')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (paymentsError) {
      console.error('❌ Error deleting payments:', paymentsError.message)
    } else {
      console.log(`✅ Deleted ${paymentsCount || 0} payments\n`)
    }

    // 5. Delete receivables
    console.log('5️⃣  Deleting receivables...')
    const { error: receivablesError, count: receivablesCount } = await supabase
      .from('receivables')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (receivablesError) {
      console.error('❌ Error deleting receivables:', receivablesError.message)
    } else {
      console.log(`✅ Deleted ${receivablesCount || 0} receivables\n`)
    }

    // 6. Delete consultation activities
    console.log('6️⃣  Deleting consultation_activities...')
    const { error: activitiesError, count: activitiesCount } = await supabase
      .from('consultation_activities')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (activitiesError) {
      console.error('❌ Error deleting consultation_activities:', activitiesError.message)
    } else {
      console.log(`✅ Deleted ${activitiesCount || 0} consultation activities\n`)
    }

    // 7. Delete case assignees
    console.log('7️⃣  Deleting case_assignees...')
    const { error: assigneesError, count: assigneesCount } = await supabase
      .from('case_assignees')
      .delete()
      .neq('case_id', '00000000-0000-0000-0000-000000000000')

    if (assigneesError) {
      console.error('❌ Error deleting case_assignees:', assigneesError.message)
    } else {
      console.log(`✅ Deleted ${assigneesCount || 0} case assignees\n`)
    }

    // 8. Delete legal cases
    console.log('8️⃣  Deleting legal_cases...')
    const { error: casesError, count: casesCount } = await supabase
      .from('legal_cases')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (casesError) {
      console.error('❌ Error deleting legal_cases:', casesError.message)
    } else {
      console.log(`✅ Deleted ${casesCount || 0} legal cases\n`)
    }

    // 9. Delete clients
    console.log('9️⃣  Deleting clients...')
    const { error: clientsError, count: clientsCount } = await supabase
      .from('clients')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (clientsError) {
      console.error('❌ Error deleting clients:', clientsError.message)
    } else {
      console.log(`✅ Deleted ${clientsCount || 0} clients\n`)
    }

    console.log('✨ Data deletion completed!')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  }
}

deleteAllData()
