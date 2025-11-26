#!/usr/bin/env node

/**
 * cases 테이블에 case_number 컬럼 추가 스크립트
 * 작성일: 2025-11-23
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addCaseNumberColumn() {
  console.log('🚀 Adding case_number column to cases table...\n');

  try {
    // PostgreSQL에서는 컬럼 추가와 인덱스 생성을 별도로 실행
    const queries = [
      'ALTER TABLE cases ADD COLUMN IF NOT EXISTS case_number VARCHAR(100)',
      'CREATE INDEX IF NOT EXISTS idx_cases_case_number ON cases(case_number)'
    ];

    for (const query of queries) {
      console.log(`Executing: ${query}`);
      const { error } = await supabase.rpc('exec', { sql: query });

      if (error && !error.message.includes('already exists')) {
        throw error;
      }
    }

    console.log('✅ Migration completed successfully!\n');

    // 검증
    const { data: cases, error: verifyError } = await supabase
      .from('cases')
      .select('id, title, case_number')
      .limit(5);

    if (verifyError) {
      console.error('Verification failed:', verifyError);
      return;
    }

    console.log('=== Sample Cases ===');
    console.table(cases.map(c => ({
      id: c.id.substring(0, 8),
      title: c.title.substring(0, 30),
      case_number: c.case_number || '(null)'
    })));

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n📝 Please run this SQL manually in Supabase SQL Editor:');
    console.log('\nALTER TABLE cases ADD COLUMN IF NOT EXISTS case_number VARCHAR(100);');
    console.log('CREATE INDEX IF NOT EXISTS idx_cases_case_number ON cases(case_number);');
    process.exit(1);
  }
}

addCaseNumberColumn();
