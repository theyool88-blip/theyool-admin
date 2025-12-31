/**
 * drive_file_classifications에 의뢰인 공개 컬럼 추가
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration() {
  console.log('마이그레이션 시작...')

  const sql = `
    -- 의뢰인 공개 여부
    ALTER TABLE drive_file_classifications
    ADD COLUMN IF NOT EXISTS client_visible BOOLEAN DEFAULT FALSE;

    -- 의뢰인용 문서 유형
    ALTER TABLE drive_file_classifications
    ADD COLUMN IF NOT EXISTS client_doc_type VARCHAR(50);

    -- 고용량 파일 플래그 (40MB 이상)
    ALTER TABLE drive_file_classifications
    ADD COLUMN IF NOT EXISTS is_large_file BOOLEAN DEFAULT FALSE;

    -- 파일 크기 (bytes)
    ALTER TABLE drive_file_classifications
    ADD COLUMN IF NOT EXISTS file_size BIGINT;

    -- 인덱스: 의뢰인 공개 파일만 조회
    CREATE INDEX IF NOT EXISTS idx_dfc_client_visible
    ON drive_file_classifications(client_visible)
    WHERE client_visible = TRUE;

    -- 인덱스: 사건별 공개 파일 조회
    CREATE INDEX IF NOT EXISTS idx_dfc_case_client_visible
    ON drive_file_classifications(case_id, client_visible)
    WHERE client_visible = TRUE;

    -- 인덱스: 의뢰인용 문서 유형별 조회
    CREATE INDEX IF NOT EXISTS idx_dfc_client_doc_type
    ON drive_file_classifications(client_doc_type)
    WHERE client_visible = TRUE;
  `

  // SQL을 개별 문장으로 분리하여 실행
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  for (const statement of statements) {
    console.log(`실행: ${statement.substring(0, 50)}...`)

    const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' })

    if (error) {
      // exec_sql이 없으면 직접 쿼리 시도
      console.log('exec_sql 없음, 다른 방법 시도...')
      break
    }
  }

  // 검증
  const { data, error } = await supabase
    .from('drive_file_classifications')
    .select('client_visible')
    .limit(1)

  if (error) {
    console.error('검증 실패:', error.message)
    console.log('\n⚠️ Supabase Dashboard에서 직접 SQL 실행 필요:')
    console.log('https://supabase.com/dashboard/project/kqqyipnlkmmprfgygauk/sql/new')
    console.log('\n실행할 SQL:')
    console.log(sql)
  } else {
    console.log('✅ 마이그레이션 완료!')
  }
}

runMigration().catch(console.error)
