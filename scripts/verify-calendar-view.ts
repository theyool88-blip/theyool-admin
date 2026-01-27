import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function verify() {
  console.log('=== unified_calendar 뷰 검증 ===\n')

  // 1. 컬럼 확인
  const { data, error } = await supabase
    .from('unified_calendar')
    .select('*')
    .limit(3)

  if (error) {
    console.log('에러:', error.message)
    return
  }

  if (data && data.length > 0) {
    console.log('컬럼 목록:')
    console.log(Object.keys(data[0]).join('\n'))
    
    console.log('\n--- 샘플 데이터 ---')
    data.forEach((row, i) => {
      console.log(`\n[${i+1}] ${row.event_type}`)
      console.log('  title:', row.title)
      console.log('  client_name:', row.client_name)
      console.log('  our_client_name:', row.our_client_name)
      console.log('  scourt_result_raw:', row.scourt_result_raw)
      console.log('  deadline_type_label:', row.deadline_type_label)
    })
  } else {
    console.log('데이터 없음')
  }
}

verify().catch(console.error)
