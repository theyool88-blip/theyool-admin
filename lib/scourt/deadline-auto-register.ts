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
import type { DeadlineType } from '@/types/court-hearing';

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
