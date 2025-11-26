require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testPaymentsSystem() {
  try {
    console.log('🧪 입금 관리 시스템 테스트\n')
    console.log('=' .repeat(60))

    // 1. 전체 입금 내역 개수
    console.log('\n📊 1. 전체 입금 내역 통계')
    console.log('-'.repeat(60))

    const { data: allPayments, count: totalCount } = await supabase
      .from('payments')
      .select('*', { count: 'exact' })

    console.log(`✅ 총 입금 내역: ${totalCount}개`)

    if (allPayments && allPayments.length > 0) {
      const totalAmount = allPayments.reduce((sum, p) => sum + p.amount, 0)
      console.log(`💰 총 입금액: ₩${totalAmount.toLocaleString('ko-KR')}`)

      // 사무실별 집계
      const byOffice = allPayments.reduce((acc, p) => {
        const office = p.office_location || '미지정'
        acc[office] = (acc[office] || 0) + p.amount
        return acc
      }, {})

      console.log('\n📍 사무실별 입금액:')
      Object.entries(byOffice).forEach(([office, amount]) => {
        console.log(`   ${office}: ₩${amount.toLocaleString('ko-KR')}`)
      })

      // 명목별 집계
      const byCategory = allPayments.reduce((acc, p) => {
        acc[p.payment_category] = (acc[p.payment_category] || 0) + p.amount
        return acc
      }, {})

      console.log('\n💳 명목별 입금액:')
      Object.entries(byCategory)
        .sort((a, b) => b[1] - a[1])
        .forEach(([category, amount]) => {
          console.log(`   ${category}: ₩${amount.toLocaleString('ko-KR')}`)
        })
    }

    // 2. 통계 뷰 테스트 - 사무실별
    console.log('\n\n📊 2. 사무실별 통계 뷰 (payment_stats_by_office)')
    console.log('-'.repeat(60))

    const { data: officeStats } = await supabase
      .from('payment_stats_by_office')
      .select('*')
      .limit(10)

    if (officeStats && officeStats.length > 0) {
      console.log(`✅ 조회 성공: ${officeStats.length}개 행`)
      officeStats.slice(0, 5).forEach(stat => {
        console.log(`   ${stat.office_location} - ${stat.payment_category}: ${stat.payment_count}건, ₩${parseInt(stat.total_amount).toLocaleString('ko-KR')}`)
      })
    } else {
      console.log('⚠️  데이터 없음')
    }

    // 3. 통계 뷰 테스트 - 명목별
    console.log('\n\n📊 3. 명목별 통계 뷰 (payment_stats_by_category)')
    console.log('-'.repeat(60))

    const { data: categoryStats } = await supabase
      .from('payment_stats_by_category')
      .select('*')

    if (categoryStats && categoryStats.length > 0) {
      console.log(`✅ 조회 성공: ${categoryStats.length}개 카테고리`)
      categoryStats.forEach(stat => {
        console.log(`   ${stat.payment_category}:`)
        console.log(`      총액: ₩${parseInt(stat.total_amount).toLocaleString('ko-KR')} (${stat.payment_count}건)`)
        console.log(`      평택: ₩${parseInt(stat.pyeongtaek_total).toLocaleString('ko-KR')} (${stat.pyeongtaek_count}건)`)
        console.log(`      천안: ₩${parseInt(stat.cheonan_total).toLocaleString('ko-KR')} (${stat.cheonan_count}건)`)
      })
    } else {
      console.log('⚠️  데이터 없음')
    }

    // 4. 월별 통계
    console.log('\n\n📊 4. 월별 통계 뷰 (payment_stats_by_month)')
    console.log('-'.repeat(60))

    const { data: monthStats } = await supabase
      .from('payment_stats_by_month')
      .select('*')
      .limit(12)

    if (monthStats && monthStats.length > 0) {
      console.log(`✅ 조회 성공: 최근 ${monthStats.length}개 월`)

      // 월별로 그룹화
      const byMonth = monthStats.reduce((acc, stat) => {
        if (!acc[stat.month]) {
          acc[stat.month] = { total: 0, count: 0 }
        }
        acc[stat.month].total += parseInt(stat.total_amount)
        acc[stat.month].count += stat.payment_count
        return acc
      }, {})

      Object.entries(byMonth)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 6)
        .forEach(([month, data]) => {
          console.log(`   ${month}: ₩${data.total.toLocaleString('ko-KR')} (${data.count}건)`)
        })
    } else {
      console.log('⚠️  데이터 없음')
    }

    // 5. 사건별 입금 합계
    console.log('\n\n📊 5. 사건별 입금 합계 뷰 (case_payment_summary)')
    console.log('-'.repeat(60))

    const { data: caseSummary } = await supabase
      .from('case_payment_summary')
      .select('*')
      .gt('payment_count', 0)
      .order('total_amount', { ascending: false })
      .limit(10)

    if (caseSummary && caseSummary.length > 0) {
      console.log(`✅ 조회 성공: ${caseSummary.length}개 사건 (입금 있는 사건만)`)
      caseSummary.slice(0, 5).forEach(summary => {
        console.log(`   ${summary.court_case_number || summary.case_name}:`)
        console.log(`      총 입금: ₩${parseInt(summary.total_amount).toLocaleString('ko-KR')} (${summary.payment_count}건)`)
        if (summary.retainer_amount > 0) {
          console.log(`      착수금: ₩${parseInt(summary.retainer_amount).toLocaleString('ko-KR')}`)
        }
        if (summary.success_fee_amount > 0) {
          console.log(`      성공보수: ₩${parseInt(summary.success_fee_amount).toLocaleString('ko-KR')}`)
        }
      })
    } else {
      console.log('⚠️  데이터 없음 (아직 사건과 연결되지 않음)')
    }

    // 6. 상담별 입금 합계
    console.log('\n\n📊 6. 상담별 입금 합계 뷰 (consultation_payment_summary)')
    console.log('-'.repeat(60))

    const { data: consultationSummary } = await supabase
      .from('consultation_payment_summary')
      .select('*')
      .gt('payment_count', 0)
      .order('total_amount', { ascending: false })
      .limit(10)

    if (consultationSummary && consultationSummary.length > 0) {
      console.log(`✅ 조회 성공: ${consultationSummary.length}개 상담 (입금 있는 상담만)`)
      consultationSummary.slice(0, 5).forEach(summary => {
        console.log(`   ${summary.name} (${summary.phone}):`)
        console.log(`      총 입금: ₩${parseInt(summary.total_amount).toLocaleString('ko-KR')} (${summary.payment_count}건)`)
      })
    } else {
      console.log('⚠️  데이터 없음 (아직 상담과 연결되지 않음)')
    }

    // 7. 최근 입금 내역
    console.log('\n\n📊 7. 최근 입금 내역 (최신 10건)')
    console.log('-'.repeat(60))

    const { data: recentPayments } = await supabase
      .from('payments')
      .select('*')
      .order('payment_date', { ascending: false })
      .limit(10)

    if (recentPayments && recentPayments.length > 0) {
      console.log(`✅ 조회 성공: ${recentPayments.length}건`)
      recentPayments.forEach((p, i) => {
        console.log(`   [${i + 1}] ${p.payment_date} - ${p.depositor_name}`)
        console.log(`       금액: ₩${p.amount.toLocaleString('ko-KR')} (${p.payment_category})`)
        console.log(`       사무실: ${p.office_location || '미지정'}`)
      })
    }

    console.log('\n' + '='.repeat(60))
    console.log('✅ 모든 테스트 완료!\n')

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

testPaymentsSystem()
