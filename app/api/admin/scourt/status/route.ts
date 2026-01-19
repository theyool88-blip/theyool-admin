/**
 * 대법원 세션 상태 조회 API
 *
 * GET /api/admin/scourt/status?userId=xxx
 *
 * 응답:
 * - profiles: 모든 프로필 상태
 * - stats: 통계 정보
 * - limits: 프로필 제한 정보
 * - recentSyncs: 최근 동기화 로그
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// 기본 설정값
const DEFAULT_MAX_PROFILES = 5;
const DEFAULT_MAX_CASES_PER_PROFILE = 50;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || undefined;

    const supabase = createAdminClient();

    // 사용자 설정 조회
    // NOTE: scourt_user_settings 테이블이 스키마에서 제거됨
    // 기본값 사용 (향후 tenant_settings에서 조회하도록 개선 필요)
    const maxProfiles = DEFAULT_MAX_PROFILES;
    const maxCasesPerProfile = DEFAULT_MAX_CASES_PER_PROFILE;

    // 프로필 목록 조회
    let profileQuery = supabase
      .from('scourt_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (userId) {
      profileQuery = profileQuery.eq('lawyer_id', userId);
    }

    const { data: profiles } = await profileQuery;

    // 총 저장된 사건 수 조회
    let totalCases = 0;
    if (profiles && profiles.length > 0) {
      const profileIds = profiles.map((p) => p.id);
      const { count } = await supabase
        .from('scourt_profile_cases')
        .select('*', { count: 'exact', head: true })
        .in('profile_id', profileIds);
      totalCases = count || 0;
    }

    // 최근 동기화 로그 (최근 10개)
    let logsQuery = supabase
      .from('scourt_sync_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (userId && profiles?.length) {
      const profileIds = profiles.map((p) => p.id);
      logsQuery = logsQuery.in('profile_id', profileIds);
    }

    const { data: recentSyncs } = await logsQuery;

    // 통계 계산
    const totalProfiles = profiles?.length || 0;
    const activeProfiles = profiles?.filter((p) => p.status === 'active').length || 0;
    const fullProfiles = profiles?.filter((p) => p.status === 'full').length || 0;
    const totalSlots = (profiles || []).reduce((sum, p) => sum + (p.max_cases || DEFAULT_MAX_CASES_PER_PROFILE), 0);
    const usedSlots = totalCases;

    const stats = {
      totalProfiles,
      activeProfiles,
      fullProfiles,
      totalCases,
      totalSlots,
      usedSlots,
    };

    // 제한 정보
    const maxTotalCases = maxProfiles * maxCasesPerProfile;
    const remainingProfiles = maxProfiles - totalProfiles;
    const remainingCases = maxTotalCases - totalCases;
    const usagePercent = maxTotalCases > 0 ? Math.round((totalCases / maxTotalCases) * 100) : 0;

    const limits = {
      maxProfiles,
      maxCasesPerProfile,
      maxTotalCases,
      remainingProfiles,
      remainingCases,
      usagePercent,
    };

    return NextResponse.json({
      success: true,
      profiles: profiles || [],
      stats,
      limits,
      recentSyncs: recentSyncs || [],
    });
  } catch (error) {
    console.error('상태 조회 API 에러:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 에러' },
      { status: 500 }
    );
  }
}
