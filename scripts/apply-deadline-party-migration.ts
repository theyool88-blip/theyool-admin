import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.log('Missing env vars');
  process.exit(1);
}

const supabase = createClient(url, key);

async function applyMigration() {
  console.log('당사자별 불변기한 컬럼 추가 마이그레이션 시작...\n');

  // 1. party_id 컬럼 존재 확인 후 추가
  const { error: err1 } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE case_deadlines ADD COLUMN IF NOT EXISTS party_id UUID REFERENCES case_parties(id) ON DELETE SET NULL;`
  });

  if (err1) {
    // RPC가 없으면 직접 insert로 테스트
    console.log('RPC 없음, 대안 방법 시도...');

    // 더미 데이터로 컬럼 추가 테스트
    const testResult = await supabase
      .from('case_deadlines')
      .update({ party_id: null })
      .eq('id', '00000000-0000-0000-0000-000000000000');

    if (testResult.error?.message.includes('party_id')) {
      console.log('❌ party_id 컬럼이 없습니다.');
      console.log('\n⚠️  Supabase 대시보드에서 직접 SQL 실행이 필요합니다:');
      console.log('---');
      console.log(`
ALTER TABLE case_deadlines
ADD COLUMN IF NOT EXISTS party_id UUID REFERENCES case_parties(id) ON DELETE SET NULL;

ALTER TABLE case_deadlines
ADD COLUMN IF NOT EXISTS party_side VARCHAR(30);

CREATE INDEX IF NOT EXISTS idx_case_deadlines_party_id
ON case_deadlines(party_id) WHERE party_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_case_deadlines_party_side
ON case_deadlines(party_side) WHERE party_side IS NOT NULL;

COMMENT ON COLUMN case_deadlines.party_id IS '연관된 당사자 ID (NULL이면 사건 전체 적용)';
COMMENT ON COLUMN case_deadlines.party_side IS '당사자 측: plaintiff_side(원고측), defendant_side(피고측), NULL(전체)';
      `);
      console.log('---');
    } else {
      console.log('✓ party_id 컬럼이 이미 존재하거나 추가됨');
    }
  } else {
    console.log('✓ party_id 컬럼 추가됨');
  }
}

applyMigration();
