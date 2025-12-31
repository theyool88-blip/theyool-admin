/**
 * 브라우저에서 추출한 encCsNo를 DB에 저장
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@/lib/supabase';

// 브라우저에서 추출한 7개 사건의 encCsNo
const browserCases = [
  {
    cortNm: '수원가정법원',
    csNo: '2024드단26718',
    encCsNo: 'kMQhgOsZ3OtaWu1oONT8mM6YJ0WKfPS4qHRya6f36bzPdYrgmScMxY4lyFPp5Lfg',
  },
  {
    cortNm: '대전지방법원',
    csNo: '2024카합30',
    encCsNo: 'kMQhgOsZ3OtaWu1oONT8mLuK60g6HrMD46RqfF4Pq0GkuHHaB2/HnqOluwOKVygk',
  },
  {
    cortNm: '대전지방법원',
    csNo: '2023노2410',
    encCsNo: 'kMQhgOsZ3OtaWu1oONT8mIkZxb6vr8wYq0jZgVOUEO/a5E951qGMRorRE5i4Lj16',
  },
  {
    cortNm: '수원가정법원 평택지원',
    csNo: '2024드단23848',
    encCsNo: 'kMQhgOsZ3OtaWu1oONT8mItrDukTVNvEM+hcbC/VUgVFzBvaGup7VQ+R1tcea4S6',
  },
  {
    cortNm: '수원가정법원 평택지원',
    csNo: '2024드단25790',
    encCsNo: 'kMQhgOsZ3OtaWu1oONT8mB7jA7Yx/zg4yQjfAyJNQe6oWityERoGosPCb1BdIGLq',
  },
  {
    cortNm: '수원가정법원 평택지원',
    csNo: '2024드단531',
    encCsNo: 'kMQhgOsZ3OtaWu1oONT8mMzbwwWqoE8mG9BD7RYX8TpctVOrgvdhN1PhcB/bLOkC',
  },
  {
    cortNm: '수원가정법원 성남지원',
    csNo: '2023드합11801',
    encCsNo: 'kMQhgOsZ3OtaWu1oONT8mIl6AAhezghNHk4k3pTWSY7mSbhLv8df0ZnH1jo1No1K',
  },
];

async function main() {
  console.log('=== 브라우저 encCsNo DB 저장 ===\n');

  const supabase = createClient();

  // 1. 프로필 ID 조회
  const { data: profile } = await supabase
    .from('scourt_profiles')
    .select('id, profile_name')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!profile) {
    console.log('활성 프로필이 없습니다.');
    return;
  }

  console.log(`프로필: ${profile.profile_name} (${profile.id})\n`);

  // 2. 각 사건 저장
  let successCount = 0;
  let errorCount = 0;

  for (const c of browserCases) {
    console.log(`저장 중: ${c.csNo} (${c.cortNm})`);

    const { error } = await supabase.from('scourt_profile_cases').upsert(
      {
        profile_id: profile.id,
        court_name: c.cortNm,
        case_number: c.csNo,
        case_name: '',
        enc_cs_no: c.encCsNo,
        last_accessed_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id,case_number' }
    );

    if (error) {
      console.log(`  에러: ${error.message}`);
      errorCount++;
    } else {
      console.log(`  저장 완료`);
      successCount++;
    }
  }

  // 3. 프로필 case_count 업데이트
  await supabase
    .from('scourt_profiles')
    .update({ case_count: successCount, last_sync_at: new Date().toISOString() })
    .eq('id', profile.id);

  console.log(`\n=== 결과 ===`);
  console.log(`성공: ${successCount}건`);
  console.log(`실패: ${errorCount}건`);

  // 4. 저장 확인
  const { data: savedCases } = await supabase
    .from('scourt_profile_cases')
    .select('case_number, court_name, enc_cs_no')
    .eq('profile_id', profile.id);

  console.log(`\n=== 저장된 사건 ===`);
  savedCases?.forEach((c) => {
    console.log(`  ${c.case_number} (${c.court_name})`);
    console.log(`    encCsNo: ${c.enc_cs_no?.substring(0, 40)}...`);
  });
}

main().catch(console.error);
