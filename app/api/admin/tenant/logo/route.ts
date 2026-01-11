/**
 * POST /api/admin/tenant/logo
 * 테넌트 로고 업로드
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withTenant } from '@/lib/api/with-tenant';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export const POST = withTenant(async (request, { tenant }) => {
  try {
    // 권한 확인 (owner 또는 admin만)
    if (!['owner', 'admin'].includes(tenant.memberRole)) {
      return NextResponse.json(
        { success: false, error: '로고 변경 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('logo') as File | null;
    const type = formData.get('type') as string || 'light'; // light or dark

    if (!file) {
      return NextResponse.json(
        { success: false, error: '로고 파일이 필요합니다.' },
        { status: 400 }
      );
    }

    // 파일 유효성 검사
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'PNG, JPG, WebP, SVG 파일만 업로드 가능합니다.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: '파일 크기는 2MB 이하여야 합니다.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 파일 확장자 추출
    const ext = file.name.split('.').pop() || 'png';
    const fileName = `${tenant.tenantId}/${type === 'dark' ? 'logo-dark' : 'logo'}.${ext}`;

    // 기존 로고 삭제 (있으면)
    await supabase.storage
      .from('tenant-logos')
      .remove([fileName]);

    // 새 로고 업로드
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('tenant-logos')
      .upload(fileName, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Logo upload error:', uploadError);
      return NextResponse.json(
        { success: false, error: '로고 업로드에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 공개 URL 가져오기
    const { data: urlData } = supabase.storage
      .from('tenant-logos')
      .getPublicUrl(fileName);

    const logoUrl = urlData.publicUrl;

    // 테넌트 테이블 업데이트
    const updateField = type === 'dark' ? 'logo_dark_url' : 'logo_url';
    const { error: updateError } = await supabase
      .from('tenants')
      .update({
        [updateField]: logoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenant.tenantId);

    if (updateError) {
      console.error('Tenant update error:', updateError);
      return NextResponse.json(
        { success: false, error: '로고 정보 저장에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        logoUrl,
        type,
      },
    });

  } catch (error) {
    console.error('Logo API error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/admin/tenant/logo
 * 테넌트 로고 삭제
 */
export const DELETE = withTenant(async (request, { tenant }) => {
  try {
    // 권한 확인
    if (!['owner', 'admin'].includes(tenant.memberRole)) {
      return NextResponse.json(
        { success: false, error: '로고 삭제 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'light';

    const supabase = createAdminClient();

    // 스토리지에서 삭제
    const extensions = ['png', 'jpg', 'jpeg', 'webp', 'svg'];
    const fileNames = extensions.map(ext =>
      `${tenant.tenantId}/${type === 'dark' ? 'logo-dark' : 'logo'}.${ext}`
    );

    await supabase.storage
      .from('tenant-logos')
      .remove(fileNames);

    // 테넌트 테이블 업데이트
    const updateField = type === 'dark' ? 'logo_dark_url' : 'logo_url';
    await supabase
      .from('tenants')
      .update({
        [updateField]: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenant.tenantId);

    return NextResponse.json({
      success: true,
      message: '로고가 삭제되었습니다.',
    });

  } catch (error) {
    console.error('Logo delete error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});
