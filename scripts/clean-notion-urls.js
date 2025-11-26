/**
 * 입금 데이터의 case_name에서 노션 URL 제거
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('Supabase URL:', supabaseUrl ? '✓' : '✗')
console.log('Service Key:', supabaseServiceKey ? '✓' : '✗')

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function cleanNotionUrls() {
  console.log('🔍 Fetching payments with case_name...')

  const { data: payments, error } = await supabase
    .from('payments')
    .select('id, case_name')
    .not('case_name', 'is', null)

  if (error) {
    console.error('❌ Error fetching payments:', error)
    return
  }

  console.log(`📊 Found ${payments.length} payments with case_name`)

  let updatedCount = 0

  for (const payment of payments) {
    // 노션 URL 패턴 또는 괄호로 끝나는 패턴 체크
    const notionUrlPattern = /https?:\/\/(www\.)?notion\.so\/[^\s]*/gi
    const hasNotionUrl = notionUrlPattern.test(payment.case_name)
    const endsWithOpenParen = /\s*\(\s*$/.test(payment.case_name) // 괄호로 끝남
    const hasEmptyParens = /\s*\(\s*\)/.test(payment.case_name) // 빈 괄호

    if (hasNotionUrl || endsWithOpenParen || hasEmptyParens) {
      // URL 제거하고 괄호도 정리
      const cleanedName = payment.case_name
        .replace(/https?:\/\/(www\.)?notion\.so\/[^\s]*/gi, '') // URL 제거
        .replace(/\s*\(\s*\)\s*/g, '') // 빈 괄호 제거
        .replace(/\s*\(\s*$/g, '') // 끝에 있는 괄호 제거
        .replace(/\s+\(/g, ' (') // 괄호 앞 공백 정리
        .trim()

      if (cleanedName !== payment.case_name) {
        console.log(`🔧 Cleaning: "${payment.case_name}" -> "${cleanedName}"`)

        const { error: updateError } = await supabase
          .from('payments')
          .update({ case_name: cleanedName || null })
          .eq('id', payment.id)

        if (updateError) {
          console.error(`❌ Error updating payment ${payment.id}:`, updateError)
        } else {
          updatedCount++
        }
      }
    }
  }

  console.log(`\n✅ Cleaned ${updatedCount} case names`)
}

cleanNotionUrls()
  .then(() => {
    console.log('✨ Done!')
    process.exit(0)
  })
  .catch((err) => {
    console.error('❌ Error:', err)
    process.exit(1)
  })
