/**
 * 모듈별 세부 권한 서비스 (서버 전용)
 * 역할별 기본 권한 + 개별 멤버 오버라이드 지원
 */

import { createClient } from '@/lib/supabase/server';
import { MemberRole, TenantContext } from '@/types/tenant';

// Re-export types and constants from permission-types
export * from './permission-types';

import {
  type PermissionModule,
  type PermissionAction,
  type DataScope,
  type ModulePermission,
  type RolePermission,
  type MemberPermission,
  MODULE_DISPLAY_NAMES,
  ALL_MODULES,
  getDefaultRolePermissions,
} from './permission-types';

/**
 * 테넌트의 역할별 권한 조회
 */
export async function getRolePermissions(tenantId: string): Promise<RolePermission[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('role_permissions')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('role')
    .order('module');

  if (error) {
    console.error('Failed to fetch role permissions:', error);
    return [];
  }

  return (data || []).map((p) => ({
    id: p.id,
    tenantId: p.tenant_id,
    role: p.role as MemberRole,
    module: p.module as PermissionModule,
    canRead: p.can_read,
    canWrite: p.can_write,
    canDelete: p.can_delete,
    dataScope: p.data_scope as DataScope,
  }));
}

/**
 * 특정 멤버의 권한 오버라이드 조회
 */
export async function getMemberPermissions(memberId: string): Promise<MemberPermission[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('member_permissions')
    .select('*')
    .eq('member_id', memberId)
    .order('module');

  if (error) {
    console.error('Failed to fetch member permissions:', error);
    return [];
  }

  return (data || []).map((p) => ({
    id: p.id,
    tenantId: p.tenant_id,
    memberId: p.member_id,
    module: p.module as PermissionModule,
    canRead: p.can_read,
    canWrite: p.can_write,
    canDelete: p.can_delete,
    dataScope: p.data_scope as DataScope | null,
  }));
}

/**
 * 특정 멤버의 최종 권한 계산 (역할 기본값 + 오버라이드)
 */
export async function getEffectivePermissions(
  tenantId: string,
  memberId: string,
  role: MemberRole
): Promise<ModulePermission[]> {
  const [rolePermissions, memberOverrides] = await Promise.all([
    getRolePermissions(tenantId),
    getMemberPermissions(memberId),
  ]);

  // 역할별 기본 권한을 모듈별로 매핑
  const rolePermMap = new Map<PermissionModule, ModulePermission>();

  // DB에서 가져온 역할 권한이 있으면 사용
  const rolePermsForRole = rolePermissions.filter((p) => p.role === role);
  if (rolePermsForRole.length > 0) {
    rolePermsForRole.forEach((p) => {
      rolePermMap.set(p.module, {
        module: p.module,
        canRead: p.canRead,
        canWrite: p.canWrite,
        canDelete: p.canDelete,
        dataScope: p.dataScope,
      });
    });
  } else {
    // DB에 없으면 코드 기본값 사용
    const defaults = getDefaultRolePermissions(role);
    defaults.forEach((p) => rolePermMap.set(p.module, p));
  }

  // 멤버 오버라이드를 모듈별로 매핑
  const memberOverrideMap = new Map<PermissionModule, MemberPermission>();
  memberOverrides.forEach((p) => memberOverrideMap.set(p.module, p));

  // 최종 권한 계산
  const effectivePermissions: ModulePermission[] = [];

  for (const permissionModule of ALL_MODULES) {
    const rolePerm = rolePermMap.get(permissionModule);
    const memberOverride = memberOverrideMap.get(permissionModule);

    if (!rolePerm) {
      // 역할 권한이 없으면 모든 권한 없음
      effectivePermissions.push({
        module: permissionModule,
        canRead: false,
        canWrite: false,
        canDelete: false,
        dataScope: 'all',
      });
      continue;
    }

    // 오버라이드가 있으면 적용 (null이면 역할 기본값 사용)
    effectivePermissions.push({
      module: permissionModule,
      canRead: memberOverride?.canRead ?? rolePerm.canRead,
      canWrite: memberOverride?.canWrite ?? rolePerm.canWrite,
      canDelete: memberOverride?.canDelete ?? rolePerm.canDelete,
      dataScope: memberOverride?.dataScope ?? rolePerm.dataScope,
    });
  }

  return effectivePermissions;
}

/**
 * 특정 모듈에 대한 권한 확인
 */
export async function checkModulePermission(
  tenantContext: TenantContext,
  module: PermissionModule,
  action: PermissionAction
): Promise<boolean> {
  // 슈퍼 어드민은 항상 허용
  if (tenantContext.isSuperAdmin) {
    return true;
  }

  const permissions = await getEffectivePermissions(
    tenantContext.tenantId,
    tenantContext.memberId,
    tenantContext.memberRole
  );

  const modulePerm = permissions.find((p) => p.module === module);
  if (!modulePerm) {
    return false;
  }

  switch (action) {
    case 'read':
      return modulePerm.canRead;
    case 'write':
      return modulePerm.canWrite;
    case 'delete':
      return modulePerm.canDelete;
    default:
      return false;
  }
}

/**
 * 특정 모듈의 데이터 범위 조회
 */
export async function getModuleDataScope(
  tenantContext: TenantContext,
  module: PermissionModule
): Promise<DataScope> {
  // 슈퍼 어드민은 항상 전체
  if (tenantContext.isSuperAdmin) {
    return 'all';
  }

  const permissions = await getEffectivePermissions(
    tenantContext.tenantId,
    tenantContext.memberId,
    tenantContext.memberRole
  );

  const modulePerm = permissions.find((p) => p.module === module);
  return modulePerm?.dataScope ?? 'all';
}

/**
 * 역할별 기본 권한 업데이트
 */
export async function updateRolePermission(
  tenantId: string,
  role: MemberRole,
  module: PermissionModule,
  updates: Partial<{
    canRead: boolean;
    canWrite: boolean;
    canDelete: boolean;
    dataScope: DataScope;
  }>
): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('role_permissions')
    .upsert(
      {
        tenant_id: tenantId,
        role,
        module,
        can_read: updates.canRead,
        can_write: updates.canWrite,
        can_delete: updates.canDelete,
        data_scope: updates.dataScope,
      },
      {
        onConflict: 'tenant_id,role,module',
      }
    );

  if (error) {
    console.error('Failed to update role permission:', error);
    return false;
  }

  return true;
}

/**
 * 멤버별 권한 오버라이드 설정
 */
export async function setMemberPermissionOverride(
  tenantId: string,
  memberId: string,
  module: PermissionModule,
  overrides: Partial<{
    canRead: boolean | null;
    canWrite: boolean | null;
    canDelete: boolean | null;
    dataScope: DataScope | null;
  }>
): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('member_permissions')
    .upsert(
      {
        tenant_id: tenantId,
        member_id: memberId,
        module,
        can_read: overrides.canRead,
        can_write: overrides.canWrite,
        can_delete: overrides.canDelete,
        data_scope: overrides.dataScope,
      },
      {
        onConflict: 'tenant_id,member_id,module',
      }
    );

  if (error) {
    console.error('Failed to set member permission override:', error);
    return false;
  }

  return true;
}

/**
 * 멤버별 권한 오버라이드 초기화 (역할 기본값으로)
 */
export async function clearMemberPermissionOverrides(memberId: string): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('member_permissions')
    .delete()
    .eq('member_id', memberId);

  if (error) {
    console.error('Failed to clear member permission overrides:', error);
    return false;
  }

  return true;
}

/**
 * 특정 모듈에 대한 멤버 오버라이드 삭제
 */
export async function clearMemberModuleOverride(
  memberId: string,
  module: PermissionModule
): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('member_permissions')
    .delete()
    .eq('member_id', memberId)
    .eq('module', module);

  if (error) {
    console.error('Failed to clear member module override:', error);
    return false;
  }

  return true;
}

/**
 * 권한 검사 미들웨어용 헬퍼
 */
export function requirePermission(
  module: PermissionModule,
  action: PermissionAction
) {
  return async (tenantContext: TenantContext): Promise<{ allowed: boolean; error?: string }> => {
    const allowed = await checkModulePermission(tenantContext, module, action);

    if (!allowed) {
      return {
        allowed: false,
        error: `${MODULE_DISPLAY_NAMES[module]}에 대한 ${
          action === 'read' ? '조회' : action === 'write' ? '수정' : '삭제'
        } 권한이 없습니다.`,
      };
    }

    return { allowed: true };
  };
}
