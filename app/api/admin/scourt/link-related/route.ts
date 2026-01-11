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
import { buildManualPartySeeds } from '@/lib/case/party-seeds';

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

    // 원본 사건 정보 조회 (당사자 복사를 위해 client_role, clients 포함)
    const { data: sourceCase, error: sourceCaseError } = await supabase
      .from('legal_cases')
      .select('id, tenant_id, client_id, case_level, court_case_number, main_case_id, client_role, clients(name)')
      .eq('id', sourceCaseId)
      .single();

    if (sourceCaseError || !sourceCase) {
      return NextResponse.json(
        { error: '원본 사건을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // case_parties에서 상대방(is_our_client=false, is_primary=true) 이름 조회
    const { data: opponentParty } = await supabase
      .from('case_parties')
      .select('party_name')
      .eq('case_id', sourceCaseId)
      .eq('is_our_client', false)
      .eq('is_primary', true)
      .maybeSingle();

    const sourceOpponentName = opponentParty?.party_name || '';

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

      // 새 사건 생성 (원본 사건의 client_role 복사, opponent_name은 case_parties로 관리)
      const newCase = {
        tenant_id: sourceCase.tenant_id,
        client_id: clientId || sourceCase.client_id,  // 지정된 의뢰인 또는 원본 사건 의뢰인
        court_case_number: relatedCaseInfo.caseNumber,
        court_name: relatedCaseInfo.courtName,
        case_name: `${relatedCaseInfo.relationType} 사건`,  // 임시 사건명
        status: '진행중',
        case_type: parsed.caseType,
        enc_cs_no: relatedCaseInfo.encCsNo || null,
        client_role: sourceCase.client_role || null,  // 원본 사건의 의뢰인 지위 복사
        // opponent_name은 더 이상 legal_cases에 저장하지 않음 (case_parties로 관리)
        opponent_name: null,
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

      // ============================================================
      // 1-1. 당사자 복사/생성 (cases/route.ts 패턴 재사용)
      // ============================================================

      // 원본 사건의 manual_override=true 당사자 조회
      const { data: sourceParties } = await supabase
        .from('case_parties')
        .select('party_name, party_type, party_type_label, party_order, is_our_client, client_id, fee_allocation_amount, success_fee_terms, notes')
        .eq('case_id', sourceCaseId)
        .eq('manual_override', true)
        .order('party_order', { ascending: true });

      if (sourceParties && sourceParties.length > 0) {
        // 원본 당사자 복사
        const partyInsertPayload = sourceParties.map((party, idx) => ({
          tenant_id: sourceCase.tenant_id,
          case_id: targetCaseId,
          party_name: party.party_name,
          party_type: party.party_type,
          party_type_label: party.party_type_label,
          party_order: idx + 1,
          is_our_client: party.is_our_client,
          client_id: party.client_id || null,
          fee_allocation_amount: party.fee_allocation_amount || null,
          success_fee_terms: party.success_fee_terms || null,
          notes: party.notes || null,
          manual_override: true,  // 복사된 당사자도 수동 설정으로 표시
          scourt_synced: false,
        }));

        const { error: partyInsertError } = await supabase
          .from('case_parties')
          .insert(partyInsertPayload);

        if (partyInsertError) {
          console.error('당사자 복사 실패:', partyInsertError);
        } else {
          console.log(`✅ 원본 당사자 ${partyInsertPayload.length}명 복사 완료`);
        }
      } else {
        // 원본에 manual_override 당사자가 없으면 buildManualPartySeeds로 생성
        const clientName = (sourceCase.clients as { name?: string } | null)?.name || '';
        const partySeeds = buildManualPartySeeds({
          clientName,
          opponentName: sourceOpponentName || '',
          clientRole: sourceCase.client_role as 'plaintiff' | 'defendant' | 'applicant' | 'respondent' | undefined,
          caseNumber: relatedCaseInfo.caseNumber,
          clientId: clientId || sourceCase.client_id || undefined,
        });

        if (partySeeds.length > 0) {
          const seedPayload = partySeeds.map((seed, idx) => ({
            tenant_id: sourceCase.tenant_id,
            case_id: targetCaseId,
            party_name: seed.party_name,
            party_type: seed.party_type,
            party_type_label: seed.party_type_label,
            party_order: idx + 1,
            is_our_client: seed.is_our_client,
            client_id: seed.client_id || null,
            manual_override: false,  // 자동 생성
            scourt_synced: false,
          }));

          const { error: seedError } = await supabase
            .from('case_parties')
            .insert(seedPayload);

          if (seedError) {
            console.error('당사자 시드 생성 실패:', seedError);
          } else {
            console.log(`✅ 당사자 시드 ${seedPayload.length}명 생성 완료`);
          }
        }
      }
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

    // ============================================================
    // 5. 새 사건 생성 시 SCOURT sync 호출 (일반내용 + 진행내용 가져오기)
    // ============================================================
    let syncResult = null;
    if (newCaseCreated && relatedCaseInfo.caseNumber) {
      try {
        const clientName = (sourceCase.clients as { name?: string } | null)?.name || '';
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        console.log(`🔄 SCOURT sync 시작: ${relatedCaseInfo.caseNumber}`);

        const syncResponse = await fetch(`${baseUrl}/api/admin/scourt/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            legalCaseId: targetCaseId,
            caseNumber: relatedCaseInfo.caseNumber,
            courtName: relatedCaseInfo.courtName,
            partyName: clientName || sourceOpponentName || '',
            forceRefresh: true,
            syncType: 'full',           // 진행+일반내용 함께 조회
            triggerSource: 'manual',    // 수동 연동 표시
          }),
        });

        if (syncResponse.ok) {
          syncResult = await syncResponse.json();
          console.log(`✅ SCOURT sync 완료:`, syncResult.success ? '성공' : '실패');
        } else {
          console.error('❌ SCOURT sync 응답 에러:', syncResponse.status);
        }
      } catch (syncError) {
        console.error('❌ SCOURT sync 호출 실패:', syncError);
        // sync 실패해도 사건 생성은 성공으로 처리
      }
    }

    return NextResponse.json({
      success: true,
      message: newCaseCreated
        ? '새 사건을 생성하고 연결했습니다'
        : '기존 사건과 연결했습니다',
      action: newCaseCreated ? 'created' : 'linked',
      targetCaseId,
      caseRelationId: newRelation.id,
      mainCaseId,
      syncResult: syncResult ? { success: syncResult.success } : null,
    });
  } catch (error) {
    console.error('연관사건 연결 API 에러:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 에러' },
      { status: 500 }
    );
  }
}
