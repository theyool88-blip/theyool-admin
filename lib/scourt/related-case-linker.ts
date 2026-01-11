/**
 * 심급/연관 사건 자동 연결 모듈
 *
 * 모든 경로(search, sync, batch-create, batch-create-stream)에서
 * 일관된 연관사건 처리를 보장하기 위한 공통 모듈
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  SCOURT_RELATION_MAP,
  determineRelationDirection,
  shouldUpdateMainCase,
  inferCaseLevelFromType,
  CaseRelationType,
} from './case-relations';
import { parseCaseNumber } from './case-number-utils';

// ============================================================
// 타입 정의
// ============================================================

export interface RelatedCaseData {
  caseNo: string;
  caseName?: string;
  relation?: string;
  encCsNo?: string | null;
  linkedCaseId?: string | null;
}

export interface LowerCourtData {
  caseNo: string;
  courtName?: string;
  court?: string;
  result?: string;
  resultDate?: string;
  encCsNo?: string | null;
  linkedCaseId?: string | null;
}

export interface LinkRelatedCasesParams {
  supabase: SupabaseClient;
  legalCaseId: string;
  tenantId: string;
  caseNumber: string;
  caseType: string;
  relatedCases: RelatedCaseData[];
  lowerCourt: LowerCourtData[];
}

export interface LinkRelatedCasesResult {
  linkedRelatedCases: number;
  linkedLowerCourt: number;
  unlinkedRelatedCases: RelatedCaseData[];
  unlinkedLowerCourt: LowerCourtData[];
  mainCaseId?: string;
  errors: string[];
}

interface FoundCase {
  id: string;
  court_case_number: string;
  case_level?: string;
  main_case_id?: string;
}

// ============================================================
// 내부 유틸리티 함수
// ============================================================

/**
 * 사건번호를 ILIKE 패턴으로 변환
 */
function buildCaseNumberPattern(caseNo: string): string | null {
  const parsed = parseCaseNumber(caseNo);
  if (parsed.valid) {
    return `%${parsed.year}%${parsed.caseType}%${parsed.serial}%`;
  }
  if (parsed.normalized) {
    return `%${parsed.normalized}%`;
  }
  return null;
}

// ============================================================
// 공개 함수
// ============================================================

/**
 * 사건번호로 기존 사건 검색 (tenant_id 필터 적용)
 */
export async function findExistingCaseByNumber(
  supabase: SupabaseClient,
  caseNo: string,
  tenantId: string
): Promise<FoundCase | null> {
  if (!caseNo || !tenantId) return null;

  const pattern = buildCaseNumberPattern(caseNo);
  if (!pattern) return null;

  const { data, error } = await supabase
    .from('legal_cases')
    .select('id, court_case_number, case_level, main_case_id')
    .eq('tenant_id', tenantId)
    .ilike('court_case_number', pattern)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('관련 사건 매칭 실패:', error);
    return null;
  }

  return data || null;
}

/**
 * 두 사건 간 관계가 이미 존재하는지 확인
 */
export async function checkExistingRelation(
  supabase: SupabaseClient,
  caseId1: string,
  caseId2: string
): Promise<boolean> {
  const { data } = await supabase
    .from('case_relations')
    .select('id')
    .or(
      `and(case_id.eq.${caseId1},related_case_id.eq.${caseId2}),and(case_id.eq.${caseId2},related_case_id.eq.${caseId1})`
    )
    .maybeSingle();

  return !!data;
}

/**
 * case_relations 레코드 생성
 */
export async function createCaseRelation(
  supabase: SupabaseClient,
  params: {
    caseId: string;
    relatedCaseId: string;
    relationType: string;
    relationTypeCode: CaseRelationType;
    direction: 'parent' | 'child' | 'sibling';
    encCsNo?: string | null;
  }
): Promise<{ created: boolean; error?: string }> {
  const { error } = await supabase.from('case_relations').insert({
    case_id: params.caseId,
    related_case_id: params.relatedCaseId,
    relation_type: params.relationType,
    relation_type_code: params.relationTypeCode,
    direction: params.direction,
    auto_detected: true,
    detected_at: new Date().toISOString(),
    scourt_enc_cs_no: params.encCsNo || null,
  });

  if (error) {
    return { created: false, error: error.message };
  }

  return { created: true };
}

/**
 * 주사건(main_case_id) 업데이트
 */
export async function updateMainCaseId(
  supabase: SupabaseClient,
  targetCaseId: string,
  mainCaseId: string
): Promise<void> {
  await supabase
    .from('legal_cases')
    .update({ main_case_id: mainCaseId })
    .eq('id', targetCaseId);
}

/**
 * 연관사건/심급 자동 연결 메인 함수
 *
 * @param params 연결 파라미터
 * @returns 연결 결과
 */
export async function linkRelatedCases(
  params: LinkRelatedCasesParams
): Promise<LinkRelatedCasesResult> {
  const {
    supabase,
    legalCaseId,
    tenantId,
    caseNumber,
    caseType,
    relatedCases,
    lowerCourt,
  } = params;

  const result: LinkRelatedCasesResult = {
    linkedRelatedCases: 0,
    linkedLowerCourt: 0,
    unlinkedRelatedCases: [],
    unlinkedLowerCourt: [],
    errors: [],
  };

  // 현재 사건의 심급 정보
  const currentCaseLevel = inferCaseLevelFromType(caseType);
  let mainCaseId: string | undefined;

  // ============================================================
  // 1. 심급내용(원심) 자동 연결
  // ============================================================
  if (lowerCourt.length > 0) {
    console.log(`🔗 심급내용(원심) ${lowerCourt.length}건 발견, 자동 연결 시도...`);

    for (const lowerCase of lowerCourt) {
      // 이미 linkedCaseId가 있으면 사용, 없으면 검색
      let existingCase: FoundCase | null = null;
      if (lowerCase.linkedCaseId) {
        existingCase = { id: lowerCase.linkedCaseId, court_case_number: lowerCase.caseNo };
      } else {
        existingCase = await findExistingCaseByNumber(supabase, lowerCase.caseNo, tenantId);
      }

      if (existingCase) {
        console.log(`  ✅ 원심사건 발견: ${lowerCase.caseNo} → ID: ${existingCase.id}`);

        // 이미 연결되어 있는지 확인
        const alreadyLinked = await checkExistingRelation(
          supabase,
          legalCaseId,
          existingCase.id
        );

        if (!alreadyLinked) {
          // case_relations에 자동 연결 (현재 사건 → 원심: 하심사건 관계)
          const relationType = '하심사건';
          const direction = determineRelationDirection(relationType);

          const createResult = await createCaseRelation(supabase, {
            caseId: legalCaseId,
            relatedCaseId: existingCase.id,
            relationType,
            relationTypeCode: 'appeal',
            direction,
            encCsNo: lowerCase.encCsNo,
          });

          if (createResult.created) {
            console.log(`  📎 심급내용 case_relations 자동 등록: 하심사건`);
            result.linkedLowerCourt++;

            // 주사건 업데이트: 현재 사건(상위심급)이 주사건
            console.log(`  👑 주사건 설정: ${legalCaseId} (상위심급)`);
            await updateMainCaseId(supabase, existingCase.id, legalCaseId);
            await updateMainCaseId(supabase, legalCaseId, legalCaseId);
            mainCaseId = legalCaseId;
          } else {
            console.error(`  ❌ 심급내용 case_relations 등록 실패:`, createResult.error);
            result.errors.push(`원심 연결 실패: ${lowerCase.caseNo} - ${createResult.error}`);
          }
        } else {
          console.log(`  ⏭️ 이미 연결됨: ${lowerCase.caseNo}`);
        }
      } else {
        console.log(`  ⚠️ 미등록 원심사건: ${lowerCase.caseNo} (${lowerCase.courtName || lowerCase.court || ''})`);
        result.unlinkedLowerCourt.push(lowerCase);
      }
    }
  }

  // ============================================================
  // 2. 연관사건 자동 연결
  // ============================================================
  if (relatedCases.length > 0) {
    console.log(`🔗 연관사건 ${relatedCases.length}건 발견, 자동 연결 시도...`);

    for (const relatedCase of relatedCases) {
      // 이미 linkedCaseId가 있으면 사용, 없으면 검색
      let existingCase: FoundCase | null = null;
      if (relatedCase.linkedCaseId) {
        existingCase = { id: relatedCase.linkedCaseId, court_case_number: relatedCase.caseNo };
      } else {
        existingCase = await findExistingCaseByNumber(supabase, relatedCase.caseNo, tenantId);
      }

      if (existingCase) {
        console.log(`  ✅ 연관사건 발견: ${relatedCase.caseNo} → ID: ${existingCase.id}`);

        // 이미 연결되어 있는지 확인
        const alreadyLinked = await checkExistingRelation(
          supabase,
          legalCaseId,
          existingCase.id
        );

        if (!alreadyLinked) {
          const relationTypeCode = SCOURT_RELATION_MAP[relatedCase.relation || ''] || 'related';
          const direction = determineRelationDirection(relatedCase.relation || '', caseType);

          const createResult = await createCaseRelation(supabase, {
            caseId: legalCaseId,
            relatedCaseId: existingCase.id,
            relationType: relatedCase.relation || '관련사건',
            relationTypeCode,
            direction,
            encCsNo: relatedCase.encCsNo,
          });

          if (createResult.created) {
            console.log(`  📎 case_relations 자동 등록: ${relatedCase.relation || '관련사건'}`);
            result.linkedRelatedCases++;

            // 주사건 업데이트 로직
            const existingCaseTypeMatch = existingCase.court_case_number?.match(/\d{4}([가-힣]+)\d+/);
            const existingCaseType = existingCaseTypeMatch?.[1] || '';
            const relatedCaseLevel = existingCase.case_level || inferCaseLevelFromType(existingCaseType);

            const shouldUpdate = shouldUpdateMainCase(
              { case_level: currentCaseLevel, case_type_code: caseType },
              { case_level: relatedCaseLevel, case_type_code: existingCaseType }
            );

            if (shouldUpdate) {
              // 현재 사건이 더 높은 심급 → 현재 사건이 주사건
              console.log(`  👑 주사건 변경: ${legalCaseId} (${currentCaseLevel})`);
              await updateMainCaseId(supabase, existingCase.id, legalCaseId);
              await updateMainCaseId(supabase, legalCaseId, legalCaseId);
              mainCaseId = legalCaseId;
            } else if (existingCase.main_case_id) {
              // 기존 사건에 주사건이 있으면 현재 사건도 같은 주사건으로 설정
              await updateMainCaseId(supabase, legalCaseId, existingCase.main_case_id);
              mainCaseId = existingCase.main_case_id;
              console.log(`  📌 주사건 연결: ${existingCase.main_case_id}`);
            }
          } else {
            console.error(`  ❌ case_relations 등록 실패:`, createResult.error);
            result.errors.push(`연관사건 연결 실패: ${relatedCase.caseNo} - ${createResult.error}`);
          }
        } else {
          console.log(`  ⏭️ 이미 연결됨: ${relatedCase.caseNo}`);
        }
      } else {
        console.log(`  ⚠️ 미등록 연관사건: ${relatedCase.caseNo} (${relatedCase.relation || ''})`);
        result.unlinkedRelatedCases.push(relatedCase);
      }
    }
  }

  result.mainCaseId = mainCaseId;

  console.log(
    `📊 연관사건 연결 완료: 심급=${result.linkedLowerCourt}건, 연관=${result.linkedRelatedCases}건, ` +
      `미등록 심급=${result.unlinkedLowerCourt.length}건, 미등록 연관=${result.unlinkedRelatedCases.length}건`
  );

  return result;
}

/**
 * 스냅샷의 연관사건 데이터를 기존 사건과 매칭하여 linkedCaseId 추가
 * (스냅샷 저장 전에 호출하여 linkedCaseId 사전 설정)
 */
export async function enrichRelatedCasesWithLinks(
  supabase: SupabaseClient,
  tenantId: string,
  relatedCases: RelatedCaseData[]
): Promise<RelatedCaseData[]> {
  return Promise.all(
    relatedCases.map(async (rc) => {
      if (rc.linkedCaseId) return rc;

      const existingCase = await findExistingCaseByNumber(supabase, rc.caseNo, tenantId);
      return {
        ...rc,
        linkedCaseId: existingCase?.id || null,
      };
    })
  );
}

/**
 * 스냅샷의 심급 데이터를 기존 사건과 매칭하여 linkedCaseId 추가
 */
export async function enrichLowerCourtWithLinks(
  supabase: SupabaseClient,
  tenantId: string,
  lowerCourt: LowerCourtData[]
): Promise<LowerCourtData[]> {
  return Promise.all(
    lowerCourt.map(async (lc) => {
      if (lc.linkedCaseId) return lc;

      const existingCase = await findExistingCaseByNumber(supabase, lc.caseNo, tenantId);
      return {
        ...lc,
        linkedCaseId: existingCase?.id || null,
      };
    })
  );
}
