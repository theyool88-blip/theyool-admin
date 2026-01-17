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

    // 원본 사건 정보 조회
    const { data: sourceCase, error: sourceCaseError } = await supabase
      .from('legal_cases')
      .select('id, tenant_id, case_level, court_case_number, main_case_id, primary_client_id, primary_client_name')
      .eq('id', sourceCaseId)
      .single();

    if (sourceCaseError || !sourceCase) {
      return NextResponse.json(
        { error: '원본 사건을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // case_clients에서 주 의뢰인 정보 조회
    const { data: sourceCaseClient } = await supabase
      .from('case_clients')
      .select('client_id, linked_party_id')
      .eq('case_id', sourceCaseId)
      .eq('is_primary_client', true)
      .maybeSingle();

    // case_parties에서 의뢰인 party_type 조회 (client_role 대체)
    let sourceClientRole: 'plaintiff' | 'defendant' | null = null;
    if (sourceCaseClient?.linked_party_id) {
      const { data: clientParty } = await supabase
        .from('case_parties')
        .select('party_type')
        .eq('id', sourceCaseClient.linked_party_id)
        .single();
      if (clientParty) {
        sourceClientRole = clientParty.party_type === 'plaintiff' ? 'plaintiff' : 'defendant';
      }
    } else {
      // linked_party_id 없으면 is_primary=true인 당사자의 party_type
      const { data: primaryParty } = await supabase
        .from('case_parties')
        .select('party_type')
        .eq('case_id', sourceCaseId)
        .eq('is_primary', true)
        .maybeSingle();
      if (primaryParty) {
        sourceClientRole = primaryParty.party_type === 'plaintiff' ? 'plaintiff' : 'defendant';
      }
    }

    // case_parties에서 상대방(is_primary=false) 이름 조회
    const { data: opponentParty } = await supabase
      .from('case_parties')
      .select('party_name')
      .eq('case_id', sourceCaseId)
      .eq('is_primary', false)
      .order('party_order', { ascending: true })
      .limit(1)
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

      // 새 사건 생성 (의뢰인은 case_clients로 관리)
      const resolvedClientId = clientId || sourceCaseClient?.client_id || null;
      const newCase = {
        tenant_id: sourceCase.tenant_id,
        court_case_number: relatedCaseInfo.caseNumber,
        court_name: relatedCaseInfo.courtName,
        case_name: `${relatedCaseInfo.relationType} 사건`,  // 임시 사건명
        status: '진행중',
        case_type: parsed.caseType,
        enc_cs_no: relatedCaseInfo.encCsNo || null,
        // 연관관계 설명
        related_case_info: `${sourceCase.court_case_number}의 ${relatedCaseInfo.relationType}`,
        // 캐시 필드 (트리거가 동기화하지만 초기값 설정)
        primary_client_id: resolvedClientId,
        primary_client_name: sourceCase.primary_client_name || null,
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

      // case_clients 생성 (의뢰인 연결)
      if (resolvedClientId) {
        await supabase
          .from('case_clients')
          .upsert({
            tenant_id: sourceCase.tenant_id,
            case_id: targetCaseId,
            client_id: resolvedClientId,
            is_primary_client: true,
          }, { onConflict: 'case_id,client_id' });
      }

      // ============================================================
      // 1-1. 당사자 복사/생성 (cases/route.ts 패턴 재사용)
      // ============================================================

      // 원본 사건의 manual_override=true 당사자 조회
      const { data: sourceParties } = await supabase
        .from('case_parties')
        .select('party_name, party_type, party_type_label, party_order, is_primary, representatives, notes')
        .eq('case_id', sourceCaseId)
        .eq('manual_override', true)
        .order('party_order', { ascending: true });

      let primaryPartyId: string | null = null;

      if (sourceParties && sourceParties.length > 0) {
        // 원본 당사자 복사
        const partyInsertPayload = sourceParties.map((party, idx) => ({
          tenant_id: sourceCase.tenant_id,
          case_id: targetCaseId,
          party_name: party.party_name,
          party_type: party.party_type,
          party_type_label: party.party_type_label,
          party_order: idx + 1,
          is_primary: party.is_primary,
          representatives: party.representatives || [],
          notes: party.notes || null,
          manual_override: true,  // 복사된 당사자도 수동 설정으로 표시
          scourt_synced: false,
        }));

        const { data: insertedParties, error: partyInsertError } = await supabase
          .from('case_parties')
          .insert(partyInsertPayload)
          .select('id, is_primary');

        if (partyInsertError) {
          console.error('당사자 복사 실패:', partyInsertError);
        } else {
          console.log(`✅ 원본 당사자 ${partyInsertPayload.length}명 복사 완료`);
          // 의뢰인 당사자 ID 찾기
          primaryPartyId = insertedParties?.find(p => p.is_primary)?.id || null;
        }
      } else {
        // 원본에 manual_override 당사자가 없으면 buildManualPartySeeds로 생성
        const clientName = sourceCase.primary_client_name || '';
        const partySeeds = buildManualPartySeeds({
          clientName,
          opponentName: sourceOpponentName || '',
          clientRole: sourceClientRole as 'plaintiff' | 'defendant' | 'applicant' | 'respondent' | undefined,
          caseNumber: relatedCaseInfo.caseNumber,
          clientId: resolvedClientId || undefined,
        });

        if (partySeeds.length > 0) {
          const seedPayload = partySeeds.map((seed, idx) => ({
            tenant_id: sourceCase.tenant_id,
            case_id: targetCaseId,
            party_name: seed.party_name,
            party_type: seed.party_type,
            party_type_label: seed.party_type_label,
            party_order: idx + 1,
            is_primary: seed.is_our_client,  // is_our_client → is_primary
            representatives: [],
            manual_override: false,  // 자동 생성
            scourt_synced: false,
          }));

          const { data: insertedSeeds, error: seedError } = await supabase
            .from('case_parties')
            .insert(seedPayload)
            .select('id, is_primary');

          if (seedError) {
            console.error('당사자 시드 생성 실패:', seedError);
          } else {
            console.log(`✅ 당사자 시드 ${seedPayload.length}명 생성 완료`);
            primaryPartyId = insertedSeeds?.find(p => p.is_primary)?.id || null;
          }
        }
      }

      // case_clients에 linked_party_id 연결
      if (resolvedClientId && primaryPartyId) {
        await supabase
          .from('case_clients')
          .update({ linked_party_id: primaryPartyId })
          .eq('case_id', targetCaseId)
          .eq('client_id', resolvedClientId);
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
        const clientName = sourceCase.primary_client_name || '';
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
