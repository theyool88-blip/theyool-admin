require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// 이미지에서 추출한 법원 기일 데이터
const courtHearings = [
  {
    date: '2025-11-06',
    time: '10:30',
    type: '기일',
    caseNumber: '회장부특허원 2024카단9296',
    clientName: '한류자',
    court: '변론기일(10:30) [강남 화삽정치]',
    status: '숙혁'
  },
  {
    date: '2025-11-11',
    time: '10:00',
    type: '기일',
    caseNumber: '석산가전 2025도단50218',
    clientName: '황작욱',
    court: '변론기일(제207호 기사법정 10:00) [일반 화삽정치]',
    status: '기일변경'
  },
  {
    date: '2025-11-11',
    time: '15:00',
    type: '기일',
    caseNumber: '손혜삭(기)',
    clientName: '박지원',
    court: '변론기일(제21호 법정 15:00)',
    status: '기일변경'
  },
  {
    date: '2025-11-11',
    time: '16:00',
    type: '기일',
    caseNumber: '파복자절 2025가단73623',
    clientName: '조이라',
    court: '변경조사기일(315호 변경교섭실 16:00)',
    status: ''
  },
  {
    date: '2025-11-11',
    time: '16:00',
    type: '기일',
    caseNumber: '진앙가전 2025느단3520',
    clientName: '윤영균',
    court: '변론기일(제21호 법정 16:00)',
    status: '변론준결'
  },
  {
    date: '2025-11-11',
    time: '16:00',
    type: '기일',
    caseNumber: '손혜삭(기)',
    clientName: '박지원',
    court: '변론기일(제21호 법정 16:00)',
    status: '변론준결'
  },
  {
    date: '2025-11-12',
    time: '10:10',
    type: '기일',
    caseNumber: '이훈등',
    clientName: '전근석',
    court: '변론기일(제21호 법정 10:10)',
    status: '조정회부(전경)'
  },
  {
    date: '2025-11-12',
    time: '14:00',
    type: '기일',
    caseNumber: '파막가전 2025드단20513',
    clientName: '권병용',
    court: '면접조사기일(313호 가사조사관실 14:00)',
    status: '생방조사'
  },
  {
    date: '2025-11-12',
    time: '15:00',
    type: '기일',
    caseNumber: '진앙가단 2024느단5817',
    clientName: '김영이',
    court: '변론기일(제21호 법정 15:00)',
    status: '변론준결'
  },
  {
    date: '2025-11-20',
    time: '15:10',
    type: '기일',
    caseNumber: '진앙가전 2025느단5823',
    clientName: '권형철',
    court: '변론기일(법정등 제311호 법정 15:10) [일반 화삽정치]',
    status: '변론준결'
  },
  {
    date: '2025-11-20',
    time: '15:20',
    type: '기일',
    caseNumber: '이훈등',
    clientName: '이인산',
    court: '변론기일(법정등 제311호 법정 15:20) [일반 화삽정치]',
    status: '변론준결'
  },
  {
    date: '2025-11-20',
    time: '16:10',
    type: '기일',
    caseNumber: '진앙가전 2024느단16575',
    clientName: '김이란',
    court: '변론기일(법정등 제311호 법정 16:10)',
    status: '숙혁'
  },
  {
    date: '2025-11-21',
    time: null,
    type: '기한',
    caseNumber: '이훈 및 위자료',
    clientName: '전혜진',
    court: '답변서제출기한',
    status: '퍼고1'
  },
  {
    date: '2025-11-21',
    time: null,
    type: '기한',
    caseNumber: '파막가전 2025느단20790',
    clientName: '김태균',
    court: '답변서제출기한',
    status: '퍼고2'
  },
  {
    date: '2025-11-24',
    time: null,
    type: '기한',
    caseNumber: '이훈등',
    clientName: '박연희',
    court: '소취하부동의기한',
    status: '퍼고'
  },
  {
    date: '2025-11-26',
    time: '14:00',
    type: '기일',
    caseNumber: '이훈등',
    clientName: '이혜진',
    court: '한결선고기일(제21호 법정 14:00)',
    status: ''
  },
  {
    date: '2025-11-26',
    time: '14:30',
    type: '기일',
    caseNumber: '파막가전 2025느단20538',
    clientName: '김수란',
    court: '변론기일(제21호 법정 14:30)',
    status: ''
  },
  {
    date: '2025-11-26',
    time: '14:50',
    type: '기일',
    caseNumber: '이훈',
    clientName: '이태경',
    court: '변론기일(제21호 법정 14:50) [일반 화삽정치]',
    status: ''
  },
  {
    date: '2025-11-26',
    time: '15:00',
    type: '기일',
    caseNumber: '파막가전 2024느단22722',
    clientName: '성나연',
    court: '변론기일(분관 402호 법정 15:00) [일반 화삽정치]',
    status: ''
  },
  {
    date: '2025-11-27',
    time: '14:50',
    type: '기일',
    caseNumber: '수원가전법원 2024느단26718',
    clientName: '김진희',
    court: '변론기일(404호 법정 14:50)',
    status: '기일변경(호주자리)'
  },
  {
    date: '2025-11-28',
    time: '09:55',
    type: '기일',
    caseNumber: '이훈등',
    clientName: '전원석',
    court: '한결선고기일(제42호 법정 09:55)',
    status: ''
  }
];

async function findMatchingCases() {
  console.log('🔍 사건번호 매칭 시작...\n');

  // legal_cases에서 모든 사건 가져오기
  const { data: cases, error } = await supabase
    .from('legal_cases')
    .select('id, court_case_number, case_name, client_id');

  if (error) {
    console.error('❌ 사건 조회 실패:', error);
    return;
  }

  console.log(`📊 전체 사건 수: ${cases.length}개\n`);

  let matchCount = 0;
  let insertCount = 0;

  for (const hearing of courtHearings) {
    // 사건번호 추출 (숫자 부분만)
    const extractedNumber = hearing.caseNumber.match(/\d{4}[드느르]\w+\d+/)?.[0];

    // 사건번호로 매칭 시도
    const matchingCase = cases.find(c => {
      if (!c.court_case_number) return false;

      // 정확한 매칭
      if (c.court_case_number === extractedNumber) return true;

      // 부분 매칭 (느->드 오타 처리)
      const normalized = extractedNumber?.replace('느', '드');
      if (c.court_case_number === normalized) return true;

      // 포함 관계
      return c.court_case_number.includes(extractedNumber || '') ||
             extractedNumber?.includes(c.court_case_number);
    });

    if (matchingCase) {
      matchCount++;
      console.log(`✅ 매칭: ${hearing.caseNumber} → ${matchingCase.court_case_number}`);
      console.log(`   의뢰인: ${hearing.clientName} (${hearing.date} ${hearing.time || ''})`);

      // 기일 타입인 경우 court_hearings에 삽입
      if (hearing.type === '기일') {
        try {
          const { error: insertError } = await supabase
            .from('court_hearings')
            .insert({
              case_id: matchingCase.id,
              hearing_type: 'HEARING_MAIN', // 기본값, 필요시 수동 조정
              scheduled_date: hearing.date,
              scheduled_time: hearing.time,
              court_name: hearing.court.split('(')[0] || '수원지방법원',
              notes: hearing.status || null,
              status: 'SCHEDULED'
            });

          if (insertError) {
            console.log(`   ⚠️  삽입 실패: ${insertError.message}`);
          } else {
            insertCount++;
            console.log(`   ✅ 법원기일 추가 완료`);
          }
        } catch (err) {
          console.log(`   ❌ 에러: ${err.message}`);
        }
      }

      console.log('');
    } else {
      console.log(`⚠️  매칭 실패: ${hearing.caseNumber} (${hearing.clientName})`);
    }
  }

  console.log(`\n📈 매칭 결과:`);
  console.log(`   - 전체 일정: ${courtHearings.length}개`);
  console.log(`   - 매칭 성공: ${matchCount}개`);
  console.log(`   - DB 추가: ${insertCount}개`);
}

findMatchingCases();
