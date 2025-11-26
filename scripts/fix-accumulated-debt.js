const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim()
      process.env[key] = value
    }
  })
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase 환경 변수가 설정되지 않았습니다.')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function fixAccumulatedDebt() {
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║   누적 채무 수정 - 2025-10 기준점 설정                    ║')
  console.log('╚═══════════════════════════════════════════════════════════╝\n')

  try {
    // 1. 모든 정산 데이터를 날짜순으로 가져오기
    const { data: settlements, error: fetchError } = await supabase
      .from('monthly_settlements')
      .select('*')
      .order('settlement_month', { ascending: true })

    if (fetchError) {
      console.error('❌ 정산 데이터 조회 실패:', fetchError.message)
      return
    }

    console.log(`📊 총 ${settlements.length}개의 정산 데이터를 찾았습니다.\n`)

    // 2. 2025-10을 찾아서 김현성 누적을 83,082,859로 설정
    const targetMonth = '2025-10'
    const targetSettlement = settlements.find(s => s.settlement_month === targetMonth)

    if (!targetSettlement) {
      console.error(`❌ ${targetMonth} 정산 데이터를 찾을 수 없습니다.`)
      return
    }

    console.log(`🎯 ${targetMonth} 정산 데이터 발견:`)
    console.log(`   현재 김변 누적: ${targetSettlement.kim_accumulated_debt?.toLocaleString() || 0}원`)
    console.log(`   현재 임변 누적: ${targetSettlement.lim_accumulated_debt?.toLocaleString() || 0}원\n`)

    // 3. 김현성 누적을 83,082,859로 설정
    const targetKimAccumulated = 83082859

    // 임은지는 0으로 설정 (상대적으로 김현성만 채권이 있다고 했으므로)
    const targetLimAccumulated = 0

    const { error: updateError } = await supabase
      .from('monthly_settlements')
      .update({
        kim_accumulated_debt: targetKimAccumulated,
        lim_accumulated_debt: targetLimAccumulated
      })
      .eq('settlement_month', targetMonth)

    if (updateError) {
      console.error(`❌ ${targetMonth} 업데이트 실패:`, updateError.message)
      return
    }

    console.log(`✅ ${targetMonth} 누적 채무 업데이트 완료:`)
    console.log(`   김현성: ${targetKimAccumulated.toLocaleString()}원`)
    console.log(`   임은지: ${targetLimAccumulated.toLocaleString()}원\n`)

    // 4. 2025-11 이후 데이터가 있다면 재계산
    const futureSettlements = settlements.filter(s => s.settlement_month > targetMonth)

    if (futureSettlements.length > 0) {
      console.log(`📅 ${targetMonth} 이후 ${futureSettlements.length}개 월 재계산 시작...\n`)

      let kimAccumulated = targetKimAccumulated
      let limAccumulated = targetLimAccumulated

      for (const settlement of futureSettlements) {
        // 해당 월의 순수익과 인출액으로 당월 변동 계산
        const netProfit = settlement.total_revenue - settlement.total_expenses
        const kimShare = Math.floor(netProfit / 2)
        const limShare = Math.floor(netProfit / 2)

        const kimNetBalance = kimShare - settlement.kim_withdrawals
        const limNetBalance = limShare - settlement.lim_withdrawals

        // 누적에 반영
        kimAccumulated += kimNetBalance
        limAccumulated += limNetBalance

        const { error: futureUpdateError } = await supabase
          .from('monthly_settlements')
          .update({
            kim_accumulated_debt: kimAccumulated,
            lim_accumulated_debt: limAccumulated
          })
          .eq('id', settlement.id)

        if (futureUpdateError) {
          console.error(`❌ ${settlement.settlement_month} 업데이트 실패:`, futureUpdateError.message)
        } else {
          console.log(`✅ ${settlement.settlement_month}: 김변=${kimAccumulated.toLocaleString()}원, 임변=${limAccumulated.toLocaleString()}원`)
        }
      }
    } else {
      console.log('ℹ️  2025-10 이후 데이터가 없습니다.\n')
    }

    // 5. 최종 확인
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ 누적 채무 수정 완료!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    // 최종 상태 조회
    const { data: finalData, error: finalError } = await supabase
      .from('monthly_settlements')
      .select('settlement_month, kim_accumulated_debt, lim_accumulated_debt')
      .gte('settlement_month', targetMonth)
      .order('settlement_month', { ascending: false })

    if (finalError) {
      console.error('❌ 최종 상태 조회 실패:', finalError.message)
    } else {
      console.log('📊 최종 누적 현황 (최근순):')
      finalData.forEach(row => {
        console.log(`   ${row.settlement_month}: 김변=${row.kim_accumulated_debt?.toLocaleString() || 0}원, 임변=${row.lim_accumulated_debt?.toLocaleString() || 0}원`)
      })
    }

  } catch (error) {
    console.error('\n❌ 오류 발생:', error.message)
    process.exit(1)
  }
}

fixAccumulatedDebt()
