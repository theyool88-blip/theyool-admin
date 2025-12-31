import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kqqyipnlkmmprfgygauk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxcXlpcG5sa21tcHJmZ3lnYXVrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjMyNDQyOSwiZXhwIjoyMDc3OTAwNDI5fQ.nmE-asCNpDnxix4ZxyNlEyocJdG8kPEunx9MHOTnXS0'
);

// 케이스노트 데이터 (스크린샷에서 추출)
// 주의: 케이스노트는 "조단"으로 표기하지만 법원은 "즈단"으로 표기함
const caseData = [
  // 스크린샷 1
  { clientName: '최재영', court: '수원가정법원 평택지원', caseNumber: '2024즈단10083' },
  { clientName: '양미석', court: '수원가정법원 평택지원', caseNumber: '2025느2072' },
  { clientName: '박세원', court: '서울가정법원', caseNumber: '2025드단57177' },
  { clientName: '양미석', court: '수원가정법원 평택지원', caseNumber: '2025드단20799' },
  { clientName: '한숙영', court: '서울가정법원', caseNumber: '2025즈단30625' },
  { clientName: '명미정', court: '수원가정법원', caseNumber: '2025즈기181' },
  { clientName: '안병용', court: '수원가정법원 평택지원', caseNumber: '2024느단10878' },
  { clientName: '김지영', court: '대전가정법원 천안지원', caseNumber: '2025즈기446' },
  { clientName: '한수연', court: '수원지방법원 평택지원', caseNumber: '2025카확1397' },
  { clientName: '윤은영', court: '수원가정법원 평택지원', caseNumber: '2025느7' },
  { clientName: '한영미', court: '수원가정법원 평택지원', caseNumber: '2025즈단10057' },
  { clientName: '윤기석', court: '수원지방법원', caseNumber: '2025나56298' },
  { clientName: '이미옥', court: '수원가정법원 평택지원', caseNumber: '2025즈기22' },
  { clientName: '김정언', court: '대전가정법원 천안지원', caseNumber: '2025드단78' },
  { clientName: '이미옥', court: '수원가정법원 평택지원', caseNumber: '2025즈기21' },
  { clientName: '김태일', court: '대전가정법원 천안지원', caseNumber: '2025나3163' },

  // 스크린샷 2
  { clientName: '홍종범', court: '수원가정법원 평택지원', caseNumber: '2025즈기1136' },
  { clientName: '백민지', court: '수원가정법원 평택지원', caseNumber: '2025느단10799' },
  { clientName: '강미자', court: '서울북부지방법원', caseNumber: '2025가단109347' },
  { clientName: '장혜진', court: '수원가정법원 평택지원', caseNumber: '2025드단20734' },
  { clientName: '김지영', court: '대전가정법원 천안지원', caseNumber: '2025느단3513' },
  { clientName: '임승태', court: '수원지방법원 평택지원 안성시법원', caseNumber: '2025차전2850' },
  { clientName: '홍강의', court: '수원가정법원 평택지원', caseNumber: '2025드단20432' },
  { clientName: '한숙영', court: '서울가정법원', caseNumber: '2025드단56066' },
  { clientName: '장혜진', court: '수원가정법원 평택지원', caseNumber: '2025드단20790' },
  { clientName: '임청아', court: '수원가정법원', caseNumber: '2025즈단5380' },
  { clientName: '강호현', court: '대전지방법원 천안지원', caseNumber: '2025카불6034' },
  { clientName: '김지영', court: '대전가정법원 천안지원', caseNumber: '2025느단3520' },
  { clientName: '조주성', court: '수원가정법원 평택지원', caseNumber: '2025드단20908' },
  { clientName: '임청아', court: '수원가정법원', caseNumber: '2025드단22986' },

  // 스크린샷 3
  { clientName: '윤승연', court: '수원지방법원 평택지원', caseNumber: '2025가소75559' },
  { clientName: '송희명', court: '대전가정법원 천안지원', caseNumber: '2025느단174' },
  { clientName: '명미정', court: '수원가정법원', caseNumber: '2025드단1488' },
  { clientName: '김동구', court: '수원가정법원 평택지원', caseNumber: '2025드단20629' },
  { clientName: '박유경', court: '수원가정법원 평택지원', caseNumber: '2025드단20704' },
  { clientName: '한영미', court: '수원가정법원 평택지원', caseNumber: '2025드단20540' },
  { clientName: '정정희', court: '수원가정법원 평택지원', caseNumber: '2025드단20616' },
  { clientName: '장은서', court: '수원가정법원 평택지원', caseNumber: '2025드단20513' },
  { clientName: '이미옥', court: '수원가정법원 평택지원', caseNumber: '2025드단61' },
  { clientName: '박지원', court: '수원지방법원 평택지원', caseNumber: '2025가소73623' },
  { clientName: '엄현식', court: '수원가정법원 평택지원', caseNumber: '2024드단25547' },

  // 추가 (pending 매칭용)
  { clientName: '린유지', court: '', caseNumber: '2024가단109296' },
  { clientName: '이진산', court: '', caseNumber: '2024드단16575' },
  { clientName: '김윤한', court: '', caseNumber: '2024드단26718' },
  { clientName: '박정현', court: '', caseNumber: '2024드단58330' },
  { clientName: '편수지', court: '', caseNumber: '2025가단53626' },
  { clientName: '박지원', court: '', caseNumber: '2025가소73623' },
  { clientName: '김재영', court: '', caseNumber: '2025너2080' },
  { clientName: '조주성', court: '', caseNumber: '2025너2096' },
  { clientName: '김지영', court: '', caseNumber: '2025느단3520' },
  { clientName: '김요한', court: '', caseNumber: '2025드단20433' },
  { clientName: '김근령', court: '', caseNumber: '2025드단20538' },
  { clientName: '이혜진', court: '', caseNumber: '2025드단20579' },
  { clientName: '정정희', court: '', caseNumber: '2025드단20616' },
  { clientName: '김정언', court: '', caseNumber: '2025드단78' },
  { clientName: '장원석', court: '', caseNumber: '2025드합2016' },
];

async function updateCaseCourts() {
  console.log('Starting case court update...');
  console.log(`Total cases to process: ${caseData.length}`);

  let updated = 0;
  let notFound = 0;
  let alreadySet = 0;
  let errors = 0;

  for (const data of caseData) {
    try {
      // 1. 의뢰인 이름으로 clients 테이블에서 찾기
      const { data: clients, error: clientError } = await supabase
        .from('clients')
        .select('id, name')
        .ilike('name', `%${data.clientName}%`);

      if (clientError || !clients || clients.length === 0) {
        console.log(`[NOT FOUND] Client: ${data.clientName}`);
        notFound++;
        continue;
      }

      // 2. 해당 의뢰인의 사건 찾기
      for (const client of clients) {
        const { data: cases, error: caseError } = await supabase
          .from('legal_cases')
          .select('id, case_name, court_name, court_case_number, client_id')
          .eq('client_id', client.id);

        if (caseError || !cases || cases.length === 0) {
          continue;
        }

        for (const legalCase of cases) {
          // 이미 court_case_number가 있으면 스킵 (단, 같은 사건번호면 법원 업데이트)
          if (legalCase.court_case_number === data.caseNumber) {
            // 법원명 업데이트
            if (!legalCase.court_name || legalCase.court_name !== data.court) {
              const { error: updateError } = await supabase
                .from('legal_cases')
                .update({
                  court_name: data.court,
                  updated_at: new Date().toISOString()
                })
                .eq('id', legalCase.id);

              if (!updateError) {
                console.log(`[UPDATED COURT] ${data.clientName}: ${data.caseNumber} -> ${data.court}`);
                updated++;
              }
            } else {
              alreadySet++;
            }
            continue;
          }

          // court_case_number가 비어있으면 채우기
          if (!legalCase.court_case_number) {
            const { error: updateError } = await supabase
              .from('legal_cases')
              .update({
                court_case_number: data.caseNumber,
                court_name: data.court,
                updated_at: new Date().toISOString()
              })
              .eq('id', legalCase.id);

            if (!updateError) {
              console.log(`[UPDATED] ${data.clientName}: ${legalCase.case_name} -> ${data.caseNumber} (${data.court})`);
              updated++;
            } else {
              console.error(`[ERROR] Update failed:`, updateError);
              errors++;
            }
          }
        }
      }
    } catch (err) {
      console.error(`[ERROR] Processing ${data.clientName}:`, err);
      errors++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Updated: ${updated}`);
  console.log(`Already set: ${alreadySet}`);
  console.log(`Not found: ${notFound}`);
  console.log(`Errors: ${errors}`);
}

updateCaseCourts();
