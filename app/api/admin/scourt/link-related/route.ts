/**
 * SCOURT 연관사건 연결 API
 *
 * POST /api/admin/scourt/link-related
 *
 * 사용자가 SCOURT에서 발견된 연관사건을 확인 후:
 * 1. 새 사건으로 등록하고 연결
 * 2. 기존 사건과 연결만
 *
 * 요청:
 * - sourceCaseId: 현재 사건 ID
 * - relatedCaseInfo: { caseNumber, courtName, relationType, encCsNo }
 * - action: 'create' | 'link_existing' | 'skip'
 * - existingCaseId?: 기존 사건 ID (action='link_existing' 시)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  SCOURT_RELATION_MAP,
  determineRelationDirection,
  shouldUpdateMainCase,
  inferCaseLevelFromType,
  parseCaseNumber,
} from '@/lib/scourt/case-relations';

interface LinkRelatedRequest {
  sourceCaseId: string;
  relatedCaseInfo: {
    caseNumber: string;     // "2025가소6582"
    courtName: string;      // "수원지방법원 평택지원"
    relationType: string;   // "이의신청", "반소", "항소심" 등
    encCsNo?: string;       // SCOURT encCsNo (있으면)
  };
  action: 'create' | 'link_existing' | 'skip';
  existingCaseId?: string;  // action='link_existing' 시
  clientId?: string;        // action='create' 시, 연결할 의뢰인
}

export async function POST(request: NextRequest) {
  try {
    const body: LinkRelatedRequest = await request.json();
    const { sourceCaseId, relatedCaseInfo, action, existingCaseId, clientId } = body;

    // 필수 파라미터 검증
    if (!sourceCaseId || !relatedCaseInfo || !action) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다 (sourceCaseId, relatedCaseInfo, action)' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 원본 사건 정보 조회
    const { data: sourceCase, error: sourceCaseError } = await supabase
      .from('legal_cases')
      .select('id, tenant_id, client_id, case_level, court_case_number, main_case_id')
      .eq('id', sourceCaseId)
      .single();

    if (sourceCaseError || !sourceCase) {
      return NextResponse.json(
        { error: '원본 사건을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 건너뛰기
    if (action === 'skip') {
      return NextResponse.json({
        success: true,
        message: '연관사건 연결을 건너뛰었습니다',
        action: 'skipped',
      });
    }

    let targetCaseId: string;
    let newCaseCreated = false;

    // ============================================================
    // 1. 새 사건 생성 (action='create')
    // ============================================================
    if (action === 'create') {
      // 사건번호 파싱
      const parsed = parseCaseNumber(relatedCaseInfo.caseNumber);
      if (!parsed) {
        return NextResponse.json(
          { error: '사건번호 형식이 올바르지 않습니다' },
          { status: 400 }
        );
      }

      // 새 사건 생성
      const newCase = {
        tenant_id: sourceCase.tenant_id,
        client_id: clientId || sourceCase.client_id,  // 지정된 의뢰인 또는 원본 사건 의뢰인
        court_case_number: relatedCaseInfo.caseNumber,
        court_name: relatedCaseInfo.courtName,
        case_name: `${relatedCaseInfo.relationType} 사건`,  // 임시 사건명
        status: '진행중',
        case_type: parsed.caseType,
        enc_cs_no: relatedCaseInfo.encCsNo || null,
        // 연관관계 설명
        related_case_info: `${sourceCase.court_case_number}의 ${relatedCaseInfo.relationType}`,
      };

      const { data: createdCase, error: createError } = await supabase
        .from('legal_cases')
        .insert(newCase)
        .select('id')
        .single();

      if (createError || !createdCase) {
        console.error('새 사건 생성 실패:', createError);
        return NextResponse.json(
          { error: '새 사건 생성에 실패했습니다' },
          { status: 500 }
        );
      }

      targetCaseId = createdCase.id;
      newCaseCreated = true;
      console.log(`✅ 새 연관사건 생성: ${relatedCaseInfo.caseNumber} → ${targetCaseId}`);
    }
    // ============================================================
    // 2. 기존 사건 연결 (action='link_existing')
    // ============================================================
    else if (action === 'link_existing') {
      if (!existingCaseId) {
        return NextResponse.json(
          { error: 'existingCaseId가 필요합니다' },
          { status: 400 }
        );
      }

      // 기존 사건 확인
      const { data: existingCase, error: existingError } = await supabase
        .from('legal_cases')
        .select('id, tenant_id')
        .eq('id', existingCaseId)
        .single();

      if (existingError || !existingCase) {
        return NextResponse.json(
          { error: '연결할 사건을 찾을 수 없습니다' },
          { status: 404 }
        );
      }

      // 테넌트 확인
      if (existingCase.tenant_id !== sourceCase.tenant_id) {
        return NextResponse.json(
          { error: '다른 테넌트의 사건입니다' },
          { status: 403 }
        );
      }

      targetCaseId = existingCaseId;
      console.log(`🔗 기존 사건 연결: ${existingCaseId}`);
    } else {
      return NextResponse.json(
        { error: '올바르지 않은 action 값입니다' },
        { status: 400 }
      );
    }

    // ============================================================
    // 3. case_relations 생성
    // ============================================================

    // 이미 연결되어 있는지 확인
    const { data: existingRelation } = await supabase
      .from('case_relations')
      .select('id')
      .or(`and(case_id.eq.${sourceCaseId},related_case_id.eq.${targetCaseId}),and(case_id.eq.${targetCaseId},related_case_id.eq.${sourceCaseId})`)
      .single();

    if (existingRelation) {
      return NextResponse.json({
        success: true,
        message: '이미 연결된 사건입니다',
        action: 'already_linked',
        caseRelationId: existingRelation.id,
        targetCaseId,
      });
    }

    // relation 타입 매핑
    const relationType = SCOURT_RELATION_MAP[relatedCaseInfo.relationType] || 'related';
    const direction = determineRelationDirection(relatedCaseInfo.relationType);

    // case_relations 생성
    const { data: newRelation, error: relationError } = await supabase
      .from('case_relations')
      .insert({
        case_id: sourceCaseId,
        related_case_id: targetCaseId,
        relation_type: relatedCaseInfo.relationType,  // 원본 SCOURT 라벨
        relation_type_code: relationType,
        direction,
        auto_detected: false,  // 사용자가 수동 확인
        confirmed: true,
        confirmed_at: new Date().toISOString(),
        scourt_enc_cs_no: relatedCaseInfo.encCsNo || null,
      })
      .select('id')
      .single();

    if (relationError) {
      console.error('case_relations 생성 실패:', relationError);
      return NextResponse.json(
        { error: 'case_relations 생성에 실패했습니다' },
        { status: 500 }
      );
    }

    // ============================================================
    // 4. 주사건(main_case_id) 업데이트
    // ============================================================

    // 새로 생성된 사건의 심급 확인
    const parsed = parseCaseNumber(relatedCaseInfo.caseNumber);
    const newCaseType = parsed?.caseType || '';
    const newCaseLevel = inferCaseLevelFromType(newCaseType);

    // 원본 사건의 심급 확인
    const sourceMatch = sourceCase.court_case_number?.match(/\d{4}([가-힣]+)\d+/);
    const sourceCaseType = sourceMatch?.[1] || '';
    const sourceCaseLevel = sourceCase.case_level || inferCaseLevelFromType(sourceCaseType);

    // 어느 쪽이 주사건인지 결정
    const newCaseIsMain = shouldUpdateMainCase(
      { case_level: newCaseLevel, case_type_code: newCaseType },
      { case_level: sourceCaseLevel, case_type_code: sourceCaseType }
    );

    let mainCaseId: string;

    if (newCaseIsMain) {
      // 새 사건이 더 높은 심급 → 새 사건이 주사건
      mainCaseId = targetCaseId;
      console.log(`👑 새 사건이 주사건: ${targetCaseId} (${newCaseLevel})`);
    } else if (sourceCase.main_case_id) {
      // 원본에 주사건이 있으면 그대로 사용
      mainCaseId = sourceCase.main_case_id;
    } else {
      // 원본이 주사건
      mainCaseId = sourceCaseId;
    }

    // 양쪽 사건에 main_case_id 설정
    await supabase
      .from('legal_cases')
      .update({ main_case_id: mainCaseId })
      .eq('id', sourceCaseId);

    await supabase
      .from('legal_cases')
      .update({ main_case_id: mainCaseId })
      .eq('id', targetCaseId);

    console.log(`📌 주사건 설정 완료: ${mainCaseId}`);

    return NextResponse.json({
      success: true,
      message: newCaseCreated
        ? '새 사건을 생성하고 연결했습니다'
        : '기존 사건과 연결했습니다',
      action: newCaseCreated ? 'created' : 'linked',
      targetCaseId,
      caseRelationId: newRelation.id,
      mainCaseId,
    });
  } catch (error) {
    console.error('연관사건 연결 API 에러:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 에러' },
      { status: 500 }
    );
  }
}
