/**
 * 슈퍼 어드민 전용 API 래퍼
 * 슈퍼 어드민만 접근 가능한 API 라우트용
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface SuperAdminContext {
  userId: string;
  permissions: string[];
}

type SuperAdminHandler = (
  request: NextRequest,
  context: { superAdmin: SuperAdminContext; params?: Record<string, string> }
) => Promise<NextResponse>;

/**
 * 슈퍼 어드민 전용 API 래퍼
 */
export function withSuperAdmin(handler: SuperAdminHandler) {
  return async (
    request: NextRequest,
    segmentData?: { params?: Promise<Record<string, string>> }
  ) => {
    try {
      // 현재 사용자 확인
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json(
          { success: false, error: '로그인이 필요합니다.' },
          { status: 401 }
        );
      }

      // 슈퍼 어드민 확인
      const { data: superAdmin, error } = await supabase
        .from('super_admins')
        .select('id, user_id, permissions')
        .eq('user_id', user.id)
        .single();

      if (error || !superAdmin) {
        return NextResponse.json(
          { success: false, error: '슈퍼 어드민 권한이 필요합니다.' },
          { status: 403 }
        );
      }

      // Next.js 16+: params가 Promise인 경우 await
      const params = segmentData?.params ? await segmentData.params : undefined;

      return handler(request, {
        superAdmin: {
          userId: superAdmin.user_id,
          permissions: superAdmin.permissions || ['*'],
        },
        params,
      });

    } catch (error) {
      console.error('withSuperAdmin error:', error);
      return NextResponse.json(
        { success: false, error: '서버 오류가 발생했습니다.' },
        { status: 500 }
      );
    }
  };
}
