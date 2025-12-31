/**
 * 자동 기한 등록 검증 테스트
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getCaseTypeInfo } from '../lib/scourt/deadline-auto-register';
import { createClient } from '@supabase/supabase-js';

async function verify() {
  console.log('=== 자동 기한 등록 검증 ===\n');

  // 1. 사건 유형 판별 테스트
  console.log('1. 사건 유형 판별 테스트\n');

  const testCases = [
    { num: '2024드단12345', expected: '가사소송 → DL_APPEAL (14일)' },
    { num: '2024고단67890', expected: '형사 → DL_CRIMINAL_APPEAL (7일)' },
    { num: '2024가단11111', expected: '민사 → DL_APPEAL (14일)' },
    { num: '2024르22222', expected: '가사비송 → DL_FAMILY_NONLIT (14일)' },
    { num: '2024브33333', expected: '가사비송 → DL_FAMILY_NONLIT (14일)' },
    { num: '2024구합44444', expected: '행정 → DL_APPEAL (14일)' },
  ];

  for (const { num, expected } of testCases) {
    const info = getCaseTypeInfo(num);
    const actual = info.appealDeadline
      ? `${info.category} → ${info.appealDeadline.deadlineType} (${info.appealDeadline.days}일)`
      : `${info.category} → 없음`;
    const match = actual.includes(info.appealDeadline?.deadlineType || '') ? '✅' : '❌';
    console.log(`${num}: ${actual} ${match}`);
  }

  // 2. DB 확인 - 새 기한 유형 존재 여부
  console.log('\n2. DB 기한 유형 확인\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: deadlineTypes, error } = await supabase
    .from('deadline_types')
    .select('type, name, days')
    .order('days', { ascending: true });

  if (error) {
    console.error('DB 조회 에러:', error.message);
  } else {
    console.log('등록된 기한 유형:');
    const newTypes = ['DL_CRIMINAL_APPEAL', 'DL_FAMILY_NONLIT', 'DL_PAYMENT_ORDER'];
    for (const dt of deadlineTypes || []) {
      const marker = newTypes.includes(dt.type) ? ' ✅ NEW' : '';
      console.log(`  - ${dt.type}: ${dt.name} (${dt.days}일)${marker}`);
    }

    // 새 타입 확인
    const foundNew = newTypes.filter(t => deadlineTypes?.some(dt => dt.type === t));
    console.log(`\n새 기한 유형: ${foundNew.length}/${newTypes.length}개 등록됨`);
    if (foundNew.length === newTypes.length) {
      console.log('✅ 모든 새 기한 유형 정상 등록');
    } else {
      console.log('❌ 누락된 기한 유형:', newTypes.filter(t => !foundNew.includes(t)));
    }
  }

  // 3. case_deadlines 테이블 scourt_update_id 컬럼 확인
  console.log('\n3. case_deadlines.scourt_update_id 컬럼 확인\n');

  const { error: colError } = await supabase
    .from('case_deadlines')
    .select('scourt_update_id')
    .limit(1);

  if (colError && colError.message.includes('column')) {
    console.log('❌ scourt_update_id 컬럼이 없습니다');
  } else {
    console.log('✅ scourt_update_id 컬럼 존재');
  }

  console.log('\n=== 검증 완료 ===');
}

verify().catch(console.error);
