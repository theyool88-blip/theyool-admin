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
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profileId');

    const supabase = createAdminClient();

    // 프로필 조회
    let profileQuery = supabase
      .from('scourt_profiles')
      .select('*');

    if (profileId) {
      profileQuery = profileQuery.eq('id', profileId);
    } else {
      // 기본 활성 프로필
      profileQuery = profileQuery.eq('status', 'active').limit(1);
    }

    const { data: profiles, error: profileError } = await profileQuery;

    if (profileError || !profiles || profiles.length === 0) {
      return NextResponse.json(
        { error: '프로필을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    const profile = profiles[0];

    // DB에서 저장된 사건 목록 조회
    const { data: dbCases, error: casesError } = await supabase
      .from('scourt_profile_cases')
      .select(`
        *,
        legal_case:legal_case_id (
          id,
          case_name,
          case_type,
          court_name,
          client:client_id (
            name
          )
        )
      `)
      .eq('profile_id', profile.id)
      .order('last_accessed_at', { ascending: false });

    if (casesError) {
      console.error('사건 목록 조회 에러:', casesError);
    }

    // 프로필의 저장된 사건 수 계산
    const caseCount = dbCases?.length || 0;
    const maxCases = profile.max_cases || 50;

    return NextResponse.json({
      success: true,
      cases: dbCases || [],
      profileInfo: {
        id: profile.id,
        profileName: profile.profile_name,
        caseCount,
        maxCases,
        status: profile.status,
        remainingSlots: maxCases - caseCount,
        createdAt: profile.created_at,
        lastUsedAt: profile.last_used_at,
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
