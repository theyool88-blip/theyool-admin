require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function compareAmounts() {
  console.log('Comparing legal_cases vs payments amounts...\n')
  
  const { data: paymentSummary } = await supabase
    .from('case_payment_summary')
    .select('*')
    .gt('payment_count', 0)
  
  const { data: cases } = await supabase
    .from('legal_cases')
    .select('id, case_name, total_received, retainer_fee')
  
  const caseMap = new Map(cases.map(c => [c.id, c]))
  
  const differences = []
  
  paymentSummary.forEach(ps => {
    const legalCase = caseMap.get(ps.case_id)
    if (!legalCase) return
    
    const paymentsTotal = parseInt(ps.total_amount)
    const caseTotal = legalCase.total_received || 0
    
    const diff = paymentsTotal - caseTotal
    
    if (diff !== 0) {
      differences.push({
        name: ps.case_name || ps.court_case_number,
        paymentsTotal,
        caseTotal,
        diff,
        diffPercent: caseTotal > 0 ? Math.round((diff / caseTotal) * 100) : 0
      })
    }
  })
  
  differences.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
  
  console.log('Cases with matching amounts: ' + (paymentSummary.length - differences.length))
  console.log('Cases with differences: ' + differences.length + '\n')
  
  if (differences.length > 0) {
    console.log('Top 20 differences:\n')
    differences.slice(0, 20).forEach((d, i) => {
      const won = (amt) => '₩' + amt.toLocaleString('ko-KR')
      console.log((i+1) + '. ' + d.name)
      console.log('   Payments table: ' + won(d.paymentsTotal))
      console.log('   Legal_cases:    ' + won(d.caseTotal))
      console.log('   Difference:     ' + won(d.diff) + ' (' + (d.diff > 0 ? '+' : '') + d.diffPercent + '%)')
      console.log('')
    })
  }
  
  console.log('Done!\n')
}

compareAmounts()
