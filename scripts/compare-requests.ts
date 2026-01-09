/**
 * 성공/실패 사건의 API 요청 비교 분석
 */

import { getScourtApiClient } from '../lib/scourt/api-client';

async function compareRequests() {
  console.log('=== API 요청 비교 분석 ===\n');

  const client = getScourtApiClient();

  // 성공 사건: 카기 (application - ssgo105)
  const successCase = {
    court: '평택지원', year: '2025', type: '카기', serial: '10680', party: '이명규',
    endpoint: 'ssgo105',
  };

  // 실패 사건: 차전 (execution - ssgo104)
  const failCase = {
    court: '안성시법원', year: '2025', type: '차전', serial: '2850', party: '임승태',
    endpoint: 'ssgo104',
  };

  console.log('1. 성공 사건 분석 (카기 - ssgo105)');
  console.log('   법원:', successCase.court);
  console.log('   사건:', `${successCase.year}${successCase.type}${successCase.serial}`);

  const successResult = await client.searchAndRegisterCase({
    cortCd: successCase.court,
    csYr: successCase.year,
    csDvsCd: successCase.type,
    csSerial: successCase.serial,
    btprNm: successCase.party,
  });

  if (successResult.success) {
    console.log('   ✅ 성공:', Object.keys(successResult.generalData || {}).length, '필드');
  } else {
    console.log('   ❌ 실패:', successResult.error);
  }

  console.log('\n--- 2.5초 대기 ---\n');
  await new Promise(resolve => setTimeout(resolve, 2500));

  console.log('2. 실패 사건 분석 (차전 - ssgo104)');
  console.log('   법원:', failCase.court);
  console.log('   사건:', `${failCase.year}${failCase.type}${failCase.serial}`);

  const failResult = await client.searchAndRegisterCase({
    cortCd: failCase.court,
    csYr: failCase.year,
    csDvsCd: failCase.type,
    csSerial: failCase.serial,
    btprNm: failCase.party,
  });

  if (failResult.success && failResult.generalData && Object.keys(failResult.generalData).length > 0) {
    console.log('   ✅ 성공:', Object.keys(failResult.generalData).length, '필드');
  } else if (failResult.encCsNo) {
    console.log('   ⚠️ encCsNo만 획득, 일반내용 조회 실패');
    console.log('   에러:', failResult.error || '일반내용 없음');
  } else {
    console.log('   ❌ 실패:', failResult.error);
  }

  console.log('\n=== 비교 결론 ===');
  console.log('성공 엔드포인트: ssgo101, ssgo102, ssgo105');
  console.log('실패 엔드포인트: ssgo103, ssgo104');
  console.log('\n가능한 원인:');
  console.log('1. 엔드포인트 URL 패턴이 다름');
  console.log('2. submissionid가 다름');
  console.log('3. 요청 파라미터 구조가 다름');
}

compareRequests().catch(console.error);
