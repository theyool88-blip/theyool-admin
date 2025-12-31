/**
 * 대법원 사건 상세 조회 API
 *
 * POST /api/admin/scourt/detail
 *
 * 핵심: 저장된 사건은 캡챠 없이 상세 조회 가능!
 *
 * 요청:
 * - caseNumber: 사건번호 (필수, 예: 2024드단26718)
 * - profileId: 프로필 ID (선택, 없으면 활성 프로필 사용)
 * - legalCaseId: DB의 legal_cases ID (선택, 결과 연동용)
 *
 * 응답:
 * - success: 성공 여부
 * - detail: 사건 상세 정보 (기일, 당사자 등)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScourtSessionManager } from '@/lib/scourt/session-manager';
import { createClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { caseNumber, profileId, legalCaseId } = body;

    // 필수 파라미터 검증
    if (!caseNumber) {
      return NextResponse.json(
        { error: '사건번호가 필요합니다' },
        { status: 400 }
      );
    }

    const sessionManager = getScourtSessionManager();
    const supabase = createClient();

    // 프로필 조회
    let profile;
    if (profileId) {
      profile = await sessionManager.getProfileStatus(profileId);
      if (!profile) {
        return NextResponse.json(
          { error: '프로필을 찾을 수 없습니다' },
          { status: 404 }
        );
      }
    } else {
      // 해당 사건이 저장된 프로필 찾기
      const { data: profileCase } = await supabase
        .from('scourt_profile_cases')
        .select('profile_id')
        .eq('case_number', caseNumber)
        .limit(1)
        .single();

      if (profileCase) {
        profile = await sessionManager.getProfileStatus(profileCase.profile_id);
      }

      if (!profile) {
        return NextResponse.json(
          { error: '해당 사건이 저장된 프로필이 없습니다. 먼저 검색을 실행해주세요.' },
          { status: 404 }
        );
      }
    }

    // 상세 조회 실행 (캡챠 불필요!)
    console.log(`📍 상세 조회 시작: ${caseNumber} (캡챠 불필요)`);
    const result = await sessionManager.getCaseDetail(profile, caseNumber);

    if (result.success && result.detail) {
      // legal_cases 업데이트 (선택적)
      if (legalCaseId) {
        await supabase
          .from('legal_cases')
          .update({
            scourt_last_sync: new Date().toISOString(),
            scourt_raw_data: result.detail.rawData,
            scourt_sync_status: 'synced',
            // 기본 정보 업데이트
            judge_name: result.detail.judge || undefined,
          })
          .eq('id', legalCaseId);

        // 기일 정보가 있으면 court_hearings 업데이트
        if (result.detail.hearings && result.detail.hearings.length > 0) {
          console.log(`📅 기일 정보 ${result.detail.hearings.length}건 발견`);
          // TODO: court_hearings 테이블 업데이트 로직
        }
      }

      return NextResponse.json({
        success: true,
        detail: result.detail,
        profileId: profile.id,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 422 }
      );
    }
  } catch (error) {
    console.error('상세 조회 API 에러:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 에러' },
      { status: 500 }
    );
  }
}
