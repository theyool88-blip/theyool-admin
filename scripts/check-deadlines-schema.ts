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

async function check() {
  // Get all columns from case_deadlines
  console.log('case_deadlines 테이블 전체 컬럼:')
  const { data, error } = await supabase
    .from('case_deadlines')
    .select('*')
    .limit(0)

  // Even with 0 records, we can see if the table exists
  if (error) {
    console.log('Error or no RLS access:', error.message)

    // Try getting column info differently
    const { data: d2, error: e2 } = await supabase.rpc('exec_sql', {
      sql_text: `SELECT column_name FROM information_schema.columns WHERE table_name = 'case_deadlines' ORDER BY ordinal_position;`
    })

    if (e2) {
      console.log('Cannot get schema info:', e2.message)
    } else {
      console.log('Columns:', d2)
    }
  } else {
    console.log('Table accessible')
  }

  // Also check court_hearings full schema
  console.log('\ncourt_hearings 테이블 전체 컬럼:')
  const { data: ch } = await supabase.from('court_hearings').select('*').limit(1)
  if (ch && ch[0]) {
    console.log(Object.keys(ch[0]).join('\n'))
  }
}

check()
