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

async function checkDataCount() {
  console.log('📊 Checking data counts...\n')

  try {
    // Check clients
    const { count: clientsCount, error: clientsError } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })

    if (clientsError) {
      console.error('❌ Error counting clients:', clientsError.message)
    } else {
      console.log(`👥 Clients: ${clientsCount || 0}`)
    }

    // Check legal_cases
    const { data: casesData, count: casesCount, error: casesError } = await supabase
      .from('legal_cases')
      .select('*', { count: 'exact' })
      .limit(3)

    if (casesError) {
      console.error('❌ Error counting legal_cases:', casesError.message)
    } else {
      console.log(`📁 Legal Cases: ${casesCount || 0}`)
      if (casesData && casesData.length > 0) {
        console.log(`   Columns: ${Object.keys(casesData[0]).join(', ')}`)
        console.log('   Sample cases:')
        casesData.forEach((c, i) => {
          console.log(`     ${i+1}. ${c.case_name} (Status: ${c.status})`)
        })
      }
    }

    // Check case_parties
    const { count: partiesCount, error: partiesError } = await supabase
      .from('case_parties')
      .select('*', { count: 'exact', head: true })

    if (partiesError) {
      console.error('❌ Error counting case_parties:', partiesError.message)
    } else {
      console.log(`👔 Case Parties: ${partiesCount || 0}`)
    }

    // Check court_hearings
    const { count: hearingsCount, error: hearingsError } = await supabase
      .from('court_hearings')
      .select('*', { count: 'exact', head: true })

    if (hearingsError) {
      console.error('❌ Error counting court_hearings:', hearingsError.message)
    } else {
      console.log(`⚖️  Court Hearings: ${hearingsCount || 0}`)
    }

    // Check payments
    const { count: paymentsCount, error: paymentsError } = await supabase
      .from('payments')
      .select('*', { count: 'exact', head: true })

    if (paymentsError) {
      console.error('❌ Error counting payments:', paymentsError.message)
    } else {
      console.log(`💰 Payments: ${paymentsCount || 0}`)
    }

    console.log('\n✅ Data count check completed!')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  }
}

checkDataCount()
