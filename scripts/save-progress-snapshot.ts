/**
 * Chrome MCP에서 추출한 진행내용을 DB에 저장
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kqqyipnlkmmprfgygauk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxcXlpcG5sa21tcHJmZ3lnYXVrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjMyNDQyOSwiZXhwIjoyMDc3OTAwNDI5fQ.nmE-asCNpDnxix4ZxyNlEyocJdG8kPEunx9MHOTnXS0'
);

// Chrome MCP에서 추출한 진행내용 데이터
const progressData = [
  { date: "20240430", content: "소장접수", result: "" },
  { date: "20240503", content: "피고 김OO에게 소장부본/소송안내서/답변서요약표 송달", result: "2024.05.09 도달" },
  { date: "20240709", content: "원고 소송대리인 법OOOOOOOOOO 기일지정신청서 제출", result: "" },
  { date: "20240710", content: "원고 소송대리인 법무법인 더율 담당변호사 임OO에게 변론기일소환장 송달", result: "2024.07.10 도달" },
  { date: "20240710", content: "피고 김OO에게 변론기일소환장 송달", result: "2024.07.16 도달" },
  { date: "20240806", content: "원고 소송대리인 법OOOOOOOOOO 기일변경신청서 제출", result: "" },
  { date: "20240807", content: "기일변경명령", result: "" },
  { date: "20240807", content: "피고 김OO에게 변경기일소환장 송달", result: "2024.08.13 도달" },
  { date: "20240807", content: "원고 소송대리인 법무법인 더율 담당변호사 임OO에게 변경기일소환장 송달", result: "2024.08.08 도달" },
  { date: "20240828", content: "변론기일(본관 402호 법정 14:20)", result: "기일변경" },
  { date: "20240923", content: "피고 김OO 준비서면 제출", result: "" },
  { date: "20240923", content: "원고 소송대리인 법무법인 더율 담당변호사 임OO에게 준비서면부본(24.09.23.자) 송달", result: "2024.09.23 도달" },
  { date: "20240925", content: "변론기일(본관 402호 법정 11:00)", result: "속행" },
  { date: "20240927", content: "원고 소송대리인 법OOOOOOOOOO 재산명시신청서 제출", result: "" },
  { date: "20240927", content: "원고 소송대리인 법OOOOOOOOOO 사실조회신청서(공무원연금공단) 제출", result: "" },
  { date: "20240930", content: "재산명시명령(일반)", result: "" },
  { date: "20240930", content: "공OOOOOO에게 사실조회서 송달", result: "2024.10.07 도달" },
  { date: "20241004", content: "피고 김OO에게 재산명시결정등본 송달", result: "2024.10.12 0시 도달" },
  { date: "20241004", content: "원고 소송대리인 법무법인 더율 담당변호사 임OO에게 재산명시결정등본 송달", result: "2024.10.07 도달" },
  { date: "20241010", content: "공OOOOOO 접수증명", result: "2024.10.10 발급" },
  { date: "20241010", content: "공OOOOOO 사실조회회신 제출", result: "" },
  { date: "20241105", content: "원고 소송대리인 법OOOOOOOOOO 재산명시목록 제출", result: "" },
  { date: "20241105", content: "피고 김OO에게 재산명시목록(24.11.05.자) 송달", result: "2024.11.13 0시 도달" },
  { date: "20241107", content: "피고 소송대리인 김OO 기일변경신청서 제출", result: "" },
  { date: "20241107", content: "피고 소송대리인 김OO 소송위임장 제출", result: "" },
  { date: "20241108", content: "기일변경명령", result: "" },
  { date: "20241108", content: "원고 소송대리인 법무법인 더율 담당변호사 임OO에게 변경기일소환장 송달", result: "2024.11.11 도달" },
  { date: "20241108", content: "피고 소송대리인 변호사 김OO에게 변경기일소환장 송달", result: "2024.11.12 도달" },
  { date: "20241113", content: "변론기일(본관 402호 법정 10:00)", result: "기일변경" },
  { date: "20241210", content: "피고 소송대리인 김OO 재산명시명령 기한 연장신청 제출", result: "" },
  { date: "20241211", content: "원고 소송대리인 법OOOOOOOOOO 준비서면 제출", result: "" },
  { date: "20241211", content: "피고 소송대리인 변호사 김OO에게 준비서면부본(24.12.11.자) 송달", result: "2024.12.16 도달" },
  { date: "20241212", content: "원고 소송대리인 법OOOOOOOOOO 기일변경신청서 제출", result: "" },
  { date: "20241213", content: "기일변경명령", result: "" },
  { date: "20241213", content: "원고 소송대리인 법무법인 더율 담당변호사 임OO에게 변경기일소환장 송달", result: "2024.12.13 도달" },
  { date: "20241213", content: "피고 소송대리인 변호사 김OO에게 변경기일소환장 송달", result: "2024.12.16 도달" },
  { date: "20241218", content: "변론기일(본관 402호 법정 14:40)", result: "기일변경" },
  { date: "20250211", content: "피고 소송대리인 김OO 기일변경신청서 제출", result: "" },
  { date: "20250212", content: "기일변경명령", result: "" },
  { date: "20250213", content: "원고 소송대리인  담당변호사 임OO에게 변경기일소환장 송달", result: "2025.02.13 도달" },
  { date: "20250213", content: "피고 소송대리인 변호사 김OO에게 변경기일소환장 송달", result: "2025.02.20 도달" },
  { date: "20250219", content: "피고 소송대리인 김OO 준비서면 제출", result: "" },
  { date: "20250220", content: "원고 소송대리인 법무법인 더율 담당변호사 임OO에게 준비서면부본(25.02.19.자) 송달", result: "2025.02.20 도달" },
  { date: "20250224", content: "피고 소송대리인 김OO 준비서면 제출", result: "" },
  { date: "20250224", content: "피고 소송대리인 김OO 의견서 제출", result: "" },
  { date: "20250224", content: "원고 소송대리인 법무법인 더율 담당변호사 임OO에게 준비서면부본(25.02.24.자) 송달", result: "2025.02.24 도달" },
  { date: "20250225", content: "원고 소송대리인 법OOOOOOOOOO 담당변호사 지정서 제출", result: "" },
  { date: "20250225", content: "원고 소송대리인 법OOOOOOOOOO 준비서면 제출", result: "" },
  { date: "20250225", content: "피고 소송대리인 변호사 김OO에게 준비서면부본(25.02.25.자) 송달", result: "2025.02.26 도달" },
  { date: "20250226", content: "변론기일(본관 402호 법정 14:40)", result: "기일변경" },
  { date: "20250226", content: "변론기일(본관 402호 법정 11:20)", result: "속행(추후지정)" },
  { date: "20250313", content: "조사명령(일반)", result: "" },
  { date: "20250324", content: "원고 소송대리인 법무법인 더율 담당변호사 임OOOOOO에게 조사기일안내 송달", result: "2025.03.25 도달" },
  { date: "20250324", content: "피고 소송대리인 변호사 김OO에게 조사기일안내 송달", result: "2025.03.25 도달" },
  { date: "20250411", content: "면접조사기일(본관 5층 조사대기실 10:00)", result: "시행" },
  { date: "20250520", content: "원고 소송대리인 법OOOOOOOOOO 준비서면 제출", result: "" },
  { date: "20250520", content: "피고 소송대리인 변호사 김OO에게 준비서면부본(25.05.20.자) 송달", result: "2025.05.21 도달" },
  { date: "20250522", content: "피고 소송대리인 김OO 준비서면 제출", result: "" },
  { date: "20250522", content: "원고 소송대리인 법무법인 더율 담당변호사 임OOOOOO에게 준비서면부본(25.05.22.자) 송달", result: "2025.05.22 도달" },
  { date: "20250528", content: "변론기일(본관 402호 법정 15:00) [일방 화상장치]", result: "속행" },
  { date: "20250602", content: "피고 소송대리인 김OO 준비서면 제출", result: "" },
  { date: "20250602", content: "원고 소송대리인 법무법인 더율 담당변호사 임OOOOOO에게 준비서면부본(25.06.02.자) 송달", result: "2025.06.02 도달" },
  { date: "20250604", content: "원고 소송대리인 법OOOOOOOOOO 준비서면 제출", result: "" },
  { date: "20250604", content: "원고 소송대리인 법OOOOOOOOOO 금융거래정보제출명령신청 제출", result: "" },
  { date: "20250604", content: "피고 소송대리인 변호사 김OO에게 준비서면부본(25.06.04.자) 송달", result: "2025.06.05 도달" },
  { date: "20250605", content: "원고 소송대리인 법OOOOOOOOOO 금융거래정보제출명령신청 제출", result: "" },
  { date: "20250618", content: "변론기일(본관 402호 법정 15:00) [일방 화상장치]", result: "속행" },
  { date: "20250620", content: "피고 소송대리인 김OO 준비서면 제출", result: "" },
  { date: "20250620", content: "원고 소송대리인 법무법인 더율 담당변호사 임OOOOOO에게 준비서면부본(25.06.20.자) 송달", result: "2025.06.23 도달" },
  { date: "20250702", content: "변론기일(본관 402호 법정 15:00) [일방 화상장치]", result: "속행" },
  { date: "20250716", content: "변론기일(본관 402호 법정 15:00) [일방 화상장치]", result: "기일변경" },
  { date: "20250716", content: "변론기일(본관 402호 법정 10:30) [일방 화상장치]", result: "속행" },
  { date: "20250730", content: "변론기일(본관 402호 법정 10:30) [일방 화상장치]", result: "기일변경" },
  { date: "20250811", content: "피고 소송대리인 김OO 사실조회신청서 제출", result: "" },
  { date: "20250813", content: "변론기일(본관 402호 법정 10:30) [일방 화상장치]", result: "속행" },
  { date: "20250827", content: "변론기일(본관 402호 법정 10:30) [일방 화상장치]", result: "속행" },
  { date: "20250910", content: "변론기일(본관 402호 법정 10:30) [일방 화상장치]", result: "속행" },
  { date: "20250924", content: "변론기일(본관 402호 법정 10:30) [일방 화상장치]", result: "속행" },
  { date: "20251008", content: "변론기일(본관 402호 법정 10:30) [일방 화상장치]", result: "속행" },
  { date: "20251022", content: "변론기일(본관 402호 법정 10:30) [일방 화상장치]", result: "속행" },
  { date: "20251105", content: "변론기일(본관 402호 법정 10:30) [일방 화상장치]", result: "속행" },
  { date: "20251119", content: "변론기일(본관 402호 법정 10:30) [일방 화상장치]", result: "속행" },
  { date: "20251203", content: "변론기일(본관 402호 법정 10:30) [일방 화상장치]", result: "속행" },
  { date: "20251217", content: "변론기일(본관 402호 법정 10:30) [일방 화상장치]", result: "속행" },
  { date: "20251219", content: "석명준비명령(도과기간확인)", result: "" },
  { date: "20251219", content: "원고 소송대리인 법무법인 더율 담당변호사 임OOOOOO에게 석명준비명령등본 송달", result: "2025.12.23 도달" },
  { date: "20251224", content: "주OOOOOOOOOO 접수증명서", result: "2025.12.24 발급" },
  { date: "20251224", content: "주OOOOOOOOOO 사실조회 회신서 제출", result: "" },
  { date: "20260115", content: "변론기일(본관 402호 법정 11:40) [일방 화상장치]", result: "" },
];

async function main() {
  const caseId = '55d073dc-c376-4db0-b368-35e500291682';  // 2024드단26718

  console.log('='.repeat(60));
  console.log('진행내용 스냅샷 저장');
  console.log('='.repeat(60));
  console.log('사건 ID:', caseId);
  console.log('진행내용 수:', progressData.length);

  // 기존 스냅샷 확인
  const { data: existingSnapshot } = await supabase
    .from('scourt_case_snapshots')
    .select('id')
    .eq('legal_case_id', caseId)
    .single();

  if (existingSnapshot) {
    // 기존 스냅샷 업데이트
    console.log('\n기존 스냅샷 업데이트...');
    const { error } = await supabase
      .from('scourt_case_snapshots')
      .update({
        progress: progressData,
        scraped_at: new Date().toISOString()
      })
      .eq('id', existingSnapshot.id);

    if (error) {
      console.error('업데이트 실패:', error);
    } else {
      console.log('✅ 스냅샷 업데이트 완료!');
    }
  } else {
    // 새 스냅샷 생성
    console.log('\n새 스냅샷 생성...');
    const { error } = await supabase
      .from('scourt_case_snapshots')
      .insert({
        legal_case_id: caseId,
        case_type: 'family',
        basic_info: {
          '사건번호': '2024드단26718',
          '사건명': '[전자]이혼 등',
          '원고': '김OO',
          '피고': '김OO',
          '재판부': '가사4단독',
          '접수일': '2024.04.30',
        },
        progress: progressData,
        hearings: [],
        documents: [],
        scraped_at: new Date().toISOString()
      });

    if (error) {
      console.error('생성 실패:', error);
    } else {
      console.log('✅ 스냅샷 생성 완료!');
    }
  }

  // 확인
  const { data: snapshot } = await supabase
    .from('scourt_case_snapshots')
    .select('id, progress, scraped_at')
    .eq('legal_case_id', caseId)
    .single();

  if (snapshot) {
    console.log('\n저장 확인:');
    console.log('  스냅샷 ID:', snapshot.id);
    console.log('  진행내용 수:', snapshot.progress?.length || 0);
    console.log('  스크래핑 일시:', snapshot.scraped_at);
  }
}

main().catch(console.error);
