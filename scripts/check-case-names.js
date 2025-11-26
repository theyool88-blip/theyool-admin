require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkCaseNames() {
  const { data: payments, error } = await supabase
    .from('payments')
    .select('id, case_name')
    .not('case_name', 'is', null)
    .limit(10)

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('\n📋 Sample case names:')
  payments.forEach((p, i) => {
    console.log(`${i + 1}. "${p.case_name}"`)
    console.log(`   Has "(" : ${p.case_name.includes('(')}`)
    console.log(`   Matches empty parens: ${/\s*\(\s*\)/.test(p.case_name)}`)
  })
}

checkCaseNames()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
