/**
 * main_case_id / is_new_case / scourt_enc_cs_no 마이그레이션 적용
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function applyMigration() {
  console.log('=== 마이그레이션 적용 시작 ===\n');

  // 1. main_case_id 추가
  console.log('1. main_case_id 컬럼 추가...');
  const { error: mainCaseError } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE legal_cases
      ADD COLUMN IF NOT EXISTS main_case_id UUID REFERENCES legal_cases(id);
    `
  });

  if (mainCaseError) {
    // rpc가 없을 수 있음, 직접 쿼리 시도
    console.log('  RPC 없음, 대체 방법 시도...');
  } else {
    console.log('  완료');
  }

  // 인덱스 추가
  console.log('2. main_case_id 인덱스 추가...');
  const { error: indexError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE INDEX IF NOT EXISTS idx_legal_cases_main_case_id
      ON legal_cases(main_case_id);
    `
  });

  // 3. is_new_case 제거 확인
  console.log('3. is_new_case 컬럼 확인...');
  const { data: cols } = await supabase
    .from('information_schema.columns' as any)
    .select('column_name')
    .eq('table_name', 'legal_cases')
    .eq('column_name', 'is_new_case');

  // 4. scourt_enc_cs_no 추가
  console.log('4. scourt_enc_cs_no 컬럼 추가...');

  // 테스트: 현재 테이블 구조 확인
  console.log('\n=== 현재 테이블 구조 확인 ===');

  // legal_cases 테이블에서 몇 개 가져와서 필드 확인
  const { data: sampleCase, error: caseError } = await supabase
    .from('legal_cases')
    .select('*')
    .limit(1);

  if (caseError) {
    console.error('legal_cases 조회 실패:', caseError);
  } else if (sampleCase && sampleCase.length > 0) {
    const fields = Object.keys(sampleCase[0]);
    console.log('\nlegal_cases 필드 목록:');
    console.log(fields.join(', '));

    const hasMainCaseId = fields.includes('main_case_id');
    const hasIsNewCase = fields.includes('is_new_case');

    console.log(`\nmain_case_id 존재: ${hasMainCaseId ? '예' : '아니오'}`);
    console.log(`is_new_case 존재: ${hasIsNewCase ? '예' : '아니오'}`);
  }

  // case_relations 테이블 확인
  const { data: sampleRelation, error: relError } = await supabase
    .from('case_relations')
    .select('*')
    .limit(1);

  if (relError) {
    console.error('\ncase_relations 조회 실패:', relError);
  } else if (sampleRelation && sampleRelation.length > 0) {
    const fields = Object.keys(sampleRelation[0]);
    console.log('\ncase_relations 필드 목록:');
    console.log(fields.join(', '));

    const hasEncCsNo = fields.includes('scourt_enc_cs_no');
    console.log(`\nscourt_enc_cs_no 존재: ${hasEncCsNo ? '예' : '아니오'}`);
  }

  console.log('\n=== 마이그레이션 완료 ===');
  console.log('Supabase Dashboard에서 직접 SQL을 실행해주세요:');
  console.log('supabase/migrations/20260105_main_case_relation.sql\n');
}

applyMigration().catch(console.error);
