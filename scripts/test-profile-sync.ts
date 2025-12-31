/**
 * 프로필 동기화 테스트
 * 1. 현재 프로필 상태 확인
 * 2. 브라우저에서 encCsNo 추출
 * 3. DB에 동기화
 * 4. encCsNo로 캡챠 없이 접근 테스트
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getScourtSessionManager } from '../lib/scourt/session-manager';
import { createClient } from '@/lib/supabase';

async function main() {
  console.log('=== 프로필 동기화 테스트 ===\n');

  const manager = getScourtSessionManager();
  const supabase = createClient();

  // 1. 현재 DB 상태 확인
  console.log('📊 현재 DB 상태:');

  const { data: profiles } = await supabase
    .from('scourt_profiles')
    .select('*')
    .order('created_at', { ascending: false });

  console.log(`  프로필 수: ${profiles?.length || 0}개`);

  if (profiles && profiles.length > 0) {
    for (const p of profiles) {
      console.log(`  - ${p.profile_name}: ${p.case_count}/${p.max_cases}건 (${p.status})`);
    }
  }

  const { data: cases } = await supabase
    .from('scourt_profile_cases')
    .select('*')
    .order('created_at', { ascending: false });

  console.log(`  저장된 사건: ${cases?.length || 0}건`);

  // encCsNo가 있는 사건 수
  const casesWithEncCsNo = cases?.filter(c => c.enc_cs_no) || [];
  console.log(`  encCsNo 있는 사건: ${casesWithEncCsNo.length}건`);

  if (casesWithEncCsNo.length > 0) {
    console.log('\n  encCsNo 있는 사건 목록:');
    for (const c of casesWithEncCsNo.slice(0, 5)) {
      console.log(`    - ${c.case_number} (${c.court_name})`);
      console.log(`      encCsNo: ${c.enc_cs_no?.substring(0, 40)}...`);
    }
  }

  // 2. 프로필 가져오기 또는 생성
  console.log('\n📁 프로필 조회/생성:');
  const profile = await manager.getOrCreateProfile();
  console.log(`  사용 프로필: ${profile.profileName}`);
  console.log(`  userDataDir: ${profile.userDataDir}`);
  console.log(`  저장된 사건: ${profile.caseCount}/${profile.maxCases}건`);

  // 3. 브라우저에서 사건 추출 (headless: false로 확인)
  console.log('\n🌐 브라우저에서 사건 추출 중...');
  console.log('  (브라우저가 열립니다. 잠시 기다려주세요.)');

  try {
    const browserCases = await manager.getSavedCasesWithEncCsNo(profile);
    console.log(`\n  브라우저에서 발견: ${browserCases.length}건`);

    if (browserCases.length > 0) {
      console.log('\n  브라우저 사건 목록:');
      for (const c of browserCases) {
        console.log(`    - ${c.caseNumber} (${c.court})`);
        console.log(`      encCsNo: ${c.encCsNo?.substring(0, 40)}...`);
      }

      // 4. DB에 동기화
      console.log('\n📦 DB 동기화 시작...');
      const syncResult = await manager.syncBrowserToDb(profile);
      console.log(`  동기화 완료: ${syncResult.synced}건 성공, ${syncResult.errors}건 실패`);

      // 5. 동기화 후 DB 상태 확인
      console.log('\n📊 동기화 후 DB 상태:');
      const { data: updatedCases } = await supabase
        .from('scourt_profile_cases')
        .select('*')
        .eq('profile_id', profile.id);

      console.log(`  프로필 사건 수: ${updatedCases?.length || 0}건`);
      const withEnc = updatedCases?.filter(c => c.enc_cs_no) || [];
      console.log(`  encCsNo 있는 사건: ${withEnc.length}건`);

    } else {
      console.log('  ⚠️ 브라우저에 저장된 사건이 없습니다.');
      console.log('  사건 검색 후 "결과 저장" 체크박스를 선택해야 합니다.');
    }

  } catch (error) {
    console.error('브라우저 작업 중 에러:', error);
  }

  // 브라우저 종료
  await manager.closeAll();

  console.log('\n=== 테스트 완료 ===');
}

main().catch(console.error);
