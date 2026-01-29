/**
 * 모듈별 권한 체크 유틸리티
 *
 * 계정 유형:
 * - 전체 권한 (owner/admin): 모든 모듈 접근 가능
 * - 회계 제외 (lawyer/staff): 회계 모듈(payments, expenses, receivables) 접근 불가
 */

import { MemberRole, TenantContext } from '@/types/tenant';

// 모듈 타입 정의
export type PermissionModule =
  | 'cases'         // 사건관리
  | 'clients'       // 의뢰인관리
  | 'consultations' // 상담관리
  | 'payments'      // 수임료관리 (회계)
  | 'expenses'      // 지출관리 (회계)
  | 'receivables'   // 미수금관리 (회계)
  | 'calendar'      // 캘린더
  | 'drive'         // 드라이브 (파일관리)
  | 'settings'      // 설정
  | 'members'       // 멤버관리
  | 'dashboard';    // 대시보드

// 회계 관련 모듈 (제한된 계정은 접근 불가)
export const ACCOUNTING_MODULES: PermissionModule[] = ['payments', 'expenses', 'receivables'];

// 관리자 전용 모듈
export const ADMIN_ONLY_MODULES: PermissionModule[] = ['settings', 'members'];

// 전체 권한 역할
export const FULL_ACCESS_ROLES: MemberRole[] = ['owner', 'admin'];

// 회계 제외 역할
export const LIMITED_ROLES: MemberRole[] = ['lawyer', 'staff'];

/**
 * 특정 모듈에 접근 가능한지 확인
 */
export function canAccessModule(role: MemberRole, module: PermissionModule): boolean {
  // 슈퍼 어드민은 항상 접근 가능 (이 함수 호출 전에 별도 체크)

  // 전체 권한 역할은 모든 모듈 접근 가능
  if (FULL_ACCESS_ROLES.includes(role)) {
    return true;
  }

  // 회계 모듈 접근 제한
  if (ACCOUNTING_MODULES.includes(module)) {
    return false;
  }

  // 관리자 전용 모듈 접근 제한
  if (ADMIN_ONLY_MODULES.includes(module)) {
    return false;
  }

  // 나머지 모듈은 접근 가능
  return true;
}

/**
 * TenantContext로 모듈 접근 확인
 */
export function canAccessModuleWithContext(
  tenant: TenantContext,
  module: PermissionModule
): boolean {
  // 슈퍼 어드민은 모든 접근 가능
  if (tenant.isSuperAdmin) {
    return true;
  }

  return canAccessModule(tenant.memberRole, module);
}

/**
 * 회계 모듈 접근 가능 여부
 */
export function canAccessAccounting(role: MemberRole): boolean {
  return FULL_ACCESS_ROLES.includes(role);
}

/**
 * 회계 모듈 접근 가능 여부 (TenantContext 사용)
 */
export function canAccessAccountingWithContext(tenant: TenantContext): boolean {
  if (tenant.isSuperAdmin) {
    return true;
  }
  return canAccessAccounting(tenant.memberRole);
}

/**
 * 설정/멤버 관리 가능 여부
 */
export function canManageSettings(role: MemberRole): boolean {
  return FULL_ACCESS_ROLES.includes(role);
}

/**
 * 설정/멤버 관리 가능 여부 (TenantContext 사용)
 */
export function canManageSettingsWithContext(tenant: TenantContext): boolean {
  if (tenant.isSuperAdmin) {
    return true;
  }
  return canManageSettings(tenant.memberRole);
}

/**
 * 접근 가능한 모듈 목록 반환
 */
export function getAccessibleModules(role: MemberRole): PermissionModule[] {
  const allModules: PermissionModule[] = [
    'cases', 'clients', 'consultations', 'payments',
    'expenses', 'receivables', 'calendar', 'drive',
    'settings', 'members', 'dashboard'
  ];

  if (FULL_ACCESS_ROLES.includes(role)) {
    return allModules;
  }

  // 제한된 역할은 회계/관리자 모듈 제외
  return allModules.filter(module =>
    !ACCOUNTING_MODULES.includes(module) &&
    !ADMIN_ONLY_MODULES.includes(module)
  );
}

/**
 * 접근 가능한 모듈 목록 반환 (TenantContext 사용)
 */
export function getAccessibleModulesWithContext(tenant: TenantContext): PermissionModule[] {
  if (tenant.isSuperAdmin) {
    return [
      'cases', 'clients', 'consultations', 'payments',
      'expenses', 'receivables', 'calendar', 'drive',
      'settings', 'members', 'dashboard'
    ];
  }

  return getAccessibleModules(tenant.memberRole);
}

/**
 * 역할 표시 이름 (계정 유형)
 */
export function getRoleDisplayName(role: MemberRole): string {
  const displayNames: Record<MemberRole, string> = {
    owner: '소유자 (전체 권한)',
    admin: '관리자 (전체 권한)',
    lawyer: '변호사 (회계 제외)',
    staff: '직원 (회계 제외)',
  };
  return displayNames[role];
}

/**
 * 역할이 전체 권한인지 확인
 */
export function isFullAccessRole(role: MemberRole): boolean {
  return FULL_ACCESS_ROLES.includes(role);
}

/**
 * 역할이 제한 권한인지 확인
 */
export function isLimitedRole(role: MemberRole): boolean {
  return LIMITED_ROLES.includes(role);
}

/**
 * 모듈 이름 한글화
 */
export const MODULE_DISPLAY_NAMES: Record<PermissionModule, string> = {
  cases: '사건관리',
  clients: '의뢰인관리',
  consultations: '상담관리',
  payments: '수임료관리',
  expenses: '지출관리',
  receivables: '미수금관리',
  calendar: '캘린더',
  drive: '드라이브',
  settings: '설정',
  members: '멤버관리',
  dashboard: '대시보드',
};

/**
 * 모듈 설명
 */
export const MODULE_DESCRIPTIONS: Record<PermissionModule, string> = {
  cases: '사건 등록, 조회, 수정',
  clients: '의뢰인 정보 관리',
  consultations: '상담 예약 및 관리',
  payments: '수임료 입금 관리',
  expenses: '법인 지출 관리',
  receivables: '미수금 현황 관리',
  calendar: '일정 및 기일 확인',
  drive: '파일 업로드 및 관리',
  settings: '테넌트 설정 관리',
  members: '멤버 계정 관리',
  dashboard: '대시보드 조회',
};
