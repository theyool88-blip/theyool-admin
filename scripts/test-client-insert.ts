import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function test() {
  // 테스트 의뢰인 생성 시도
  const { data, error } = await supabase
    .from('clients')
    .insert([{
      tenant_id: '799ce69a-df47-454d-8355-90b981ecf32f',
      name: '테스트의뢰인_삭제예정',
      phone: '010-0000-0000',
      bank_account: '국민 123-456-789',
    }])
    .select()
    .single()

  if (error) {
    console.error('❌ 실패:', error.message, `(code: ${error.code})`)
  } else {
    console.log('✅ 성공! 의뢰인 생성됨:', data.id)
    
    // 테스트 데이터 삭제
    await supabase.from('clients').delete().eq('id', data.id)
    console.log('🗑️ 테스트 데이터 삭제 완료')
  }
}

test()
