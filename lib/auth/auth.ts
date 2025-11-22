/**
 * 인증 헬퍼 함수
 * @description Supabase 세션 기반 인증 확인
 */

import { createClient } from '@/lib/supabase/server';

/**
 * 사용자가 인증되었는지 확인
 * @returns true if authenticated, false otherwise
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Authentication check failed:', error);
    return false;
  }
}

/**
 * 현재 로그인한 사용자 정보 가져오기
 */
export async function getCurrentUser() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Get current user failed:', error);
    return null;
  }
}
