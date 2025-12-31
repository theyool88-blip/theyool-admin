/**
 * 사건 검색 후 encCsNo 저장 테스트
 * 1. 실제 사건 검색 (캡챠 통과)
 * 2. 결과 저장 체크
 * 3. encCsNo 추출 및 DB 저장 확인
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getScourtSessionManager } from '../lib/scourt/session-manager';
import { createClient } from '@/lib/supabase';

// 테스트할 사건 (로데스크에서 추출)
const testCase = {
  courtCode: '수원가정법원',
  caseYear: '2024',
  caseType: '드단',
  caseSerial: '26718',
  partyName: '김윤한',
};

async function main() {
  console.log('=== 사건 검색 및 encCsNo 저장 테스트 ===\n');

  const manager = getScourtSessionManager();
  const supabase = createClient();

  // 1. 프로필 가져오기
  console.log('📁 프로필 조회...');
  const profile = await manager.getOrCreateProfile();
  console.log(`  사용 프로필: ${profile.profileName}`);

  // 2. 사건 검색
  console.log(`\n🔍 사건 검색: ${testCase.caseYear}${testCase.caseType}${testCase.caseSerial}`);
  console.log(`  법원: ${testCase.courtCode}, 당사자: ${testCase.partyName}`);
  console.log('\n  (브라우저가 열리고 캡챠를 해결합니다...)');

  try {
    const result = await manager.searchCase(
      profile,
      testCase,
      10,      // maxRetries
      false    // headless: false (디버깅용)
    );

    if (result.success) {
      console.log('\n✅ 검색 성공!');
      console.log(`  캡챠 시도: ${result.captchaAttempts}회`);
      console.log(`  법원: ${result.caseInfo?.court}`);
      console.log(`  사건번호: ${result.caseInfo?.caseNumber}`);
      console.log(`  사건명: ${result.caseInfo?.caseName}`);

      // 3. 브라우저에서 encCsNo 추출
      console.log('\n📦 브라우저에서 encCsNo 추출...');
      const browserCases = await manager.getSavedCasesWithEncCsNo(profile);
      console.log(`  발견된 사건: ${browserCases.length}건`);

      const matchingCase = browserCases.find(c =>
        c.caseNumber === result.caseInfo?.caseNumber
      );

      if (matchingCase?.encCsNo) {
        console.log(`  encCsNo: ${matchingCase.encCsNo.substring(0, 50)}...`);

        // 4. DB에 동기화
        console.log('\n📦 DB 동기화...');
        const syncResult = await manager.syncBrowserToDb(profile);
        console.log(`  동기화: ${syncResult.synced}건`);

        // 5. DB 확인
        const { data: savedCase } = await supabase
          .from('scourt_profile_cases')
          .select('*')
          .eq('profile_id', profile.id)
          .eq('case_number', result.caseInfo?.caseNumber || '')
          .single();

        if (savedCase?.enc_cs_no) {
          console.log('\n✅ encCsNo DB 저장 확인!');
          console.log(`  case_number: ${savedCase.case_number}`);
          console.log(`  enc_cs_no: ${savedCase.enc_cs_no.substring(0, 50)}...`);
        } else {
          console.log('\n❌ encCsNo가 DB에 저장되지 않았습니다.');
        }

      } else {
        console.log('  ⚠️ encCsNo를 찾을 수 없습니다.');
      }

    } else {
      console.log('\n❌ 검색 실패:', result.error);
    }

  } catch (error) {
    console.error('테스트 중 에러:', error);
  }

  // 브라우저 종료
  await manager.closeAll();

  console.log('\n=== 테스트 완료 ===');
}

main().catch(console.error);
