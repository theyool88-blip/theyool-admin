import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const supabaseUrl = 'https://feqxrodutqwliucfllgr.supabase.co'
const supabaseKey = 'sb_secret_4lAm3D8hS40d5yXnAFQgXQ_8wGyUEBA'

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'public' },
  auth: { persistSession: false }
})

async function runMigration() {
  console.log('Starting migration...')
  
  // 1. case_clients 테이블 생성
  console.log('\n1. Creating case_clients table...')
  const { error: e1 } = await supabase.from('case_clients').select('id').limit(1)
  if (e1?.code === '42P01') {
    // 테이블이 없으면 생성은 Supabase Dashboard에서 해야 함
    console.log('Table does not exist - please create via Supabase Dashboard')
  } else {
    console.log('Table exists or accessible')
  }
  
  // 2. case_parties.representatives 컬럼 확인
  console.log('\n2. Checking case_parties.representatives column...')
  const { data: parties, error: e2 } = await supabase
    .from('case_parties')
    .select('id, representatives')
    .limit(1)
  
  if (e2?.message?.includes('representatives')) {
    console.log('Column does not exist - needs to be added via Dashboard')
  } else {
    console.log('Column exists or table empty:', parties)
  }
  
  // 3. legal_cases 캐시 필드 확인
  console.log('\n3. Checking legal_cases cache fields...')
  const { data: cases, error: e3 } = await supabase
    .from('legal_cases')
    .select('id, primary_client_id, primary_client_name')
    .limit(1)
  
  if (e3?.message?.includes('primary_client')) {
    console.log('Cache fields do not exist - needs to be added via Dashboard')
  } else {
    console.log('Cache fields exist or table empty:', cases)
  }
  
  // 4. case_assignees.assignee_role 확인
  console.log('\n4. Checking case_assignees.assignee_role column...')
  const { data: assignees, error: e4 } = await supabase
    .from('case_assignees')
    .select('id, assignee_role')
    .limit(1)
  
  if (e4?.message?.includes('assignee_role')) {
    console.log('Column does not exist - needs to be added via Dashboard')
  } else {
    console.log('Column exists or table empty:', assignees)
  }
  
  console.log('\n=== Migration Status ===')
  console.log('Note: DDL commands (CREATE TABLE, ALTER TABLE) cannot be executed via Supabase client.')
  console.log('Please run the migration SQL directly in Supabase Dashboard SQL Editor:')
  console.log('https://supabase.com/dashboard/project/feqxrodutqwliucfllgr/sql/new')
}

runMigration().catch(console.error)
