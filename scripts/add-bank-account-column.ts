/**
 * clients 테이블에 bank_account 컬럼 추가
 *
 * 사용법: npx tsx scripts/add-bank-account-column.ts
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkAndAddColumn() {
  console.log('🔍 clients 테이블 현재 컬럼 확인 중...\n')

  // Check current columns
  const { data: sample, error: checkError } = await supabase
    .from('clients')
    .select('*')
    .limit(1)

  if (checkError) {
    console.error('❌ clients 테이블 조회 에러:', checkError)
    return
  }

  const currentColumns = sample?.[0] ? Object.keys(sample[0]) : []
  console.log('현재 컬럼:', currentColumns.join(', '))

  if (currentColumns.includes('bank_account')) {
    console.log('\n✅ bank_account 컬럼이 이미 존재합니다!')
    return
  }

  console.log('\n⚠️ bank_account 컬럼이 없습니다.')
  console.log('\n📋 Supabase Dashboard SQL Editor에서 아래 SQL을 실행하세요:')
  console.log('─'.repeat(60))
  console.log(`
ALTER TABLE clients ADD COLUMN IF NOT EXISTS bank_account TEXT;
COMMENT ON COLUMN clients.bank_account IS '의뢰인 계좌번호 (은행명 포함)';
  `.trim())
  console.log('─'.repeat(60))
  console.log('\n🔗 Dashboard: https://supabase.com/dashboard/project/feqxrodutqwliucfllgr/sql')
}

checkAndAddColumn()
