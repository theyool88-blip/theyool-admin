/**
 * 멀티테넌트 시스템 타입 정의
 */

// 테넌트 타입
export type TenantType = 'individual' | 'firm';

// 테넌트 상태
export type TenantStatus = 'active' | 'suspended' | 'cancelled';

// 구독 플랜
export type SubscriptionPlan = 'basic' | 'professional' | 'enterprise';

// 멤버 역할 (계층: owner > admin > lawyer > staff)
export type MemberRole = 'owner' | 'admin' | 'lawyer' | 'staff';

// 멤버 상태
export type MemberStatus = 'active' | 'invited' | 'suspended';

// 테넌트 기능 설정
export interface TenantFeatures {
  maxCases: number;      // -1 = 무제한
  maxClients: number;    // -1 = 무제한
  maxMembers: number;    // -1 = 무제한
  scourtSync: boolean;   // 대법원 연동
  clientPortal: boolean; // 의뢰인 포털
  homepage: boolean;     // 홈페이지 서비스
}

// 테넌트 설정
export interface TenantSettings {
  timezone: string;
  dateFormat: string;
  workingHours: {
    start: string;
    end: string;
  };
}

// 테넌트 정보
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  type: TenantType;
  phone?: string;
  email?: string;
  address?: string;
  hasHomepage: boolean;
  homepageDomain?: string;
  homepageSubdomain?: string;
  plan: SubscriptionPlan;
  planStartedAt?: string;
  planExpiresAt?: string;
  features: TenantFeatures;
  settings: TenantSettings;
  status: TenantStatus;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

// 테넌트 멤버
export interface TenantMember {
  id: string;
  tenantId: string;
  userId: string;
  role: MemberRole;
  displayName?: string;
  title?: string;
  barNumber?: string;
  phone?: string;
  email?: string;
  permissions: string[];
  status: MemberStatus;
  invitedAt?: string;
  invitedBy?: string;
  joinedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// 슈퍼 어드민
export interface SuperAdmin {
  id: string;
  userId: string;
  permissions: string[];
  createdAt: string;
  createdBy?: string;
}

// 테넌트 컨텍스트 (현재 로그인한 사용자의 테넌트 정보)
export interface TenantContext {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  tenantType: TenantType;
  hasHomepage: boolean;
  plan: SubscriptionPlan;
  features: TenantFeatures;
  memberId: string;
  memberRole: MemberRole;
  memberDisplayName?: string;
  isSuperAdmin: boolean;
}

// 테넌트 초대
export interface TenantInvitation {
  id: string;
  tenantId: string;
  email: string;
  role: MemberRole;
  token: string;
  status: 'pending' | 'accepted' | 'expired';
  expiresAt: string;
  invitedBy: string;
  createdAt: string;
  acceptedAt?: string;
}

// 구독 플랜 정의
export interface SubscriptionPlanDefinition {
  id: string;
  name: string;
  nameKo: string;
  description?: string;
  features: TenantFeatures;
  priceMonthly: number;
  priceYearly: number;
  isActive: boolean;
  displayOrder: number;
}

// API 응답 타입
export interface TenantListResponse {
  tenants: Tenant[];
  total: number;
}

export interface TenantMemberListResponse {
  members: TenantMember[];
  total: number;
}

// 역할 계층 확인 함수용 상수
export const ROLE_HIERARCHY: Record<MemberRole, number> = {
  owner: 4,
  admin: 3,
  lawyer: 2,
  staff: 1,
};

// 역할 이상인지 확인
export function hasRoleOrHigher(userRole: MemberRole, requiredRole: MemberRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

// 역할 표시 이름
export const ROLE_DISPLAY_NAMES: Record<MemberRole, string> = {
  owner: '소유자',
  admin: '관리자',
  lawyer: '변호사',
  staff: '직원',
};

// 테넌트 타입 표시 이름
export const TENANT_TYPE_DISPLAY_NAMES: Record<TenantType, string> = {
  individual: '개인 사무소',
  firm: '법무법인',
};

// 플랜 표시 이름
export const PLAN_DISPLAY_NAMES: Record<SubscriptionPlan, string> = {
  basic: '베이직',
  professional: '프로페셔널',
  enterprise: '엔터프라이즈',
};
