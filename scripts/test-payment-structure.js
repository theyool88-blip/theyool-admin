/**
 * Payment 구조 테스트 스크립트
 * - client_id 자동 설정 확인
 * - 환불 (음수 금액) 처리 확인
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  console.log('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testPaymentStructure() {
  console.log('🧪 Payment 구조 테스트 시작\n')

  // 1. payments 테이블에 client_id 컬럼 존재 확인
  console.log('1️⃣ client_id 컬럼 존재 확인...')
  const { data: payments, error: paymentError } = await supabase
    .from('payments')
    .select('id, case_id, client_id, amount, payment_category')
    .limit(5)

  if (paymentError) {
    console.error('   ❌ Error:', paymentError.message)
    if (paymentError.message.includes('client_id')) {
      console.log('   ⚠️  client_id 컬럼이 아직 추가되지 않았습니다. 마이그레이션을 실행해주세요.')
    }
  } else {
    console.log('   ✅ payments 테이블 조회 성공')
    console.log(`   📊 샘플 데이터 ${payments?.length || 0}건`)
    if (payments && payments.length > 0) {
      const withClientId = payments.filter(p => p.client_id !== null).length
      console.log(`   📊 client_id 있는 데이터: ${withClientId}/${payments.length}건`)
    }
  }

  // 2. case_id가 있는 입금에 client_id가 설정되어 있는지 확인
  console.log('\n2️⃣ case_id → client_id 연결 확인...')
  const { data: linkedPayments, error: linkedError } = await supabase
    .from('payments')
    .select(`
      id,
      case_id,
      client_id,
      payment_category,
      legal_cases!inner(id, client_id)
    `)
    .not('case_id', 'is', null)
    .limit(10)

  if (linkedError) {
    console.error('   ❌ Error:', linkedError.message)
  } else {
    console.log(`   📊 case_id가 있는 입금: ${linkedPayments?.length || 0}건`)

    let matched = 0
    let mismatched = 0
    linkedPayments?.forEach(p => {
      const caseClientId = p.legal_cases?.client_id
      if (p.client_id === caseClientId) {
        matched++
      } else if (p.client_id === null && caseClientId !== null) {
        mismatched++
      }
    })

    if (mismatched > 0) {
      console.log(`   ⚠️  client_id 미설정: ${mismatched}건 (마이그레이션 필요)`)
    } else {
      console.log(`   ✅ 모든 입금의 client_id 정상 설정됨`)
    }
  }

  // 3. 환불 카테고리 데이터 확인
  console.log('\n3️⃣ 환불 데이터 확인...')
  const { data: refunds, error: refundError } = await supabase
    .from('payments')
    .select('id, amount, payment_category, depositor_name')
    .eq('payment_category', '환불')
    .limit(5)

  if (refundError) {
    console.error('   ❌ Error:', refundError.message)
  } else {
    console.log(`   📊 환불 데이터: ${refunds?.length || 0}건`)
    if (refunds && refunds.length > 0) {
      refunds.forEach(r => {
        const isNegative = r.amount < 0
        console.log(`      - ${r.depositor_name}: ${r.amount.toLocaleString()}원 ${isNegative ? '✅' : '⚠️ 양수'}`)
      })
    } else {
      console.log('   ℹ️  환불 데이터 없음 (정상)')
    }
  }

  // 4. 음수 금액 데이터 확인
  console.log('\n4️⃣ 음수 금액 데이터 확인...')
  const { data: negativeAmounts, error: negError } = await supabase
    .from('payments')
    .select('id, amount, payment_category, depositor_name')
    .lt('amount', 0)
    .limit(5)

  if (negError) {
    console.error('   ❌ Error:', negError.message)
  } else {
    console.log(`   📊 음수 금액 데이터: ${negativeAmounts?.length || 0}건`)
    if (negativeAmounts && negativeAmounts.length > 0) {
      negativeAmounts.forEach(r => {
        console.log(`      - [${r.payment_category}] ${r.depositor_name}: ${r.amount.toLocaleString()}원`)
      })
    }
  }

  // 5. PAYMENT_CATEGORIES 확인
  console.log('\n5️⃣ 사용 중인 payment_category 목록...')
  const { data: categories, error: catError } = await supabase
    .from('payments')
    .select('payment_category')

  if (catError) {
    console.error('   ❌ Error:', catError.message)
  } else {
    const uniqueCategories = [...new Set(categories?.map(c => c.payment_category) || [])]
    console.log(`   📊 카테고리: ${uniqueCategories.join(', ')}`)

    if (uniqueCategories.includes('환불')) {
      console.log('   ✅ 환불 카테고리 사용 중')
    } else {
      console.log('   ℹ️  환불 카테고리 아직 미사용')
    }
  }

  // 6. 의뢰인별 입금 조회 테스트 (client_id 기반)
  console.log('\n6️⃣ client_id 기반 조회 테스트...')
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('id, name')
    .limit(1)
    .single()

  if (clientError || !clients) {
    console.log('   ℹ️  의뢰인 데이터 없음')
  } else {
    const { data: clientPayments, error: cpError } = await supabase
      .from('payments')
      .select('id, amount, payment_category')
      .eq('client_id', clients.id)

    if (cpError) {
      console.error('   ❌ Error:', cpError.message)
    } else {
      console.log(`   ✅ ${clients.name}님의 입금: ${clientPayments?.length || 0}건`)
    }
  }

  console.log('\n✅ 테스트 완료')
}

testPaymentStructure()
