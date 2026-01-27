/**
 * batch-create-stream API 직접 테스트
 * 의뢰인 생성 로직이 어디서 실패하는지 확인
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testImportAPI() {
  // 테스트용 데이터 (test.xlsx 첫 행과 동일한 형식)
  const testRows = [{
    '계약일': '2025-01-10',
    '담당변호사': '박지영 변호사',
    '담당직원': '',
    '법원명': '수원가정법원 평택지원',
    '사건번호': '평택가정2025드단99999',  // 중복 방지용 임시 번호
    '사건명': '테스트 사건',
    '의뢰인명': '테스트의뢰인_' + Date.now(),
    '상대방명': '테스트상대방',
    '착수금': '5000000',
    '성공보수약정': '',
    '발생성공보수': '',
    '의뢰인연락처': '010-9999-9999',
    '계좌번호': '',
    '의뢰인이메일': '',
    '생년월일': '',
    '주소': '',
    '메모': '테스트 데이터'
  }];

  const columnMapping = {
    '계약일': 'contract_date',
    '담당변호사': 'assigned_lawyer',
    '담당직원': 'assigned_staff',
    '법원명': 'court_name',
    '사건번호': 'court_case_number',
    '사건명': 'case_name',
    '의뢰인명': 'client_name',
    '상대방명': 'opponent_name',
    '착수금': 'retainer_fee',
    '성공보수약정': 'success_fee_agreement',
    '발생성공보수': 'earned_success_fee',
    '의뢰인연락처': 'client_phone',
    '계좌번호': 'client_bank_account',
    '의뢰인이메일': 'client_email',
    '생년월일': 'client_birth_date',
    '주소': 'client_address',
    '메모': 'notes'
  };

  const options = {
    duplicateHandling: 'skip',
    createNewClients: true,
    linkScourt: false,  // 대법원 연동 스킵
    scourtDelayMs: 0,
    dryRun: false
  };

  console.log('=== API 호출 테스트 ===');
  console.log('rows:', JSON.stringify(testRows, null, 2));
  console.log('columnMapping:', JSON.stringify(columnMapping, null, 2));
  console.log('options:', JSON.stringify(options, null, 2));

  // 참고: 실제로 API를 호출하려면 인증 쿠키가 필요합니다.
  // 대신 convertToStandardRow를 직접 테스트합니다.

  const { convertToStandardRow, applyDefaults } = require('../lib/onboarding/csv-schema');

  const mapping = new Map(Object.entries(columnMapping));
  const standardRow = convertToStandardRow(testRows[0], mapping);
  const finalRow = applyDefaults(standardRow);

  console.log('\n=== 변환 결과 ===');
  console.log('standardRow:', JSON.stringify(standardRow, null, 2));
  console.log('finalRow.client_name:', finalRow.client_name);
  console.log('finalRow.client_phone:', finalRow.client_phone);

  // row.client_name 확인
  if (finalRow.client_name) {
    console.log('\n✅ client_name이 존재합니다. 의뢰인 생성 로직이 실행되어야 합니다.');
  } else {
    console.log('\n❌ client_name이 비어있습니다! 의뢰인 생성이 스킵됩니다.');
  }

  if (options.createNewClients) {
    console.log('✅ createNewClients=true입니다. 신규 의뢰인이 생성되어야 합니다.');
  } else {
    console.log('❌ createNewClients=false입니다! 의뢰인 생성이 스킵됩니다.');
  }
}

testImportAPI().catch(console.error);
