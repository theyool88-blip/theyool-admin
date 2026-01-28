/**
 * SCOURT 자동 기한 등록 모듈
 *
 * SCOURT 업데이트 감지 시 법정 불변기간을 자동으로 case_deadlines에 등록
 *
 * 지원 불변기간:
 * - DL_APPEAL: 민사/가사소송 상소기간 (14일) - 판결 송달일 기준
 * - DL_CRIMINAL_APPEAL: 형사 상소기간 (7일) - 판결 선고일 기준
 * - DL_FAMILY_NONLIT: 가사비송 즉시항고 (14일) - 심판 고지일 기준
 * - DL_MEDIATION_OBJ: 조정·화해 이의기간 (14일) - 조정일 기준
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { createCaseDeadline } from '@/lib/supabase/case-deadlines';
import type { CaseUpdate, UpdateType } from './change-detector';
import { getCaseTypeByCode, type CaseCategory } from './case-types';
import type { DeadlineType, PartySide } from '@/types/court-hearing';
import type { PartyType } from '@/types/case-party';
import { PLAINTIFF_SIDE_TYPES, DEFENDANT_SIDE_TYPES } from '@/types/case-party';

// ============================================================
// 타입 정의
// ============================================================

interface DeadlineMapping {
  deadlineType: DeadlineType;
  days: number;
  triggerEvent: string;
}

interface AutoRegisterResult {
  registered: number;
  skipped: number;
  errors: string[];
  details: Array<{
    deadlineType: DeadlineType;
    triggerDate: string;
    status: 'registered' | 'skipped' | 'error';
    reason?: string;
  }>;
}

// ============================================================
// 사건 유형 판별
// ============================================================

/**
 * 사건번호에서 사건부호 추출
 * 예: "2024드단12345" → "드단"
 */
function extractCaseTypeCode(caseNumber: string): string | null {
  // 연도(4자리) + 사건부호 + 일련번호 형식
  const match = caseNumber.match(/\d{4}([가-힣]+)\d+/);
  return match ? match[1] : null;
}

/**
 * 사건번호로 사건 카테고리 판별
 */
export function getCaseCategoryFromNumber(caseNumber: string): CaseCategory | null {
  const caseTypeCode = extractCaseTypeCode(caseNumber);
  if (!caseTypeCode) return null;

  const caseType = getCaseTypeByCode(caseTypeCode);
  return caseType?.category || null;
}

/**
 * 사건 유형별 상소기간 기한 유형 결정
 *
 * 핵심 차이점:
 * - 민사/가사소송: 14일 (DL_APPEAL)
 * - 형사: 7일 (DL_CRIMINAL_APPEAL) - 형소법 §358
 * - 가사비송: 14일 (DL_FAMILY_NONLIT) - 심판에 대한 즉시항고
 */
function getAppealDeadlineMapping(
  caseNumber: string,
  category: CaseCategory | null
): DeadlineMapping | null {
  const caseTypeCode = extractCaseTypeCode(caseNumber);
  if (!caseTypeCode) return null;

  // 형사 사건 (7일)
  if (category === 'criminal') {
    return {
      deadlineType: 'DL_CRIMINAL_APPEAL',
      days: 7,
      triggerEvent: '판결 선고일',
    };
  }

  // 가사비송 사건 (르, 브 등) - 심판에 대한 즉시항고 (14일)
  // 가사비송: 르, 브, 스, 조, 즈기, 즈단, 즈합, 호 계열
  const familyNonLitCodes = ['르', '브', '스', '조', '즈기', '즈단', '즈합', '호', '호기', '호명', '호파', '호협'];
  if (familyNonLitCodes.some(code => caseTypeCode.includes(code))) {
    return {
      deadlineType: 'DL_FAMILY_NONLIT',
      days: 14,
      triggerEvent: '심판 고지일',
    };
  }

  // 민사/가사소송 (14일)
  if (category === 'civil' || category === 'family' || category === 'administrative') {
    return {
      deadlineType: 'DL_APPEAL',
      days: 14,
      triggerEvent: '판결 송달일',
    };
  }

  return null;
}

// ============================================================
// 업데이트 유형별 기한 매핑
// ============================================================

/**
 * SCOURT 업데이트 유형에서 자동 생성할 기한 결정
 */
function getDeadlineMappingForUpdate(
  updateType: UpdateType,
  caseNumber: string,
  details: Record<string, unknown>
): DeadlineMapping | null {
  const category = getCaseCategoryFromNumber(caseNumber);

  switch (updateType) {
    case 'result_announced':
      // 판결/결정 선고 → 상소기간 등록
      // 형사: 선고일 기준, 민사/가사: 송달일 기준 (extractTriggerDate에서 처리)

      // 방어적 검증: 실제 판결/결정인지 확인
      // "기일", "예정", "준비" 등이 포함된 경우 상소기간 등록하지 않음
      const resultContent = (details?.content as string | undefined) || '';
      const resultSummary = (details?.updateSummary as string | undefined) || '';
      const combinedText = `${resultContent} ${resultSummary}`;

      // 기일 관련 또는 미래형 표현이면 무시
      if (
        combinedText.includes('기일') ||
        combinedText.includes('예정') ||
        combinedText.includes('준비') ||
        combinedText.includes('작성')
      ) {
        console.log(`[SCOURT] 상소기간 등록 스킵 - 실제 판결 아님: ${combinedText.substring(0, 50)}`);
        return null;
      }

      return getAppealDeadlineMapping(caseNumber, category);

    case 'served':
    case 'document_served':
      // 판결문/결정문 송달 도달 → 민사/가사의 경우 상소기간 등록
      // 형사는 선고일 기준이므로 제외
      if (category === 'criminal') {
        return null;
      }
      // 판결문/결정문 송달인지 확인
      const content = (details?.content as string | undefined) || '';
      const summary = (details?.updateSummary as string | undefined) || '';
      if (
        content.includes('판결') ||
        content.includes('결정') ||
        summary.includes('판결') ||
        summary.includes('결정')
      ) {
        return getAppealDeadlineMapping(caseNumber, category);
      }
      return null;

    case 'hearing_result':
      // 기일 결과 중 조정 성립 → 조정 이의기간
      const resultText = (details?.result as string | undefined) || '';
      if (
        resultText.includes('조정') ||
        resultText.includes('화해') ||
        resultText.includes('조정성립')
      ) {
        return {
          deadlineType: 'DL_MEDIATION_OBJ',
          days: 14,
          triggerEvent: '조정 성립일',
        };
      }
      return null;

    default:
      return null;
  }
}

/**
 * 0시 도달 여부 확인 (전자송달 의제 / 공시송달)
 *
 * SCOURT 나의사건검색 주의문:
 * "송달결과는 '0시 도달'로 나타나는 경우에는 기간 계산 시 초일이 산입된다"
 *
 * @param result 송달 결과 문자열 (예: "2025.04.08 0시 도달")
 * @returns true면 초일산입 적용 필요
 */
function isZeroHourService(result: string | undefined | null): boolean {
  if (!result) return false;
  return result.includes('0시 도달');
}

/**
 * 날짜 문자열 정규화 (YYYY.MM.DD 또는 YYYY-MM-DD → YYYY-MM-DD)
 */
function normalizeDate(dateStr: string | undefined | null): string | null {
  if (!dateStr) return null;

  // YYYY.MM.DD 형식
  const dotMatch = dateStr.match(/(\d{4})\.(\d{2})\.(\d{2})/);
  if (dotMatch) {
    return `${dotMatch[1]}-${dotMatch[2]}-${dotMatch[3]}`;
  }

  // YYYY-MM-DD 형식 (이미 정규화됨)
  const dashMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (dashMatch) {
    return dateStr;
  }

  return null;
}

/**
 * 업데이트에서 기산일 추출
 *
 * 기산일 우선순위:
 * 1. 형사 사건: 선고일/결정일 (판결도달일 무시)
 * 2. 민사/가사 사건: 판결도달일(송달일) > 선고일 (fallback)
 * 3. 송달 도달 업데이트: 도달일
 */
function extractTriggerDate(
  updateType: UpdateType,
  details: Record<string, unknown>,
  caseNumber?: string
): string | null {
  const category = caseNumber ? getCaseCategoryFromNumber(caseNumber) : null;

  // 1. 송달 도달 업데이트인 경우 - 도달일/송달일 추출
  if (updateType === 'served' || updateType === 'document_served') {
    // result에 "도달" 날짜가 있는 경우 (예: "2025.01.10 도달")
    const result = details?.result as string | undefined;
    if (result) {
      const date = normalizeDate(result);
      if (date) return date;
    }

    // date 필드에 날짜가 있는 경우
    const date = normalizeDate(details?.date as string | undefined);
    if (date) return date;

    // content에서 날짜 추출
    const content = details?.content as string | undefined;
    if (content) {
      const dateFromContent = normalizeDate(content);
      if (dateFromContent) return dateFromContent;
    }
  }

  // 2. 판결/결정 선고 업데이트인 경우
  if (updateType === 'result_announced') {
    // 2-1. 형사 사건: 선고일 사용 (판결도달일 무시)
    if (category === 'criminal') {
      const dateMatch = JSON.stringify(details).match(/(\d{4})\.(\d{2})\.(\d{2})/);
      if (dateMatch) {
        return `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
      }
    }

    // 2-2. 민사/가사 사건: 판결도달일(송달일) 우선
    // 판결도달일 필드 확인 (jdgArvDt, 판결도달일, adjdocRchYmd)
    const jdgArvDt = normalizeDate(
      (details?.jdgArvDt as string | undefined) ||
      (details?.['판결도달일'] as string | undefined) ||
      (details?.adjdocRchYmd as string | undefined)
    );
    if (jdgArvDt) {
      console.log(`[SCOURT] 판결도달일(송달일) 사용: ${jdgArvDt}`);
      return jdgArvDt;
    }

    // 결정송달일 확인
    const dcsnstDlvrYmd = normalizeDate(
      (details?.dcsnstDlvrYmd as string | undefined) ||
      (details?.['결정송달일'] as string | undefined)
    );
    if (dcsnstDlvrYmd) {
      console.log(`[SCOURT] 결정송달일 사용: ${dcsnstDlvrYmd}`);
      return dcsnstDlvrYmd;
    }

    // Fallback: 선고일/결정일 (민사/가사도 송달일 없으면 사용)
    const dateMatch = JSON.stringify(details).match(/(\d{4})\.(\d{2})\.(\d{2})/);
    if (dateMatch) {
      console.log(`[SCOURT] 송달일 없음 - 선고일 사용 (민사/가사 주의필요): ${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`);
      return `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    }
  }

  // 3. 기일 결과에서 날짜 추출 (조정 성립 등)
  if (updateType === 'hearing_result' && details?.date) {
    const date = normalizeDate(details.date as string);
    if (date) return date;
  }

  // 기본값: 오늘 날짜 (정확한 날짜를 찾지 못한 경우)
  console.warn(`[SCOURT] 기산일 추출 실패 - 오늘 날짜 사용 (updateType: ${updateType})`);
  return new Date().toISOString().split('T')[0];
}

// ============================================================
// 중복 체크
// ============================================================

/**
 * 이미 등록된 기한인지 확인
 */
async function isDuplicateDeadline(
  caseNumber: string,
  deadlineType: DeadlineType,
  triggerDate: string,
  scourtUpdateId?: string
): Promise<boolean> {
  const supabase = createAdminClient();

  // scourt_update_id로 중복 체크
  if (scourtUpdateId) {
    const { data: updateData } = await supabase
      .from('case_deadlines')
      .select('id')
      .eq('scourt_update_id', scourtUpdateId)
      .limit(1);

    if (updateData !== null && updateData.length > 0) {
      return true;
    }
  }

  // case_number + deadline_type + trigger_date로 중복 체크
  const { data: existingData } = await supabase
    .from('case_deadlines')
    .select('id')
    .eq('case_number', caseNumber)
    .eq('deadline_type', deadlineType)
    .eq('trigger_date', triggerDate)
    .limit(1);

  return existingData !== null && existingData.length > 0;
}

// ============================================================
// 메인 함수
// ============================================================

/**
 * SCOURT 업데이트에서 자동으로 불변기간 등록
 *
 * @param caseNumber - 사건번호 (예: "2024드단12345")
 * @param updates - 감지된 업데이트 목록
 * @param scourtUpdateId - SCOURT 업데이트 ID (중복 방지용, optional)
 * @param tenantId - 테넌트 ID (필수)
 */
export async function autoRegisterDeadlines(
  caseNumber: string,
  updates: CaseUpdate[],
  scourtUpdateId?: string,
  tenantId?: string
): Promise<AutoRegisterResult> {
  const result: AutoRegisterResult = {
    registered: 0,
    skipped: 0,
    errors: [],
    details: [],
  };

  if (!tenantId) {
    result.errors.push('tenantId가 필요합니다');
    return result;
  }

  // court_case_number + tenant_id로 case_id 조회
  const supabaseForCase = createAdminClient();
  const { data: caseData } = await supabaseForCase
    .from('legal_cases')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('court_case_number', caseNumber)
    .single();

  const caseId = caseData?.id;

  if (!caseId) {
    result.errors.push(`사건을 찾을 수 없음: ${caseNumber}`);
    return result;
  }

  for (const update of updates) {
    // 해당 업데이트에서 생성할 기한 결정
    const mapping = getDeadlineMappingForUpdate(
      update.updateType,
      caseNumber,
      update.details
    );

    if (!mapping) {
      continue; // 기한 생성 대상 아님
    }

    // 기산일 추출 (사건유형에 따라 선고일/송달일 결정)
    const triggerDate = extractTriggerDate(update.updateType, update.details, caseNumber);
    if (!triggerDate) {
      result.errors.push(`기산일 추출 실패: ${update.updateType}`);
      result.details.push({
        deadlineType: mapping.deadlineType,
        triggerDate: '',
        status: 'error',
        reason: '기산일 추출 실패',
      });
      continue;
    }

    // 중복 체크
    const isDuplicate = await isDuplicateDeadline(
      caseNumber,
      mapping.deadlineType,
      triggerDate,
      scourtUpdateId
    );

    if (isDuplicate) {
      result.skipped++;
      result.details.push({
        deadlineType: mapping.deadlineType,
        triggerDate,
        status: 'skipped',
        reason: '이미 등록된 기한',
      });
      continue;
    }

    // 0시 도달 여부 확인 (전자송달 의제 / 공시송달)
    const deliveryResult = (update.details?.result as string | undefined) || '';
    const isZeroHour = isZeroHourService(deliveryResult);

    // 기한 등록
    try {
      await createCaseDeadline({
        case_id: caseId,
        case_number: caseNumber,
        deadline_type: mapping.deadlineType,
        trigger_date: triggerDate,
        notes: `[SCOURT 자동등록] ${mapping.triggerEvent} 기준${isZeroHour ? ' (0시 도달 - 초일산입)' : ''}`,
        is_electronic_service: isZeroHour,
      }, tenantId);

      // scourt_update_id 연결 (컬럼이 추가된 경우)
      if (scourtUpdateId) {
        const supabase = createAdminClient();
        await supabase
          .from('case_deadlines')
          .update({ scourt_update_id: scourtUpdateId })
          .eq('case_number', caseNumber)
          .eq('deadline_type', mapping.deadlineType)
          .eq('trigger_date', triggerDate)
          .is('scourt_update_id', null);
      }

      result.registered++;
      result.details.push({
        deadlineType: mapping.deadlineType,
        triggerDate,
        status: 'registered',
      });

      console.log(
        `[SCOURT] 기한 자동등록: ${caseNumber} - ${mapping.deadlineType} (${mapping.days}일, 기산일: ${triggerDate}${isZeroHour ? ', 0시 도달 - 초일산입' : ''})`
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`기한 등록 실패: ${mapping.deadlineType} - ${errorMsg}`);
      result.details.push({
        deadlineType: mapping.deadlineType,
        triggerDate,
        status: 'error',
        reason: errorMsg,
      });
    }
  }

  return result;
}

/**
 * 사건 유형 정보 조회 (디버깅용)
 */
export function getCaseTypeInfo(caseNumber: string): {
  caseTypeCode: string | null;
  category: CaseCategory | null;
  appealDeadline: DeadlineMapping | null;
} {
  const caseTypeCode = extractCaseTypeCode(caseNumber);
  const category = getCaseCategoryFromNumber(caseNumber);
  const appealDeadline = getAppealDeadlineMapping(caseNumber, category);

  return {
    caseTypeCode,
    category,
    appealDeadline,
  };
}

// ============================================================
// 판결 결과 파싱 및 항소 가능 측 결정
// ============================================================

/**
 * 판결 결과에 따른 항소 가능 측
 *
 * - plaintiff_only: 원고측만 항소 가능 (피고 전부 승소, 각하/기각)
 * - defendant_only: 피고측만 항소 가능 (원고 전부 승소)
 * - both: 양측 모두 항소 가능 (일부 승소)
 * - none: 항소 불가 (조정/화해 성립, 취하 등)
 */
export type AppealableSide = 'plaintiff_only' | 'defendant_only' | 'both' | 'none';

/**
 * 종국결과(case_result) 텍스트를 파싱하여 항소 가능 측 결정
 *
 * SCOURT에서 제공되는 종국결과 예시:
 * - 원고 전부 승소: "원고승", "청구인용", "전부인용", "신청인용"
 * - 피고 전부 승소: "원고패", "피고승", "청구기각", "전부기각", "신청기각"
 * - 일부 승소: "원고일부승", "일부인용", "일부기각"
 * - 각하: "각하", "소각하", "신청각하"
 * - 조정/화해: "조정성립", "화해성립", "화해권고결정"
 * - 취하: "취하", "소취하"
 *
 * @param caseResult - legal_cases.case_result 값
 * @returns 항소 가능 측
 */
export function parseJudgmentOutcome(caseResult: string | null | undefined): AppealableSide {
  if (!caseResult) return 'both'; // 결과 미확정 → 일단 양측 모두 생성

  const result = caseResult.trim();

  // 조정/화해 성립 → 항소 불가 (14일 이의기간은 별도 처리)
  if (
    result.includes('조정성립') ||
    result.includes('화해성립') ||
    result.includes('화해권고')
  ) {
    return 'none';
  }

  // 취하 → 항소 불가
  if (result.includes('취하')) {
    return 'none';
  }

  // 각하 → 원고측만 항소 가능
  if (result.includes('각하')) {
    return 'plaintiff_only';
  }

  // 일부 승소/인용/기각 → 양측 모두 항소 가능
  if (
    result.includes('일부승') ||
    result.includes('일부인용') ||
    result.includes('일부기각') ||
    result.includes('일부패')
  ) {
    return 'both';
  }

  // 원고 전부 승소 → 피고측만 항소 가능
  // 주의: "원고일부승"은 위에서 먼저 체크됨
  if (
    result === '원고승' ||
    result.includes('전부인용') ||
    result === '청구인용' ||
    result === '신청인용' ||
    (result.includes('인용') && !result.includes('일부') && !result.includes('기각'))
  ) {
    return 'defendant_only';
  }

  // 피고 전부 승소 → 원고측만 항소 가능
  if (
    result === '원고패' ||
    result === '피고승' ||
    result.includes('전부기각') ||
    result === '청구기각' ||
    result === '신청기각' ||
    (result.includes('기각') && !result.includes('일부') && !result.includes('인용'))
  ) {
    return 'plaintiff_only';
  }

  // 그 외 불명확한 결과 → 양측 모두 생성 (안전하게)
  console.log(`[SCOURT] 판결결과 파싱 불명확 - 양측 모두 기한 생성: "${result}"`);
  return 'both';
}

/**
 * 해당 측이 항소 가능한지 확인
 */
export function canAppeal(
  appealableSide: AppealableSide,
  partySide: PartySide
): boolean {
  if (appealableSide === 'none') return false;
  if (appealableSide === 'both') return true;
  if (appealableSide === 'plaintiff_only' && partySide === 'plaintiff_side') return true;
  if (appealableSide === 'defendant_only' && partySide === 'defendant_side') return true;
  return false;
}

// ============================================================
// 당사자별 기한 관리
// ============================================================

/**
 * PartyType에서 PartySide 결정
 *
 * @/types/case-party의 중앙집중화된 상수 사용:
 * - PLAINTIFF_SIDE_TYPES: plaintiff, creditor, applicant, actor, appellant, investigator
 * - DEFENDANT_SIDE_TYPES: defendant, debtor, respondent, third_debtor, accused, juvenile, appellee, victim, crime_victim
 *
 * 주의: 상소권이 없는 당사자는 기한 생성에서 제외됨
 * - victim, crime_victim: 형사사건 피해자 (상소권 없음)
 * - investigator: 보호사건 조사관 (상소권 없음)
 * - assistant, related: 중립 당사자 (상소권 없음)
 */
export function getPartySideFromType(partyType: PartyType): PartySide {
  // 상소권이 없는 당사자 유형 - 기한 생성 제외
  const noAppealRightsTypes: PartyType[] = [
    'victim',        // 보호사건 피해자
    'crime_victim',  // 형사사건 피해자
    'investigator',  // 보호사건 조사관
    'assistant',     // 보조인
    'related',       // 관련자
  ];

  if (noAppealRightsTypes.includes(partyType)) {
    return null;
  }

  // 중앙집중화된 상수 사용 (Set이므로 .has() 메서드 사용)
  if (PLAINTIFF_SIDE_TYPES.has(partyType)) {
    return 'plaintiff_side';
  }

  if (DEFENDANT_SIDE_TYPES.has(partyType)) {
    return 'defendant_side';
  }

  // 알 수 없는 유형 (미래에 추가될 수 있음)
  return null;
}

/**
 * 당사자별 상소기간 기한 생성
 *
 * case_parties에서 adjdoc_rch_ymd(판결도달일)가 있는 당사자들을 조회하고
 * 판결 결과(case_result)를 확인하여 항소 가능한 측에만 기한을 생성합니다.
 *
 * 판결 결과에 따른 기한 생성 규칙:
 * - 원고 전부 승소 → 피고측만 항소 기한 생성
 * - 피고 전부 승소/각하 → 원고측만 항소 기한 생성
 * - 일부 승소 → 양측 모두 항소 기한 생성
 * - 조정/화해/취하 → 항소 기한 생성 안함
 *
 * @param caseId - 사건 ID (legal_cases.id)
 * @param caseNumber - 사건번호
 * @param tenantId - 테넌트 ID
 * @returns 생성된 기한 수
 */
export async function createPartySpecificDeadlines(
  caseId: string,
  caseNumber: string,
  tenantId: string
): Promise<{
  created: number;
  skipped: number;
  filtered: number;
  errors: string[];
}> {
  const result = { created: 0, skipped: 0, filtered: 0, errors: [] as string[] };
  const supabase = createAdminClient();

  // 1. 사건의 판결 결과(case_result) 조회
  const { data: legalCase, error: caseError } = await supabase
    .from('legal_cases')
    .select('case_result')
    .eq('id', caseId)
    .single();

  if (caseError) {
    result.errors.push(`사건 조회 실패: ${caseError.message}`);
    return result;
  }

  // 2. 판결 결과 파싱하여 항소 가능 측 결정
  const appealableSide = parseJudgmentOutcome(legalCase?.case_result);
  console.log(`[SCOURT] 판결결과: "${legalCase?.case_result || '미확정'}" → 항소가능측: ${appealableSide}`);

  // 조정/화해/취하 등 항소 불가 케이스
  if (appealableSide === 'none') {
    console.log(`[SCOURT] 항소 불가 사건 (조정/화해/취하) - 기한 생성 스킵: ${caseNumber}`);
    return result;
  }

  // 3. 해당 사건의 당사자들 중 adjdoc_rch_ymd가 있는 당사자 조회
  const { data: parties, error: partiesError } = await supabase
    .from('case_parties')
    .select('id, party_name, party_type, party_type_label, adjdoc_rch_ymd')
    .eq('case_id', caseId)
    .not('adjdoc_rch_ymd', 'is', null)
    .order('party_order', { ascending: true });

  if (partiesError) {
    result.errors.push(`당사자 조회 실패: ${partiesError.message}`);
    return result;
  }

  if (!parties || parties.length === 0) {
    console.log(`[SCOURT] 판결도달일이 있는 당사자 없음: ${caseNumber}`);
    return result;
  }

  // 4. 사건 유형에 따른 기한 타입 결정
  const category = getCaseCategoryFromNumber(caseNumber);
  const deadlineMapping = getAppealDeadlineMapping(caseNumber, category);

  if (!deadlineMapping) {
    console.log(`[SCOURT] 상소기간 해당 없는 사건유형: ${caseNumber}`);
    return result;
  }

  // 5. 각 당사자별로 항소 가능 여부 확인 후 기한 생성
  for (const party of parties) {
    const triggerDate = normalizeDate(party.adjdoc_rch_ymd);
    if (!triggerDate) {
      result.errors.push(`날짜 형식 오류: ${party.party_name} - ${party.adjdoc_rch_ymd}`);
      continue;
    }

    // 당사자 측 결정
    const partySide = getPartySideFromType(party.party_type as PartyType);

    // 판결 결과에 따라 이 당사자가 항소 가능한지 확인
    if (!canAppeal(appealableSide, partySide)) {
      result.filtered++;
      console.log(
        `[SCOURT] 항소 불가 당사자 - 기한 생성 스킵: ${party.party_name} (${partySide}, 판결결과: ${legalCase?.case_result})`
      );
      continue;
    }

    // 중복 체크 (party_id + deadline_type + trigger_date)
    const { data: existing } = await supabase
      .from('case_deadlines')
      .select('id')
      .eq('party_id', party.id)
      .eq('deadline_type', deadlineMapping.deadlineType)
      .eq('trigger_date', triggerDate)
      .limit(1);

    if (existing && existing.length > 0) {
      result.skipped++;
      console.log(`[SCOURT] 기존 기한 존재 - 스킵: ${party.party_name}`);
      continue;
    }

    // 기한 생성
    try {
      await createCaseDeadline({
        case_id: caseId,
        case_number: caseNumber,
        deadline_type: deadlineMapping.deadlineType,
        trigger_date: triggerDate,
        notes: `[SCOURT 자동등록] ${party.party_type_label || party.party_type} ${party.party_name} - ${deadlineMapping.triggerEvent} 기준`,
        party_id: party.id,
        party_side: partySide,
      }, tenantId);

      result.created++;
      console.log(
        `[SCOURT] 당사자별 기한 생성: ${caseNumber} - ${party.party_name} (${deadlineMapping.deadlineType}, 기산일: ${triggerDate})`
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`${party.party_name}: ${errorMsg}`);
    }
  }

  return result;
}

/**
 * 특정 당사자의 판결도달일 변경 시 기한 업데이트/생성
 *
 * party-sync.ts에서 adjdoc_rch_ymd 변경 감지 시 호출
 * 판결 결과(case_result)를 확인하여 항소 가능한 측에만 기한 생성
 *
 * @param partyId - 당사자 ID
 * @param newTriggerDate - 새 판결도달일 (YYYY-MM-DD)
 * @param tenantId - 테넌트 ID
 */
export async function updatePartyDeadline(
  partyId: string,
  newTriggerDate: string,
  tenantId: string
): Promise<{ updated: boolean; created: boolean; filtered: boolean; error?: string }> {
  const supabase = createAdminClient();

  // 1. 당사자 정보 조회 (판결결과 포함)
  const { data: party, error: partyError } = await supabase
    .from('case_parties')
    .select(`
      id,
      party_name,
      party_type,
      party_type_label,
      case_id,
      legal_cases!inner (
        court_case_number,
        case_result
      )
    `)
    .eq('id', partyId)
    .single();

  if (partyError || !party) {
    return { updated: false, created: false, filtered: false, error: `당사자 조회 실패: ${partyError?.message}` };
  }

  // Supabase의 !inner 조인 결과 타입 추출
  const legalCases = party.legal_cases as unknown as { court_case_number: string; case_result: string | null } | null;
  if (!legalCases) {
    return { updated: false, created: false, filtered: false, error: '사건 정보 없음' };
  }
  const caseNumber = legalCases.court_case_number;
  const caseResult = legalCases.case_result;

  // 2. 판결 결과 파싱하여 항소 가능 측 결정
  const appealableSide = parseJudgmentOutcome(caseResult);
  const partySide = getPartySideFromType(party.party_type as PartyType);

  // 3. 항소 불가한 경우 기한 생성/업데이트 스킵
  if (!canAppeal(appealableSide, partySide)) {
    console.log(
      `[SCOURT] 항소 불가 당사자 - 기한 생성 스킵: ${party.party_name} (${partySide}, 판결결과: ${caseResult})`
    );
    return { updated: false, created: false, filtered: true };
  }

  // 4. 기한 타입 결정
  const category = getCaseCategoryFromNumber(caseNumber);
  const deadlineMapping = getAppealDeadlineMapping(caseNumber, category);

  if (!deadlineMapping) {
    return { updated: false, created: false, filtered: false, error: '상소기간 해당 없는 사건유형' };
  }

  // 5. 해당 당사자의 기존 기한 조회
  const { data: existingDeadlines } = await supabase
    .from('case_deadlines')
    .select('id, trigger_date')
    .eq('party_id', partyId)
    .eq('deadline_type', deadlineMapping.deadlineType)
    .limit(1);

  // 6. 기존 기한이 있으면 업데이트, 없으면 새로 생성
  if (existingDeadlines && existingDeadlines.length > 0) {
    const existing = existingDeadlines[0];

    // 기산일이 동일하면 스킵
    if (existing.trigger_date === newTriggerDate) {
      return { updated: false, created: false, filtered: false };
    }

    // 기산일 업데이트 (deadline_date는 트리거로 자동 계산됨)
    const { error: updateError } = await supabase
      .from('case_deadlines')
      .update({
        trigger_date: newTriggerDate,
        notes: `[SCOURT 자동등록] ${party.party_type_label || party.party_type} ${party.party_name} - ${deadlineMapping.triggerEvent} 기준 (업데이트됨)`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (updateError) {
      return { updated: false, created: false, filtered: false, error: updateError.message };
    }

    console.log(`[SCOURT] 당사자 기한 업데이트: ${caseNumber} - ${party.party_name} (${existing.trigger_date} → ${newTriggerDate})`);
    return { updated: true, created: false, filtered: false };
  }

  // 새 기한 생성
  try {
    await createCaseDeadline({
      case_id: party.case_id,
      case_number: caseNumber,
      deadline_type: deadlineMapping.deadlineType,
      trigger_date: newTriggerDate,
      notes: `[SCOURT 자동등록] ${party.party_type_label || party.party_type} ${party.party_name} - ${deadlineMapping.triggerEvent} 기준`,
      party_id: partyId,
      party_side: partySide,
    }, tenantId);

    console.log(`[SCOURT] 당사자 기한 생성: ${caseNumber} - ${party.party_name} (${newTriggerDate})`);
    return { updated: false, created: true, filtered: false };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { updated: false, created: false, filtered: false, error: errorMsg };
  }
}
