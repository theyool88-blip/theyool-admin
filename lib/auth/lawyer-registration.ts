/**
 * 변호사 회원가입 로직
 * 테넌트 생성 및 멤버 등록
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { TenantType, SubscriptionPlan, TenantFeatures, TenantSettings } from '@/types/tenant';

// 회원가입 입력 타입
export interface LawyerRegistrationInput {
  // 사용자 정보
  email: string;
  password: string;

  // 변호사 정보
  name: string;
  barNumber?: string;      // 변호사 등록번호 (선택)
  phone?: string;

  // 사무소 정보
  officeName: string;
  officeType: TenantType;  // 'individual' | 'firm'
  officePhone?: string;
  officeAddress?: string;

  // 서비스 옵션
  wantHomepage: boolean;   // 홈페이지 서비스 연결 희망
}

// 회원가입 결과
export interface LawyerRegistrationResult {
  success: boolean;
  userId?: string;
  tenantId?: string;
  memberId?: string;
  error?: string;
  errorCode?: string;
}

// 기본 플랜 기능
const DEFAULT_FEATURES: TenantFeatures = {
  maxCases: 100,
  maxClients: 200,
  maxMembers: 1,
  maxLawyers: -1, // -1 = 무제한
  scourtSync: false,
  clientPortal: false,
  homepage: false,
};

// 기본 설정
const DEFAULT_SETTINGS: TenantSettings = {
  timezone: 'Asia/Seoul',
  dateFormat: 'YYYY-MM-DD',
  workingHours: {
    start: '09:00',
    end: '18:00',
  },
};

/**
 * 슬러그 생성 (한글을 로마자로 변환하지 않고 유니크한 슬러그 생성)
 */
function generateSlug(name: string): string {
  // 영문, 숫자만 남기고 소문자로 변환
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  // 랜덤 suffix 추가
  const suffix = Math.random().toString(36).substring(2, 8);

  return `${base}-${suffix}`;
}

/**
 * 변호사 회원가입 처리
 * 1. Supabase Auth 사용자 생성
 * 2. 테넌트 생성
 * 3. 멤버십 생성 (owner)
 */
export async function registerLawyer(
  supabase: SupabaseClient,
  input: LawyerRegistrationInput
): Promise<LawyerRegistrationResult> {
  try {
    // 1. 이메일 중복 확인
    const { data: existingUsers } = await supabase
      .from('tenant_members')
      .select('id')
      .eq('email', input.email)
      .limit(1);

    if (existingUsers && existingUsers.length > 0) {
      return {
        success: false,
        error: '이미 가입된 이메일입니다.',
        errorCode: 'EMAIL_EXISTS',
      };
    }

    // 2. Supabase Auth 사용자 생성
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          name: input.name,
          role: 'lawyer',
        },
      },
    });

    if (authError) {
      console.error('Auth signup error:', authError);

      if (authError.message.includes('already registered')) {
        return {
          success: false,
          error: '이미 가입된 이메일입니다.',
          errorCode: 'EMAIL_EXISTS',
        };
      }

      return {
        success: false,
        error: '회원가입 중 오류가 발생했습니다.',
        errorCode: 'AUTH_ERROR',
      };
    }

    const userId = authData.user?.id;
    if (!userId) {
      return {
        success: false,
        error: '사용자 생성에 실패했습니다.',
        errorCode: 'USER_CREATE_FAILED',
      };
    }

    // 3. 테넌트 생성
    const slug = generateSlug(input.officeName);
    const features: TenantFeatures = {
      ...DEFAULT_FEATURES,
      maxMembers: input.officeType === 'firm' ? 10 : 1,
      homepage: input.wantHomepage,
    };

    const { data: tenantData, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: input.officeName,
        slug: slug,
        type: input.officeType,
        phone: input.officePhone || null,
        email: input.email,
        address: input.officeAddress || null,
        has_homepage: input.wantHomepage,
        plan: 'basic' as SubscriptionPlan,
        plan_started_at: new Date().toISOString(),
        features: features,
        settings: DEFAULT_SETTINGS,
        status: 'active',
        is_verified: false,
      })
      .select('id')
      .single();

    if (tenantError) {
      console.error('Tenant creation error:', tenantError);
      // 롤백: 사용자 삭제
      await supabase.auth.admin.deleteUser(userId);

      return {
        success: false,
        error: '사무소 등록에 실패했습니다.',
        errorCode: 'TENANT_CREATE_FAILED',
      };
    }

    const tenantId = tenantData.id;

    // 4. 멤버십 생성 (owner 역할)
    const { data: memberData, error: memberError } = await supabase
      .from('tenant_members')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        role: 'owner',
        display_name: input.name,
        bar_number: input.barNumber || null,
        phone: input.phone || null,
        email: input.email,
        permissions: ['*'],
        status: 'active',
        joined_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (memberError) {
      console.error('Member creation error:', memberError);
      // 롤백: 테넌트와 사용자 삭제
      await supabase.from('tenants').delete().eq('id', tenantId);
      await supabase.auth.admin.deleteUser(userId);

      return {
        success: false,
        error: '멤버 등록에 실패했습니다.',
        errorCode: 'MEMBER_CREATE_FAILED',
      };
    }

    return {
      success: true,
      userId: userId,
      tenantId: tenantId,
      memberId: memberData.id,
    };

  } catch (error) {
    console.error('Registration error:', error);
    return {
      success: false,
      error: '회원가입 중 오류가 발생했습니다.',
      errorCode: 'UNKNOWN_ERROR',
    };
  }
}

/**
 * 변호사 등록번호 검증 (형식만 확인)
 * 실제 검증은 대한변호사협회 API를 통해 해야 함
 */
export function validateBarNumber(barNumber: string): boolean {
  // 형식: 숫자 5-6자리
  return /^\d{5,6}$/.test(barNumber);
}

/**
 * 비밀번호 강도 검증
 */
export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: '비밀번호는 8자 이상이어야 합니다.' };
  }
  if (!/[A-Za-z]/.test(password)) {
    return { valid: false, message: '비밀번호에 영문자가 포함되어야 합니다.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: '비밀번호에 숫자가 포함되어야 합니다.' };
  }
  return { valid: true };
}
