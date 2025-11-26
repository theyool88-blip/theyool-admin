require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function checkSchema() {
  console.log('bookings 테이블 구조 확인 중...\n')
  
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .limit(1)
  
  if (error) {
    console.error('에러:', error)
    return
  }
  
  if (data && data.length > 0) {
    console.log('컬럼 목록:')
    Object.keys(data[0]).forEach(key => {
      console.log(`  - ${key}`)
    })
    console.log('\n샘플 데이터:')
    console.log(data[0])
  } else {
    console.log('데이터가 없습니다.')
  }
}

checkSchema()
