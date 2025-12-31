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
import { createClient } from '@/lib/supabase';
import { getScourtSessionManager } from '@/lib/scourt/session-manager';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || undefined;

    const supabase = createClient();
    const sessionManager = getScourtSessionManager();

    // 사용자 설정 및 사용량 조회
    const settings = await sessionManager.getUserSettings(userId);
    const usage = await sessionManager.getProfileUsage(userId);

    // 프로필 목록 조회
    let profileQuery = supabase
      .from('scourt_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (userId) {
      profileQuery = profileQuery.eq('lawyer_id', userId);
    }

    const { data: profiles } = await profileQuery;

    // 총 저장된 사건 수
    let casesQuery = supabase
      .from('scourt_profile_cases')
      .select('*', { count: 'exact', head: true });

    if (userId && profiles?.length) {
      const profileIds = profiles.map((p) => p.id);
      casesQuery = casesQuery.in('profile_id', profileIds);
    }

    const { count: totalCases } = await casesQuery;

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
    const stats = {
      totalProfiles: profiles?.length || 0,
      activeProfiles: profiles?.filter((p) => p.status === 'active').length || 0,
      fullProfiles: profiles?.filter((p) => p.status === 'full').length || 0,
      totalCases: totalCases || 0,
      totalSlots: (profiles || []).reduce((sum, p) => sum + p.max_cases, 0),
      usedSlots: (profiles || []).reduce((sum, p) => sum + p.case_count, 0),
    };

    // 제한 정보
    const limits = {
      maxProfiles: settings.maxProfiles,
      maxCasesPerProfile: settings.maxCasesPerProfile,
      maxTotalCases: usage.maxTotalCases,
      remainingProfiles: usage.remainingProfiles,
      remainingCases: usage.maxTotalCases - usage.totalCases,
      usagePercent: Math.round((usage.totalCases / usage.maxTotalCases) * 100),
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
