/**
 * SCOURT API 필드 수집 스크립트
 * 각 사건 유형별 실제 API 응답 필드를 수집하여 문서화
 */

import { getScourtApiClient } from '../lib/scourt/api-client';

interface FieldInfo {
  name: string;
  value: any;
  type: string;
}

interface CaseTypeFields {
  caseType: string;
  category: string;
  description: string;
  basicFields: FieldInfo[];
  listFields: string[];
}

const testCases = [
  // 민사
  { court: '평택지원', year: '2024', type: '가단', serial: '75190', party: '홍강의', category: 'civil', desc: '민사 1심' },
  // 가사
  { court: '평택가정', year: '2025', type: '드단', serial: '20475', party: '엄현식', category: 'family', desc: '가사 1심' },
  { court: '대전고법', year: '2023', type: '르', serial: '1322', party: '이정귀', category: 'family', desc: '가사 항소' },
  // 형사
  { court: '천안지원', year: '2024', type: '고단', serial: '2703', party: '김현성', category: 'criminal', desc: '형사 1심' },
  { court: '대전지법', year: '2025', type: '노', serial: '887', party: '김현성', category: 'criminal', desc: '형사 항소' },
  // 신청/보전
  { court: '평택지원', year: '2024', type: '카확', serial: '1171', party: '제일케미칼', category: 'application', desc: '소송비용확정' },
  { court: '공주지원', year: '2025', type: '카불', serial: '3033', party: '한수연', category: 'application', desc: '채무불이행자명부' },
  // 집행
  { court: '평택지원', year: '2024', type: '타채', serial: '33630', party: '김진성', category: 'execution', desc: '채권압류/추심' },
  // 전자독촉
  { court: '안성시법원', year: '2025', type: '차전', serial: '2850', party: '임승태', category: 'electronicOrder', desc: '전자지급명령' },
  // 회생/파산
  { court: '대전지방법원', year: '2024', type: '개회', serial: '53142', party: '박재형', category: 'insolvency', desc: '개인회생' },
];

async function collectFields() {
  const client = getScourtApiClient();
  const allResults: CaseTypeFields[] = [];

  console.log('SCOURT API 필드 수집 시작\n');
  console.log('='.repeat(80));

  for (const tc of testCases) {
    console.log(`\n[${tc.desc}] ${tc.court} ${tc.year}${tc.type}${tc.serial}`);

    try {
      const result = await client.searchAndRegisterCase({
        cortCd: tc.court,
        csYr: tc.year,
        csDvsCd: tc.type,
        csSerial: tc.serial,
        btprNm: tc.party,
      });

      if (result.success && result.generalData?.raw?.data) {
        const data = result.generalData.raw.data;
        const caseInfo = data.dma_csBasCtt || {};

        // 기본 필드 수집
        const basicFields: FieldInfo[] = Object.keys(caseInfo)
          .sort()
          .map(key => ({
            name: key,
            value: caseInfo[key],
            type: typeof caseInfo[key],
          }))
          .filter(f => f.value !== null && f.value !== undefined && f.value !== '');

        // LIST 필드 수집
        const listFields = Object.keys(data)
          .filter(k => k.startsWith('dlt_') || k.startsWith('dma_'))
          .sort();

        allResults.push({
          caseType: tc.type,
          category: tc.category,
          description: tc.desc,
          basicFields,
          listFields,
        });

        console.log(`  ✅ 수집 완료: ${basicFields.length}개 기본필드, ${listFields.length}개 LIST`);
      } else {
        console.log(`  ❌ 실패: ${result.error || 'unknown'}`);
      }
    } catch (e) {
      console.log(`  ❌ 에러: ${e}`);
    }

    await new Promise(r => setTimeout(r, 2500));
  }

  // 결과 출력
  console.log('\n\n' + '='.repeat(80));
  console.log('필드 수집 결과');
  console.log('='.repeat(80));

  // 모든 필드 합집합
  const allFieldNames = new Set<string>();
  allResults.forEach(r => r.basicFields.forEach(f => allFieldNames.add(f.name)));

  // 카테고리별 필드 매트릭스
  const categories = ['civil', 'family', 'criminal', 'application', 'execution', 'electronicOrder', 'insolvency'];

  console.log('\n## 카테고리별 필드 존재 여부\n');

  const sortedFields = Array.from(allFieldNames).sort();

  // 마크다운 테이블 헤더
  console.log('| 필드명 | 민사 | 가사 | 형사 | 신청 | 집행 | 독촉 | 회생 |');
  console.log('|--------|------|------|------|------|------|------|------|');

  sortedFields.forEach(fieldName => {
    const row = [fieldName.padEnd(24)];
    categories.forEach(cat => {
      const caseResult = allResults.find(r => r.category === cat);
      const hasField = caseResult?.basicFields.some(f => f.name === fieldName);
      row.push(hasField ? ' ✅ ' : '    ');
    });
    console.log('| ' + row.join(' | ') + ' |');
  });

  // 각 카테고리별 상세 필드
  console.log('\n\n## 카테고리별 상세 필드\n');

  for (const cat of categories) {
    const results = allResults.filter(r => r.category === cat);
    if (results.length === 0) continue;

    console.log(`\n### ${cat.toUpperCase()}\n`);

    results.forEach(r => {
      console.log(`#### ${r.description} (${r.caseType})\n`);
      console.log('**기본 필드:**');
      r.basicFields.forEach(f => {
        const valStr = typeof f.value === 'string' ?
          (f.value.length > 40 ? f.value.substring(0, 40) + '...' : f.value) :
          String(f.value);
        console.log(`- \`${f.name}\`: ${valStr}`);
      });
      console.log('\n**LIST 필드:**');
      r.listFields.forEach(f => console.log(`- \`${f}\``));
      console.log('');
    });
  }

  // 주요 필드 매핑 테이블
  console.log('\n\n## 주요 필드 매핑 (한글 라벨)\n');
  console.log('| API 필드명 | 한글 라벨 | 설명 |');
  console.log('|-----------|----------|------|');

  const fieldMappings = [
    // 기본 정보
    ['cortNm', '법원', '법원명'],
    ['userCsNo', '사건번호', '사건번호 (표시용)'],
    ['csNm', '사건명', '사건명'],
    ['jdbnNm', '재판부', '재판부/담당계'],
    ['jdbnTelno', '재판부전화번호', '재판부 전화번호'],
    ['telNo', '전화번호', '집행사건 전화번호'],
    // 당사자
    ['rprsClmntNm', '원고', '대표원고명'],
    ['rprsAcsdNm', '피고', '대표피고명'],
    ['rprsAplcntNm', '신청인', '대표신청인 (회생)'],
    ['rprsRspndnNm', '채권자', '대표채권자 (회생)'],
    ['btprtNm', '피고인', '피고인명 (형사)'],
    ['titRprsPtnr', '원고측라벨', '원고측 당사자 라벨'],
    ['titRprsRqstr', '피고측라벨', '피고측 당사자 라벨'],
    // 일자
    ['csRcptYmd', '접수일', '사건 접수일'],
    ['csUltmtYmd', '종국일', '종국 일자'],
    ['csCfmtnYmd', '확정일', '판결 확정일'],
    ['adjdocRchYmd', '판결도달일', '판결문 도달일'],
    ['aplYmd', '상소일', '상소 제기일'],
    ['aplRjctnYmd', '상소각하일', '상소 각하일'],
    ['dcsnstDlvrYmd', '결정송달일', '결정문 송달일 (집행)'],
    ['csCmdcYmd', '개시결정일', '개시결정일 (회생)'],
    ['crdtrDdlnYmd', '채권이의마감일', '채권이의 마감일 (회생)'],
    ['repayKjDay', '변제계획안일', '변제계획안 인가일 (회생)'],
    // 결과/상태
    ['csUltmtDvsNm', '종국결과', '종국 결과'],
    ['csUltmtDtlCtt', '종국상세', '종국 상세내용'],
    ['csPrsrvYn', '보존여부', '기록 보존 여부'],
    // 금액
    ['stmpAtchAmt', '인지액', '인지액'],
    ['clmntVsml', '원고소가', '원고 소송가액'],
    ['acsdVsml', '피고소가', '피고 소송가액'],
    // 구분
    ['csTkpDvsNm', '수리구분', '수리 구분 (민사)'],
    ['csTkpDvsCdNm', '수리구분', '수리 구분 (가사)'],
    ['csMrgTypNm', '병합구분', '병합 구분'],
    // 형사 전용
    ['prsctrCsNoLstCtt', '검찰사건번호', '검찰 사건번호'],
    ['btprtUltmtThrstCtt', '선고형량', '선고 형량'],
    ['acsApelPrpndYmd', '피고인상소일', '피고인 상소 제기일'],
    ['aplPrpndRsltYmd', '상소결과일', '상소 결과일'],
    // 회생 전용
    ['rhblCmsnrNm', '회생위원', '회생위원명'],
    ['rhblCmsnrTelno', '회생위원전화', '회생위원 전화번호'],
  ];

  fieldMappings.forEach(([field, label, desc]) => {
    console.log(`| \`${field}\` | ${label} | ${desc} |`);
  });
}

collectFields().catch(console.error);
