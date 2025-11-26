require('dotenv').config({ path: '.env.local' })
const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// CSV 파일 경로
const CSV_PATH = '/Users/hskim/Desktop/Private & Shared 3/송무_입금내역_DB d771b931250a463ea221dc25fc14af85.csv'

/**
 * CSV 금액 파싱 ("3,245,000" → 3245000)
 */
function parseAmount(amountStr) {
  if (!amountStr) return 0
  return parseInt(amountStr.replace(/[^0-9]/g, ''), 10) || 0
}

/**
 * 날짜 파싱 (2025/11/21 → 2025-11-21)
 */
function parseDate(dateStr) {
  if (!dateStr) return null
  const parts = dateStr.split('/')
  if (parts.length === 3) {
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
  }
  return null
}

/**
 * 영수증 발행일시 파싱 (2025/11/21 5:05 PM (GMT+9) → ISO datetime)
 */
function parseReceiptIssuedAt(dateStr) {
  if (!dateStr) return null
  try {
    // "2025/11/21 5:05 PM (GMT+9)" 형식 파싱
    const match = dateStr.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})\s+(AM|PM)/)
    if (!match) return null

    const [, year, month, day, hour, minute, period] = match
    let hours = parseInt(hour, 10)
    if (period === 'PM' && hours !== 12) hours += 12
    if (period === 'AM' && hours === 12) hours = 0

    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hours
      .toString()
      .padStart(2, '0')}:${minute}:00+09:00`
  } catch (error) {
    console.error('날짜 파싱 실패:', dateStr, error)
    return null
  }
}

/**
 * CSV 행 파싱
 */
function parseCSVLine(line) {
  const fields = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  fields.push(current.trim())

  return fields
}

/**
 * CSV 파일 읽기 및 파싱
 */
async function readCSV() {
  try {
    const content = fs.readFileSync(CSV_PATH, 'utf-8')
    const lines = content.split('\n').filter((line) => line.trim())

    // 첫 줄은 헤더
    const header = parseCSVLine(lines[0])
    console.log('📋 CSV 헤더:', header)
    console.log(`📊 총 ${lines.length - 1}개 행\n`)

    const payments = []

    for (let i = 1; i < lines.length; i++) {
      const fields = parseCSVLine(lines[i])

      // CSV 컬럼: 지역, 입금일, 입금인, 입금액, 입금사건, 명목, 세금영수증발행여부, 세금계산서 발행일, 전화번호, 메모
      const [
        office_location_raw,
        payment_date_raw,
        depositor_name,
        amount_raw,
        case_name,
        payment_category,
        receipt_type,
        receipt_issued_at_raw,
        phone,
        memo,
      ] = fields

      // 필수 필드 검증
      if (!depositor_name || !amount_raw || !payment_date_raw) {
        console.log(`⚠️  행 ${i + 1} 스킵 (필수 필드 누락):`, fields)
        continue
      }

      const payment = {
        payment_date: parseDate(payment_date_raw),
        depositor_name: depositor_name.replace(/"/g, '').trim(),
        amount: parseAmount(amount_raw),
        office_location: office_location_raw && office_location_raw.trim() !== ''
          ? office_location_raw.trim()
          : null,
        payment_category: payment_category && payment_category.trim() !== ''
          ? payment_category.trim()
          : '기타',
        case_name: case_name && case_name.trim() !== '' ? case_name.trim() : null,
        receipt_type: receipt_type && receipt_type.trim() !== '' ? receipt_type.trim() : null,
        receipt_issued_at: parseReceiptIssuedAt(receipt_issued_at_raw),
        phone: phone && phone.trim() !== '' ? phone.replace(/[^0-9-]/g, '').trim() : null,
        memo: memo && memo.trim() !== '' ? memo.trim() : null,
        imported_from_csv: true,
        case_id: null, // 초기에는 NULL, 나중에 매칭
        consultation_id: null, // 초기에는 NULL, 나중에 매칭
      }

      // 유효성 검증
      if (!payment.payment_date) {
        console.log(`⚠️  행 ${i + 1} 스킵 (날짜 파싱 실패):`, payment_date_raw)
        continue
      }
      if (payment.amount === 0) {
        console.log(`⚠️  행 ${i + 1} 스킵 (금액 0원):`, amount_raw)
        continue
      }

      payments.push(payment)
    }

    return payments
  } catch (error) {
    console.error('❌ CSV 읽기 실패:', error)
    throw error
  }
}

/**
 * 데이터베이스에 입금 내역 삽입
 */
async function importPayments(payments) {
  console.log(`\n💾 ${payments.length}개 입금 내역 임포트 시작...\n`)

  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < payments.length; i++) {
    const payment = payments[i]

    try {
      const { error } = await supabase.from('payments').insert(payment)

      if (error) {
        console.error(`❌ [${i + 1}/${payments.length}] 실패:`, payment.depositor_name, error.message)
        errorCount++
      } else {
        successCount++
        if (successCount % 10 === 0) {
          console.log(`✅ [${i + 1}/${payments.length}] 진행 중... (성공: ${successCount}, 실패: ${errorCount})`)
        }
      }
    } catch (error) {
      console.error(`❌ [${i + 1}/${payments.length}] 예외:`, payment.depositor_name, error)
      errorCount++
    }
  }

  console.log(`\n\n✅ 임포트 완료!`)
  console.log(`   성공: ${successCount}개`)
  console.log(`   실패: ${errorCount}개`)
  console.log(`   총계: ${payments.length}개\n`)
}

/**
 * 메인 함수
 */
async function main() {
  try {
    console.log('🚀 입금 내역 CSV 임포트 시작\n')

    // CSV 파일 읽기
    const payments = await readCSV()
    console.log(`\n📦 파싱된 입금 내역: ${payments.length}개\n`)

    // 샘플 데이터 출력
    console.log('📝 샘플 데이터 (첫 3개):')
    payments.slice(0, 3).forEach((p, i) => {
      console.log(`\n[${i + 1}]`)
      console.log(`  입금일: ${p.payment_date}`)
      console.log(`  입금인: ${p.depositor_name}`)
      console.log(`  금액: ${p.amount.toLocaleString()}원`)
      console.log(`  사무실: ${p.office_location || '미지정'}`)
      console.log(`  명목: ${p.payment_category}`)
      console.log(`  사건: ${p.case_name || '(없음)'}`)
    })

    console.log('\n')
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    readline.question('계속 진행하시겠습니까? (y/n): ', async (answer) => {
      if (answer.toLowerCase() === 'y') {
        await importPayments(payments)
      } else {
        console.log('❌ 취소되었습니다.')
      }
      readline.close()
      process.exit(0)
    })
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

main()
