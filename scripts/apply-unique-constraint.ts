import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function applyConstraint() {
  console.log('🔧 UNIQUE 제약조건 적용 중...\n');

  // 먼저 기존 인덱스 존재 여부 확인
  const { data: existingIndexes, error: checkError } = await supabase
    .from('pg_indexes' as any)
    .select('indexname')
    .eq('tablename', 'legal_cases')
    .like('indexname', 'idx_legal_cases_unique%');

  if (!checkError && existingIndexes && existingIndexes.length > 0) {
    console.log('기존 인덱스 발견:', existingIndexes.map((i: any) => i.indexname));
  }

  // Supabase JS로는 DDL 실행이 어려우므로 psql 명령 출력
  console.log('⚠️  Supabase Dashboard SQL Editor에서 다음 SQL을 실행하세요:\n');
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 사건번호와 법원명이 모두 있는 경우 중복 방지
CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_cases_unique_with_court
ON legal_cases (tenant_id, court_case_number, court_name)
WHERE court_case_number IS NOT NULL AND court_name IS NOT NULL;

-- 사건번호만 있고 법원명이 NULL인 경우 중복 방지
CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_cases_unique_no_court
ON legal_cases (tenant_id, court_case_number)
WHERE court_case_number IS NOT NULL AND court_name IS NULL;

-- 확인
SELECT indexname FROM pg_indexes
WHERE tablename = 'legal_cases'
AND indexname LIKE 'idx_legal_cases_unique%';

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

applyConstraint();
