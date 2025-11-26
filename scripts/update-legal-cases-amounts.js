require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function updateLegalCasesAmounts() {
  console.log('Updating legal_cases amounts from payments table...\n')
  
  // Get payment summary by case
  const { data: paymentSummary } = await supabase
    .from('case_payment_summary')
    .select('*')
  
  console.log('Found ' + paymentSummary.length + ' cases with payment data\n')
  
  let updated = 0
  let errors = 0
  
  for (const summary of paymentSummary) {
    const caseId = summary.case_id
    const totalAmount = parseInt(summary.total_amount)
    const retainerAmount = parseInt(summary.retainer_amount)
    
    // Update legal_cases
    const { error } = await supabase
      .from('legal_cases')
      .update({
        total_received: totalAmount,
        retainer_fee: retainerAmount
      })
      .eq('id', caseId)
    
    if (error) {
      console.error('Error updating case ' + caseId + ':', error.message)
      errors++
    } else {
      updated++
      if (updated <= 10) {
        console.log('Updated: ' + (summary.case_name || summary.court_case_number))
        console.log('  Total: ₩' + totalAmount.toLocaleString('ko-KR'))
        console.log('  Retainer: ₩' + retainerAmount.toLocaleString('ko-KR'))
        console.log('')
      }
    }
  }
  
  console.log('\n=== Update Complete ===')
  console.log('Successfully updated: ' + updated + ' cases')
  console.log('Errors: ' + errors)
  console.log('\nDone!\n')
}

updateLegalCasesAmounts()
