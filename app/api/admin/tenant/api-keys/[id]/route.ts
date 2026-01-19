/**
 * 개별 API 키 관리
 * PATCH /api/admin/tenant/api-keys/[id] - API 키 수정 (활성화/비활성화)
 * DELETE /api/admin/tenant/api-keys/[id] - API 키 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/with-tenant';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const getServiceClient = () => {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
};

// PATCH - API 키 수정
export const PATCH = withRole('admin')(async (request, { tenant, params }) => {
  const id = params?.id;
  if (!id) {
    return NextResponse.json(
      { success: false, error: 'API 키 ID가 필요합니다.' },
      { status: 400 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { name, isActive, allowedOrigins, rateLimitPerMinute } = body;

  const supabase = getServiceClient();

  // 소유권 확인
  const { data: existingKey } = await supabase
    .from('tenant_api_keys')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', tenant.tenantId)
    .single();

  if (!existingKey) {
    return NextResponse.json(
      { success: false, error: 'API 키를 찾을 수 없습니다.' },
      { status: 404 }
    );
  }

  // 업데이트할 필드 구성
  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (isActive !== undefined) updateData.is_active = isActive;
  if (allowedOrigins !== undefined) updateData.allowed_origins = allowedOrigins;
  if (rateLimitPerMinute !== undefined) updateData.rate_limit_per_minute = rateLimitPerMinute;

  const { data: updatedKey, error } = await supabase
    .from('tenant_api_keys')
    .update(updateData)
    .eq('id', id)
    .select('id, key_prefix, name, scopes, rate_limit_per_minute, allowed_origins, is_active, expires_at, last_used_at, usage_count, created_at')
    .single();

  if (error) {
    console.error('Failed to update API key:', error);
    return NextResponse.json(
      { success: false, error: 'API 키 수정에 실패했습니다.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: updatedKey,
  });
});

// DELETE - API 키 삭제
export const DELETE = withRole('admin')(async (request, { tenant, params }) => {
  const id = params?.id;
  if (!id) {
    return NextResponse.json(
      { success: false, error: 'API 키 ID가 필요합니다.' },
      { status: 400 }
    );
  }

  const supabase = getServiceClient();

  // 소유권 확인 및 삭제
  const { error } = await supabase
    .from('tenant_api_keys')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenant.tenantId);

  if (error) {
    console.error('Failed to delete API key:', error);
    return NextResponse.json(
      { success: false, error: 'API 키 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'API 키가 삭제되었습니다.',
  });
});
