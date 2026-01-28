/**
 * 권한 관리 API
 * GET: 역할별 기본 권한 + 모든 멤버 오버라이드 조회
 * PUT: 역할별 기본 권한 수정
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTenantContext } from '@/lib/auth/tenant-context';
import { createClient } from '@/lib/supabase/server';
import {
  getRolePermissions,
  updateRolePermission,
  getDefaultRolePermissions,
  ALL_MODULES,
  type PermissionModule,
  type DataScope,
} from '@/lib/auth/permission-service';
import { MemberRole } from '@/types/tenant';

// GET: 권한 설정 조회
export async function GET() {
  try {
    const tenant = await getCurrentTenantContext();
    if (!tenant) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    // owner, admin만 조회 가능
    if (!tenant.isSuperAdmin && !['owner', 'admin'].includes(tenant.memberRole)) {
      return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const supabase = await createClient();

    // 역할별 권한 조회
    const rolePermissions = await getRolePermissions(tenant.tenantId);

    // DB에 없는 역할은 기본값 사용
    const roles: MemberRole[] = ['owner', 'admin', 'lawyer', 'staff'];
    const rolePermMap: Record<MemberRole, Record<PermissionModule, {
      canRead: boolean;
      canWrite: boolean;
      canDelete: boolean;
      dataScope: DataScope;
    }>> = {} as Record<MemberRole, Record<PermissionModule, {
      canRead: boolean;
      canWrite: boolean;
      canDelete: boolean;
      dataScope: DataScope;
    }>>;

    for (const role of roles) {
      rolePermMap[role] = {} as Record<PermissionModule, {
        canRead: boolean;
        canWrite: boolean;
        canDelete: boolean;
        dataScope: DataScope;
      }>;

      const rolePerms = rolePermissions.filter((p) => p.role === role);

      if (rolePerms.length > 0) {
        for (const perm of rolePerms) {
          rolePermMap[role][perm.module] = {
            canRead: perm.canRead,
            canWrite: perm.canWrite,
            canDelete: perm.canDelete,
            dataScope: perm.dataScope,
          };
        }
      } else {
        // 기본값 사용
        const defaults = getDefaultRolePermissions(role);
        for (const def of defaults) {
          rolePermMap[role][def.module] = {
            canRead: def.canRead,
            canWrite: def.canWrite,
            canDelete: def.canDelete,
            dataScope: def.dataScope,
          };
        }
      }

      // 누락된 모듈에 대해 기본값 채우기
      for (const permissionModule of ALL_MODULES) {
        if (!rolePermMap[role][permissionModule]) {
          const defaults = getDefaultRolePermissions(role);
          const def = defaults.find((d) => d.module === permissionModule);
          if (def) {
            rolePermMap[role][permissionModule] = {
              canRead: def.canRead,
              canWrite: def.canWrite,
              canDelete: def.canDelete,
              dataScope: def.dataScope,
            };
          }
        }
      }
    }

    // 멤버별 오버라이드 조회
    const { data: memberPermissions } = await supabase
      .from('member_permissions')
      .select('*')
      .eq('tenant_id', tenant.tenantId);

    // 멤버 정보 조회
    const { data: members } = await supabase
      .from('tenant_members')
      .select('id, display_name, role, email, status')
      .eq('tenant_id', tenant.tenantId)
      .eq('status', 'active')
      .order('role')
      .order('display_name');

    // 멤버별 오버라이드 그룹화
    const memberOverrides: Record<string, Record<PermissionModule, {
      canRead: boolean | null;
      canWrite: boolean | null;
      canDelete: boolean | null;
      dataScope: DataScope | null;
    }>> = {};

    if (memberPermissions) {
      for (const perm of memberPermissions) {
        if (!memberOverrides[perm.member_id]) {
          memberOverrides[perm.member_id] = {} as Record<PermissionModule, {
            canRead: boolean | null;
            canWrite: boolean | null;
            canDelete: boolean | null;
            dataScope: DataScope | null;
          }>;
        }
        memberOverrides[perm.member_id][perm.module as PermissionModule] = {
          canRead: perm.can_read,
          canWrite: perm.can_write,
          canDelete: perm.can_delete,
          dataScope: perm.data_scope as DataScope | null,
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        rolePermissions: rolePermMap,
        memberOverrides,
        members: members || [],
        modules: ALL_MODULES,
      },
    });
  } catch (error) {
    console.error('GET permissions error:', error);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PUT: 역할별 기본 권한 수정
export async function PUT(request: NextRequest) {
  try {
    const tenant = await getCurrentTenantContext();
    if (!tenant) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    // owner, admin만 수정 가능
    if (!tenant.isSuperAdmin && !['owner', 'admin'].includes(tenant.memberRole)) {
      return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { role, module, canRead, canWrite, canDelete, dataScope } = body;

    // 유효성 검사
    if (!role || !module) {
      return NextResponse.json({ success: false, error: '역할과 모듈은 필수입니다.' }, { status: 400 });
    }

    const validRoles: MemberRole[] = ['owner', 'admin', 'lawyer', 'staff'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 역할입니다.' }, { status: 400 });
    }

    if (!ALL_MODULES.includes(module)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 모듈입니다.' }, { status: 400 });
    }

    // owner 역할은 수정 불가
    if (role === 'owner') {
      return NextResponse.json({ success: false, error: 'Owner 역할의 권한은 수정할 수 없습니다.' }, { status: 400 });
    }

    // admin이 admin 역할을 수정하려고 하면 거부 (owner만 가능)
    if (role === 'admin' && tenant.memberRole === 'admin' && !tenant.isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Admin 역할의 권한은 Owner만 수정할 수 있습니다.' }, { status: 403 });
    }

    const success = await updateRolePermission(tenant.tenantId, role, module, {
      canRead,
      canWrite,
      canDelete,
      dataScope,
    });

    if (!success) {
      return NextResponse.json({ success: false, error: '권한 수정에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT permissions error:', error);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
