/**
 * 과거 데이터 불변기한 백필 스크립트 (테스트용)
 *
 * 기존 court_hearings에서 선고/종결 결과가 있는 기일을 찾아
 * 불변기한(상소기간)을 자동 생성합니다.
 *
 * 실행 방법:
 *   npx tsx scripts/backfill-deadlines.ts [--dry-run] [--tenant-id=xxx]
 *
 * 옵션:
 *   --dry-run: 실제 등록 없이 대상만 확인
 *   --tenant-id=xxx: 특정 테넌트만 처리
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// .env.local 로드
config({ path: '.env.local' });

// Supabase Admin Client (Service Role Key 필요)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('환경변수 설정 필요: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============================================================
// 타입 정의
// ============================================================

interface CourtHearing {
  id: string;
  case_id: string;
  hearing_type: string;
  hearing_date: string;
  result: string | null;
  scourt_result_raw: string | null;
  legal_cases: {
    id: string;
    court_case_number: string;
    tenant_id: string;
  };
}

interface BackfillResult {
  total: number;
  created: number;
  skipped: number;
  errors: string[];
}

// ============================================================
// 선고/종결 판별
// ============================================================

/**
 * 기일 결과가 선고/종결인지 판별
 */
function isJudgmentResult(hearing: CourtHearing): boolean {
  const resultRaw = hearing.scourt_result_raw || '';
  const result = hearing.result || '';
  const hearingType = hearing.hearing_type || '';

  // 선고기일인 경우
  if (hearingType === 'HEARING_JUDGMENT') {
    return true;
  }

  // 결과에 선고/판결/종결 키워드 포함
  const judgmentKeywords = ['선고', '판결', '결정선고', '종결', '변론종결'];
  const combined = `${resultRaw} ${result}`.toLowerCase();

  return judgmentKeywords.some(keyword => combined.includes(keyword));
}

/**
 * 사건번호에서 사건부호 추출
 * 예: "2024드단12345" → "드단"
 */
function extractCaseTypeCode(caseNumber: string): string | null {
  const match = caseNumber.match(/\d{4}([가-힣]+)\d+/);
  return match ? match[1] : null;
}

/**
 * 사건 카테고리 판별
 */
function getCaseCategory(caseNumber: string): 'civil' | 'family' | 'criminal' | 'administrative' | null {
  const code = extractCaseTypeCode(caseNumber);
  if (!code) return null;

  // 형사 사건
  const criminalCodes = ['고단', '고합', '고정', '고약', '초', '노'];
  if (criminalCodes.some(c => code.includes(c))) {
    return 'criminal';
  }

  // 가사 사건
  const familyCodes = ['드', '므', '느', '르', '브', '스', '호'];
  if (familyCodes.some(c => code.includes(c))) {
    return 'family';
  }

  // 민사 사건
  const civilCodes = ['가단', '가합', '가소', '나', '다', '머', '차'];
  if (civilCodes.some(c => code.includes(c))) {
    return 'civil';
  }

  // 행정 사건
  const adminCodes = ['구합', '구단', '누'];
  if (adminCodes.some(c => code.includes(c))) {
    return 'administrative';
  }

  return null;
}

/**
 * 사건 유형에 따른 불변기한 타입 결정
 */
function getDeadlineType(caseNumber: string): { type: string; days: number } | null {
  const category = getCaseCategory(caseNumber);
  const caseTypeCode = extractCaseTypeCode(caseNumber) || '';

  if (category === 'criminal') {
    return { type: 'DL_CRIMINAL_APPEAL', days: 7 };
  }

  // 가사비송 체크
  const familyNonLitCodes = ['르', '브', '스', '조', '즈기', '즈단', '즈합', '호'];
  if (familyNonLitCodes.some(code => caseTypeCode.includes(code))) {
    return { type: 'DL_FAMILY_NONLIT', days: 14 };
  }

  if (category === 'civil' || category === 'family' || category === 'administrative') {
    return { type: 'DL_APPEAL', days: 14 };
  }

  return null;
}

/**
 * 기산일 추출 (선고일 = 기일 날짜, YYYY-MM-DD 형식)
 */
function getTriggerDate(hearing: CourtHearing): string {
  // ISO 형식에서 날짜 부분만 추출
  const date = hearing.hearing_date;
  if (date.includes('T')) {
    return date.split('T')[0];
  }
  return date.slice(0, 10);
}

// ============================================================
// 메인 로직
// ============================================================

async function backfillDeadlines(options: {
  dryRun: boolean;
  tenantId?: string;
}): Promise<BackfillResult> {
  const result: BackfillResult = {
    total: 0,
    created: 0,
    skipped: 0,
    errors: [],
  };

  console.log('========================================');
  console.log('불변기한 백필 스크립트 시작');
  console.log(`모드: ${options.dryRun ? 'DRY RUN (실제 등록 안함)' : '실제 등록'}`);
  if (options.tenantId) {
    console.log(`테넌트: ${options.tenantId}`);
  }
  console.log('========================================\n');

  // 1. 선고/종결 결과가 있는 기일 조회 (legal_cases 조인)
  let query = supabase
    .from('court_hearings')
    .select(`
      id, case_id, hearing_type, hearing_date, result, scourt_result_raw,
      legal_cases!inner (id, court_case_number, tenant_id)
    `)
    .or('hearing_type.eq.HEARING_JUDGMENT,result.eq.CONCLUDED,scourt_result_raw.ilike.%선고%,scourt_result_raw.ilike.%판결%,scourt_result_raw.ilike.%종결%')
    .order('hearing_date', { ascending: false });

  if (options.tenantId) {
    query = query.eq('legal_cases.tenant_id', options.tenantId);
  }

  const { data: hearings, error: hearingsError } = await query;

  if (hearingsError) {
    console.error('기일 조회 실패:', hearingsError);
    result.errors.push(`기일 조회 실패: ${hearingsError.message}`);
    return result;
  }

  console.log(`선고/종결 기일 발견: ${hearings?.length || 0}건\n`);

  if (!hearings || hearings.length === 0) {
    console.log('백필 대상 없음');
    return result;
  }

  // 2. 각 기일에 대해 불변기한 생성 여부 확인
  for (const hearing of hearings) {
    result.total++;

    // 2-1. 선고/종결 결과인지 확인
    if (!isJudgmentResult(hearing)) {
      continue;
    }

    // legal_cases에서 정보 추출
    const caseNumber = hearing.legal_cases.court_case_number;

    // 2-2. 불변기한 타입 결정
    const deadlineInfo = getDeadlineType(caseNumber);
    if (!deadlineInfo) {
      console.log(`  [SKIP] ${caseNumber}: 불변기한 타입 결정 불가`);
      result.skipped++;
      continue;
    }

    // 2-3. 기산일 결정
    const triggerDate = getTriggerDate(hearing);

    // 2-4. 중복 체크
    const { data: existing } = await supabase
      .from('case_deadlines')
      .select('id')
      .eq('case_number', caseNumber)
      .eq('deadline_type', deadlineInfo.type)
      .eq('trigger_date', triggerDate)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`  [SKIP] ${caseNumber}: 이미 등록됨 (${deadlineInfo.type}, ${triggerDate})`);
      result.skipped++;
      continue;
    }

    // 2-5. 불변기한 등록
    console.log(`  [CREATE] ${caseNumber}: ${deadlineInfo.type} (${deadlineInfo.days}일, 기산일: ${triggerDate})`);

    if (!options.dryRun) {
      const { error: insertError } = await supabase
        .from('case_deadlines')
        .insert({
          case_id: hearing.case_id,
          case_number: caseNumber,
          deadline_type: deadlineInfo.type,
          trigger_date: triggerDate,
          notes: '[백필] 기존 선고 기일 기반 자동 생성',
          status: 'PENDING',
        });

      if (insertError) {
        console.error(`    ERROR: ${insertError.message}`);
        result.errors.push(`${caseNumber}: ${insertError.message}`);
        continue;
      }
    }

    result.created++;
  }

  // 3. 결과 출력
  console.log('\n========================================');
  console.log('백필 결과');
  console.log('========================================');
  console.log(`전체 대상: ${result.total}건`);
  console.log(`생성됨: ${result.created}건`);
  console.log(`스킵됨: ${result.skipped}건`);
  if (result.errors.length > 0) {
    console.log(`에러: ${result.errors.length}건`);
    result.errors.forEach(e => console.log(`  - ${e}`));
  }

  return result;
}

// ============================================================
// CLI 실행
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const tenantIdArg = args.find(a => a.startsWith('--tenant-id='));
  const tenantId = tenantIdArg ? tenantIdArg.split('=')[1] : undefined;

  try {
    await backfillDeadlines({ dryRun, tenantId });
  } catch (error) {
    console.error('스크립트 실행 실패:', error);
    process.exit(1);
  }
}

main();
