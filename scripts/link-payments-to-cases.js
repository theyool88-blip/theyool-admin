require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase env vars. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const normalizeName = (name) => name?.trim().toLowerCase().replace(/\s+/g, ' ')

async function linkPaymentsToCases() {
  console.log('🔗 Linking payments to cases by case_name...\n')

  const { data: cases, error: caseError } = await supabase
    .from('legal_cases')
    .select('id, case_name')

  if (caseError) {
    console.error('❌ Failed to load cases:', caseError.message)
    process.exit(1)
  }

  const caseMap = new Map()
  for (const legalCase of cases || []) {
    const key = normalizeName(legalCase.case_name)
    if (!key) continue
    const arr = caseMap.get(key) || []
    arr.push(legalCase)
    caseMap.set(key, arr)
  }

  const { data: payments, error: paymentError } = await supabase
    .from('payments')
    .select('id, case_name, memo, is_confirmed')
    .is('case_id', null)
    .not('case_name', 'is', null)

  if (paymentError) {
    console.error('❌ Failed to load payments:', paymentError.message)
    process.exit(1)
  }

  let linkedCount = 0
  const updatedCaseIds = new Set()
  const unmatched = []
  const ambiguous = []

  for (const payment of payments || []) {
    const key = normalizeName(payment.case_name)
    const matches = key ? caseMap.get(key) || [] : []

    if (matches.length === 1) {
      const target = matches[0]
      const { error: updateError } = await supabase
        .from('payments')
        .update({
          case_id: target.id,
          is_confirmed: true,
        })
        .eq('id', payment.id)

      if (updateError) {
        console.error(`❌ Failed to update payment ${payment.id} (${payment.case_name}):`, updateError.message)
        continue
      }

      linkedCount += 1
      updatedCaseIds.add(target.id)
      console.log(`✅ Linked payment ${payment.id} → case ${target.id} (${payment.case_name})`)
    } else if (matches.length === 0) {
      unmatched.push(payment)
    } else {
      ambiguous.push({ payment, matches })
    }
  }

  console.log(`\nLinking complete. Linked ${linkedCount} payment(s).`)

  if (unmatched.length > 0) {
    console.log('\n⚠️  Unmatched case names:')
    for (const p of unmatched) {
      console.log(` - ${p.case_name} (${p.id})`)
      const memoNote = p.memo ? `${p.memo} / 기존 사건명: ${p.case_name}` : `기존 사건명: ${p.case_name}`
      const { error: clearError } = await supabase
        .from('payments')
        .update({
          case_name: null,
          memo: memoNote,
          is_confirmed: false,
        })
        .eq('id', p.id)

      if (clearError) {
        console.error(`   ❌ Failed to clear case_name for ${p.id}:`, clearError.message)
      } else {
        console.log(`   ➜ Cleared case_name and memo updated`)
      }
    }
  }

  if (ambiguous.length > 0) {
    console.log('\n⚠️  Ambiguous matches (multiple cases found):')
    ambiguous.forEach(({ payment, matches }) =>
      console.log(` - ${payment.case_name} (${payment.id}) → ${matches.map((m) => m.id).join(', ')}`)
    )
  }

  if (updatedCaseIds.size === 0) {
    console.log('\nNo cases to update totals for.')
    return
  }

  console.log(`\nUpdating legal_cases.total_received for ${updatedCaseIds.size} case(s)...`)
  const { data: summaries, error: summaryError } = await supabase
    .from('case_payment_summary')
    .select('case_id, total_amount')
    .in('case_id', Array.from(updatedCaseIds))

  if (summaryError) {
    console.error('❌ Failed to load payment summaries:', summaryError.message)
    return
  }

  for (const summary of summaries || []) {
    const totalAmount = Number(summary.total_amount) || 0
    const { error: updateCaseError } = await supabase
      .from('legal_cases')
      .update({ total_received: totalAmount })
      .eq('id', summary.case_id)

    if (updateCaseError) {
      console.error(`❌ Failed to update totals for case ${summary.case_id}:`, updateCaseError.message)
    } else {
      console.log(`   • ${summary.case_id}: total_received → ${totalAmount.toLocaleString('ko-KR')}`)
    }
  }

  console.log('\n✅ Done!')
}

linkPaymentsToCases().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
