/**
 * 개별 멤버 권한 오버라이드 API
 * GET: 특정 멤버의 오버라이드 조회
 * PUT: 특정 멤버의 오버라이드 설정
 * DELETE: 특정 멤버의 오버라이드 초기화 (역할 기본값으로)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTenantContext } from '@/lib/auth/tenant-context';
import { createClient } from '@/lib/supabase/server';
import {
  getMemberPermissions,
  setMemberPermissionOverride,
  clearMemberPermissionOverrides,
  clearMemberModuleOverride,
  getEffectivePermissions,
  ALL_MODULES,
  type DataScope,
} from '@/lib/auth/permission-service';
import { MemberRole } from '@/types/tenant';

// GET: 특정 멤버의 권한 조회 (오버라이드 + 최종 권한)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;

    const tenant = await getCurrentTenantContext();
    if (!tenant) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    // owner, admin만 조회 가능
    if (!tenant.isSuperAdmin && !['owner', 'admin'].includes(tenant.memberRole)) {
      return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const supabase = await createClient();

    // 멤버 정보 조회
    const { data: member, error: memberError } = await supabase
      .from('tenant_members')
      .select('id, display_name, role, email, status')
      .eq('id', memberId)
      .eq('tenant_id', tenant.tenantId)
      .single();

    if (memberError || !member) {
      return NextResponse.json({ success: false, error: '멤버를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 오버라이드 조회
    const overrides = await getMemberPermissions(memberId);

    // 최종 권한 계산
    const effectivePermissions = await getEffectivePermissions(
      tenant.tenantId,
      memberId,
      member.role as MemberRole
    );

    return NextResponse.json({
      success: true,
      data: {
        member: {
          id: member.id,
          displayName: member.display_name,
          role: member.role,
          email: member.email,
          status: member.status,
        },
        overrides,
        effectivePermissions,
      },
    });
  } catch (error) {
    console.error('GET member permissions error:', error);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PUT: 특정 멤버의 권한 오버라이드 설정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;

    const tenant = await getCurrentTenantContext();
    if (!tenant) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    // owner, admin만 수정 가능
    if (!tenant.isSuperAdmin && !['owner', 'admin'].includes(tenant.memberRole)) {
      return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const supabase = await createClient();

    // 멤버 정보 조회
    const { data: member, error: memberError } = await supabase
      .from('tenant_members')
      .select('id, role')
      .eq('id', memberId)
      .eq('tenant_id', tenant.tenantId)
      .single();

    if (memberError || !member) {
      return NextResponse.json({ success: false, error: '멤버를 찾을 수 없습니다.' }, { status: 404 });
    }

    // owner 멤버의 권한은 수정 불가
    if (member.role === 'owner') {
      return NextResponse.json({ success: false, error: 'Owner 멤버의 권한은 수정할 수 없습니다.' }, { status: 400 });
    }

    // admin이 admin 멤버를 수정하려고 하면 거부 (owner만 가능)
    if (member.role === 'admin' && tenant.memberRole === 'admin' && !tenant.isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Admin 멤버의 권한은 Owner만 수정할 수 있습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { module, canRead, canWrite, canDelete, dataScope } = body;

    // 유효성 검사
    if (!module) {
      return NextResponse.json({ success: false, error: '모듈은 필수입니다.' }, { status: 400 });
    }

    if (!ALL_MODULES.includes(module)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 모듈입니다.' }, { status: 400 });
    }

    // 모든 값이 null이면 오버라이드 삭제
    if (canRead === null && canWrite === null && canDelete === null && dataScope === null) {
      const success = await clearMemberModuleOverride(memberId, module);
      if (!success) {
        return NextResponse.json({ success: false, error: '권한 초기화에 실패했습니다.' }, { status: 500 });
      }
      return NextResponse.json({ success: true, message: '오버라이드가 초기화되었습니다.' });
    }

    const success = await setMemberPermissionOverride(tenant.tenantId, memberId, module, {
      canRead,
      canWrite,
      canDelete,
      dataScope: dataScope as DataScope | null,
    });

    if (!success) {
      return NextResponse.json({ success: false, error: '권한 오버라이드 설정에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT member permissions error:', error);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE: 특정 멤버의 모든 권한 오버라이드 초기화
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;

    const tenant = await getCurrentTenantContext();
    if (!tenant) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    // owner, admin만 삭제 가능
    if (!tenant.isSuperAdmin && !['owner', 'admin'].includes(tenant.memberRole)) {
      return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const supabase = await createClient();

    // 멤버가 같은 테넌트 소속인지 확인
    const { data: member, error: memberError } = await supabase
      .from('tenant_members')
      .select('id, role')
      .eq('id', memberId)
      .eq('tenant_id', tenant.tenantId)
      .single();

    if (memberError || !member) {
      return NextResponse.json({ success: false, error: '멤버를 찾을 수 없습니다.' }, { status: 404 });
    }

    // admin이 admin 멤버를 수정하려고 하면 거부 (owner만 가능)
    if (member.role === 'admin' && tenant.memberRole === 'admin' && !tenant.isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Admin 멤버의 권한은 Owner만 수정할 수 있습니다.' }, { status: 403 });
    }

    const success = await clearMemberPermissionOverrides(memberId);

    if (!success) {
      return NextResponse.json({ success: false, error: '권한 초기화에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '모든 권한 오버라이드가 초기화되었습니다.' });
  } catch (error) {
    console.error('DELETE member permissions error:', error);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
