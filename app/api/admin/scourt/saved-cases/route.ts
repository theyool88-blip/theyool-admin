/**
 * 저장된 사건 목록 조회 API
 *
 * GET /api/admin/scourt/saved-cases?profileId=xxx
 *
 * 응답:
 * - cases: 저장된 사건 목록
 * - profileInfo: 프로필 정보 (사건 수, 상태 등)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScourtSessionManager } from '@/lib/scourt/session-manager';
import { createClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profileId');

    const sessionManager = getScourtSessionManager();
    const supabase = createClient();

    // 프로필 조회
    let profile;
    if (profileId) {
      profile = await sessionManager.getProfileStatus(profileId);
    } else {
      // 기본 프로필 사용
      profile = await sessionManager.getOrCreateProfile();
    }

    if (!profile) {
      return NextResponse.json(
        { error: '프로필을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // DB에서 저장된 사건 목록 조회
    const { data: dbCases } = await supabase
      .from('scourt_profile_cases')
      .select('*')
      .eq('profile_id', profile.id)
      .order('last_accessed_at', { ascending: false });

    // 브라우저에서 실제 저장된 사건 목록 조회 (선택적)
    // const browserCases = await sessionManager.getSavedCases(profile);

    return NextResponse.json({
      success: true,
      cases: dbCases || [],
      profileInfo: {
        id: profile.id,
        profileName: profile.profileName,
        caseCount: profile.caseCount,
        maxCases: profile.maxCases,
        status: profile.status,
        remainingSlots: profile.maxCases - profile.caseCount,
      },
    });
  } catch (error) {
    console.error('저장된 사건 목록 조회 에러:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 에러' },
      { status: 500 }
    );
  }
}
