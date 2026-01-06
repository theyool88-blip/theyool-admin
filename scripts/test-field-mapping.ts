/**
 * 저장된 스냅샷의 basicInfo 필드와 FIELD_LABELS 매핑 테스트
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { getVisibleFields, sortFields, FIELD_LABELS } from '../lib/scourt/field-renderer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('환경변수 설정 필요: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function testFieldMapping() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('=== 저장된 스냅샷 데이터 조회 ===\n');

  // 최근 스냅샷 3개 조회
  const { data: snapshots, error } = await supabase
    .from('scourt_case_snapshots')
    .select('id, case_number, basic_info, scraped_at')
    .order('scraped_at', { ascending: false })
    .limit(3);

  if (error) {
    console.error('조회 실패:', error);
    return;
  }

  if (!snapshots || snapshots.length === 0) {
    console.log('스냅샷 데이터 없음');
    return;
  }

  console.log(`총 ${snapshots.length}개 스냅샷 조회됨\n`);

  for (const snapshot of snapshots) {
    console.log('-------------------------------------------');
    console.log(`사건번호: ${snapshot.case_number}`);
    console.log(`스크랩 일시: ${snapshot.scraped_at}`);
    console.log('');

    const basicInfo = snapshot.basic_info as Record<string, any>;

    if (!basicInfo || Object.keys(basicInfo).length === 0) {
      console.log('  basic_info: (비어있음)');
      continue;
    }

    console.log('=== 저장된 필드 (원본) ===');
    for (const [key, value] of Object.entries(basicInfo)) {
      const hasLabel = FIELD_LABELS[key] !== undefined;
      const status = hasLabel ? '✓' : '✗ (라벨 없음)';
      console.log(`  ${status} ${key}: ${JSON.stringify(value)}`);
    }

    console.log('\n=== getVisibleFields() 결과 ===');
    const visibleFields = getVisibleFields(basicInfo);
    const sortedFields = sortFields(visibleFields);

    for (const field of sortedFields) {
      console.log(`  ${field.label}: ${field.value}`);
    }

    console.log('');
  }

  // 라벨이 없는 필드 목록
  console.log('\n=== 전체 스냅샷에서 라벨 없는 필드 ===');
  const missingLabels = new Set<string>();

  for (const snapshot of snapshots) {
    const basicInfo = snapshot.basic_info as Record<string, any>;
    if (!basicInfo) continue;

    for (const key of Object.keys(basicInfo)) {
      if (!FIELD_LABELS[key] && !key.endsWith('List') && typeof basicInfo[key] !== 'object') {
        missingLabels.add(key);
      }
    }
  }

  if (missingLabels.size === 0) {
    console.log('모든 필드가 라벨 매핑됨!');
  } else {
    console.log('라벨 추가 필요:');
    for (const key of missingLabels) {
      console.log(`  ${key}: '${key}',`);
    }
  }
}

testFieldMapping();
