/**
 * WMONID 기반 전체 흐름 테스트
 *
 * 핵심 발견: encCsNo는 WMONID에 바인딩됨
 * 같은 WMONID를 사용하면 세션이 달라도 캡챠 없이 접근 가능
 *
 * 테스트 순서:
 * 1. API로 사건 검색 → WMONID + encCsNo 획득
 * 2. 새 세션(같은 WMONID)에서 캡챠 없이 일반내용 조회
 * 3. 완전히 새 세션(다른 WMONID)에서 실패 확인
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { ScourtApiClient } from '../lib/scourt/api-client';

async function main() {
  console.log('='.repeat(60));
  console.log('🔐 WMONID 기반 전체 흐름 테스트');
  console.log('='.repeat(60));

  const client = new ScourtApiClient();

  // Step 1: API로 사건 검색하여 WMONID + encCsNo 획득
  console.log('\n[Step 1] API로 사건 검색...\n');

  const result = await client.searchAndRegisterCase({
    cortCd: '수원가정법원',
    csYr: '2024',
    csDvsCd: '드단',
    csSerial: '26718',
    btprNm: '김',  // 당사자명
  });

  if (!result.success) {
    console.log('❌ 검색 실패:', result.error);
    return;
  }

  console.log('\n✅ 검색 성공!');
  console.log(`  WMONID: ${result.wmonid}`);
  console.log(`  encCsNo: ${result.encCsNo?.substring(0, 40)}...`);
  console.log(`  encCsNo 길이: ${result.encCsNo?.length}자`);

  // Step 2: 새 세션(같은 WMONID)에서 캡챠 없이 일반내용 조회
  console.log('\n' + '='.repeat(60));
  console.log('[Step 2] 같은 WMONID로 새 세션에서 일반내용 조회...');
  console.log('='.repeat(60));

  const client2 = new ScourtApiClient();
  const generalResult = await client2.getCaseGeneralWithStoredEncCsNo(
    result.wmonid!,
    result.encCsNo!,
    {
      cortCd: '000302',  // 수원가정법원
      csYear: '2024',
      csDvsCd: '150',    // 드단
      csSerial: '26718',
    }
  );

  if (generalResult.success) {
    console.log('\n✅ 캡챠 없이 일반내용 조회 성공!');
    console.log(`  사건명: ${generalResult.data?.csNm}`);
    console.log(`  진행상태: ${generalResult.data?.prcdStsNm}`);

    // 기일 정보
    if (generalResult.data?.hearings?.length) {
      console.log('  기일:');
      generalResult.data.hearings.forEach((h, i) => {
        console.log(`    ${i + 1}. ${h.trmDt} ${h.trmNm} (${h.trmPntNm})`);
      });
    }
  } else {
    console.log('\n❌ 일반내용 조회 실패:', generalResult.error);
  }

  // Step 3: 완전히 새 세션(다른 WMONID)에서 실패 확인
  console.log('\n' + '='.repeat(60));
  console.log('[Step 3] 다른 WMONID로 접근 시도 (실패 예상)...');
  console.log('='.repeat(60));

  const client3 = new ScourtApiClient();
  // 새 세션 (새 WMONID 생성)
  await client3.initSession();
  const newWmonid = client3.getWmonid();
  console.log(`  새 WMONID: ${newWmonid}`);
  console.log(`  기존 WMONID: ${result.wmonid}`);

  // 기존 encCsNo로 접근 시도 (다른 WMONID이므로 실패해야 함)
  const failResult = await client3.getCaseGeneral({
    cortCd: '000302',
    csYear: '2024',
    csDvsCd: '150',
    csSerial: '26718',
    btprNm: '',
    encCsNo: result.encCsNo!,
    captchaAnswer: '',
  });

  if (failResult.success) {
    console.log('\n⚠️ 예상과 다르게 성공! (encCsNo가 WMONID 독립적?)');
  } else {
    console.log('\n✅ 예상대로 실패! (encCsNo는 WMONID에 바인딩됨)');
    console.log(`  에러: ${failResult.error}`);
  }

  // 결론
  console.log('\n' + '='.repeat(60));
  console.log('📋 결론');
  console.log('='.repeat(60));
  console.log('1. encCsNo는 WMONID에 바인딩됨');
  console.log('2. 사건 등록 시 WMONID와 encCsNo를 함께 저장해야 함');
  console.log('3. 캡챠 없이 접근 시 저장된 WMONID 사용 필수');
  console.log('='.repeat(60));
}

main().catch(console.error);
