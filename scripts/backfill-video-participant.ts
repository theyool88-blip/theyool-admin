/**
 * 기존 화상기일의 video_participant_side 백필 스크립트
 *
 * 사용: npx tsx scripts/backfill-video-participant.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('환경변수 필요');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function backfill() {
  console.log('=== 화상기일 video_participant_side 백필 ===\n');

  // 0. 컬럼 존재 여부 확인 및 생성
  console.log('0. 스키마 확인...');
  try {
    // 컬럼이 없으면 에러 발생
    await supabase.from('court_hearings').select('video_participant_side').limit(1);
    console.log('  video_participant_side 컬럼 존재 확인');
  } catch {
    console.log('  컬럼이 없습니다. Supabase 대시보드에서 마이그레이션을 먼저 실행해주세요.');
    console.log('  파일: supabase/migrations/20260114_court_hearings_video_participant.sql');
    return;
  }

  // 1. 쌍방 화상기일 업데이트
  console.log('1. 쌍방 화상기일 업데이트...');
  const { data: bothWay, error: bothWayError } = await supabase
    .from('court_hearings')
    .update({ video_participant_side: 'both' })
    .or('scourt_type_raw.ilike.%쌍방 화상장치%,scourt_type_raw.ilike.%쌍방화상장치%')
    .is('video_participant_side', null)
    .select('id');

  if (bothWayError) {
    console.error('  에러:', bothWayError.message);
  } else {
    console.log(`  ${bothWay?.length || 0}건 업데이트 완료`);
  }

  // 2. 일방 화상기일 조회
  console.log('\n2. 일방 화상기일 분석...');
  const { data: oneWayHearings, error: oneWayError } = await supabase
    .from('court_hearings')
    .select('id, case_number, scourt_type_raw')
    .or('scourt_type_raw.ilike.%일방 화상장치%,scourt_type_raw.ilike.%일방화상장치%')
    .is('video_participant_side', null);

  if (oneWayError) {
    console.error('  에러:', oneWayError.message);
    return;
  }

  console.log(`  일방 화상기일: ${oneWayHearings?.length || 0}건`);

  let updated = 0;
  let notFound = 0;

  for (const hearing of oneWayHearings || []) {
    // 해당 사건의 스냅샷에서 화상 참여자 정보 추출
    const { data: snapshot } = await supabase
      .from('scourt_case_snapshots')
      .select('raw_data')
      .eq('case_number', hearing.case_number)
      .order('scraped_at', { ascending: false })
      .limit(1)
      .single();

    if (!snapshot?.raw_data) {
      notFound++;
      continue;
    }

    const rawStr = JSON.stringify(snapshot.raw_data);
    const videoMatches = rawStr.match(/"agntNm":"[^"]*\[화상장치\][^"]*"/g);

    if (!videoMatches) {
      notFound++;
      continue;
    }

    // 화상 참여자 측 결정
    let side: string | null = null;
    for (const match of videoMatches) {
      const idx = rawStr.indexOf(match);
      const context = rawStr.substring(idx, Math.min(rawStr.length, idx + match.length + 100));
      const dvsMatch = context.match(/"agntDvsNm":"([^"]*)"/);

      if (dvsMatch) {
        const dvsNm = dvsMatch[1];
        if (dvsNm.includes('원고')) {
          side = 'plaintiff_side';
          break;
        }
        if (dvsNm.includes('피고')) {
          side = 'defendant_side';
          break;
        }
      }
    }

    if (side) {
      const { error: updateError } = await supabase
        .from('court_hearings')
        .update({ video_participant_side: side })
        .eq('id', hearing.id);

      if (updateError) {
        console.error(`  [${hearing.case_number}] 업데이트 실패:`, updateError.message);
      } else {
        console.log(`  [${hearing.case_number}] → ${side === 'plaintiff_side' ? '원고측' : '피고측'} 화상`);
        updated++;
      }
    } else {
      notFound++;
    }
  }

  console.log(`\n=== 결과 ===`);
  console.log(`- 일방 화상기일 업데이트: ${updated}건`);
  console.log(`- 참여자 정보 없음: ${notFound}건`);

  // 3. 최종 현황
  console.log('\n=== 최종 현황 ===');
  const { data: stats } = await supabase
    .from('court_hearings')
    .select('video_participant_side')
    .not('video_participant_side', 'is', null);

  const counts: Record<string, number> = {};
  stats?.forEach(h => {
    const side = h.video_participant_side || 'unknown';
    counts[side] = (counts[side] || 0) + 1;
  });

  console.log('화상기일 현황:');
  Object.entries(counts).forEach(([side, count]) => {
    const label = side === 'both' ? '쌍방 화상' :
                  side === 'plaintiff_side' ? '원고측 화상' :
                  side === 'defendant_side' ? '피고측 화상' : side;
    console.log(`  - ${label}: ${count}건`);
  });
}

backfill().catch(console.error);
