/**
 * 권한 시스템 타입 및 상수 정의
 * 클라이언트/서버 양쪽에서 사용 가능
 */

import { MemberRole } from '@/types/tenant';

// 권한 모듈 타입
export type PermissionModule =
  | 'dashboard'
  | 'calendar'
  | 'cases'
  | 'clients'
  | 'consultations'
  | 'expenses'
  | 'payments'
  | 'receivables'
  | 'homepage'
  | 'settings'
  | 'team';

// 권한 액션 타입
export type PermissionAction = 'read' | 'write' | 'delete';

// 데이터 범위 타입
export type DataScope = 'all' | 'assigned' | 'own';

// 권한 객체 타입
export interface ModulePermission {
  module: PermissionModule;
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  dataScope: DataScope;
}

// 역할별 권한 타입
export interface RolePermission {
  id: string;
  tenantId: string;
  role: MemberRole;
  module: PermissionModule;
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  dataScope: DataScope;
}

// 멤버별 권한 오버라이드 타입
export interface MemberPermission {
  id: string;
  tenantId: string;
  memberId: string;
  module: PermissionModule;
  canRead: boolean | null;
  canWrite: boolean | null;
  canDelete: boolean | null;
  dataScope: DataScope | null;
}

// 모듈 표시 이름
export const MODULE_DISPLAY_NAMES: Record<PermissionModule, string> = {
  dashboard: '대시보드',
  calendar: '일정',
  cases: '사건',
  clients: '의뢰인',
  consultations: '상담',
  expenses: '지출',
  payments: '입금',
  receivables: '미수금',
  homepage: '홈페이지',
  settings: '설정',
  team: '팀원 관리',
};

// 모듈 설명
export const MODULE_DESCRIPTIONS: Record<PermissionModule, string> = {
  dashboard: '대시보드 조회',
  calendar: '일정 및 기일 확인',
  cases: '사건 등록, 조회, 수정',
  clients: '의뢰인 정보 관리',
  consultations: '상담 예약 및 관리',
  expenses: '법인 지출 관리',
  payments: '수임료 입금 관리',
  receivables: '미수금 현황 관리',
  homepage: '홈페이지 콘텐츠 관리',
  settings: '시스템 설정 관리',
  team: '팀원 계정 관리',
};

// 모든 모듈 목록
export const ALL_MODULES: PermissionModule[] = [
  'dashboard',
  'calendar',
  'cases',
  'clients',
  'consultations',
  'expenses',
  'payments',
  'receivables',
  'homepage',
  'settings',
  'team',
];

// 데이터 범위 표시 이름
export const DATA_SCOPE_DISPLAY_NAMES: Record<DataScope, string> = {
  all: '전체',
  assigned: '담당 변호사 데이터',
  own: '본인 데이터',
};

/**
 * 기본 역할별 권한 매트릭스 (코드 폴백용)
 */
export function getDefaultRolePermissions(role: MemberRole): ModulePermission[] {
  const defaults: Record<MemberRole, Record<PermissionModule, ModulePermission>> = {
    owner: Object.fromEntries(
      ALL_MODULES.map((m) => [
        m,
        { module: m, canRead: true, canWrite: true, canDelete: true, dataScope: 'all' as DataScope },
      ])
    ) as Record<PermissionModule, ModulePermission>,

    admin: Object.fromEntries(
      ALL_MODULES.map((m) => [
        m,
        { module: m, canRead: true, canWrite: true, canDelete: true, dataScope: 'all' as DataScope },
      ])
    ) as Record<PermissionModule, ModulePermission>,

    lawyer: {
      dashboard: { module: 'dashboard', canRead: true, canWrite: false, canDelete: false, dataScope: 'all' },
      calendar: { module: 'calendar', canRead: true, canWrite: true, canDelete: false, dataScope: 'own' },
      cases: { module: 'cases', canRead: true, canWrite: true, canDelete: false, dataScope: 'own' },
      clients: { module: 'clients', canRead: true, canWrite: true, canDelete: false, dataScope: 'own' },
      consultations: { module: 'consultations', canRead: true, canWrite: true, canDelete: false, dataScope: 'all' },
      expenses: { module: 'expenses', canRead: true, canWrite: false, canDelete: false, dataScope: 'all' },
      payments: { module: 'payments', canRead: true, canWrite: false, canDelete: false, dataScope: 'all' },
      receivables: { module: 'receivables', canRead: true, canWrite: false, canDelete: false, dataScope: 'all' },
      homepage: { module: 'homepage', canRead: false, canWrite: false, canDelete: false, dataScope: 'all' },
      settings: { module: 'settings', canRead: false, canWrite: false, canDelete: false, dataScope: 'all' },
      team: { module: 'team', canRead: false, canWrite: false, canDelete: false, dataScope: 'all' },
    },

    staff: {
      dashboard: { module: 'dashboard', canRead: true, canWrite: false, canDelete: false, dataScope: 'all' },
      calendar: { module: 'calendar', canRead: true, canWrite: false, canDelete: false, dataScope: 'assigned' },
      cases: { module: 'cases', canRead: true, canWrite: false, canDelete: false, dataScope: 'assigned' },
      clients: { module: 'clients', canRead: true, canWrite: false, canDelete: false, dataScope: 'assigned' },
      consultations: { module: 'consultations', canRead: true, canWrite: false, canDelete: false, dataScope: 'all' },
      expenses: { module: 'expenses', canRead: false, canWrite: false, canDelete: false, dataScope: 'all' },
      payments: { module: 'payments', canRead: false, canWrite: false, canDelete: false, dataScope: 'all' },
      receivables: { module: 'receivables', canRead: false, canWrite: false, canDelete: false, dataScope: 'all' },
      homepage: { module: 'homepage', canRead: false, canWrite: false, canDelete: false, dataScope: 'all' },
      settings: { module: 'settings', canRead: false, canWrite: false, canDelete: false, dataScope: 'all' },
      team: { module: 'team', canRead: false, canWrite: false, canDelete: false, dataScope: 'all' },
    },
  };

  return Object.values(defaults[role]);
}
