/**
 * 테넌트 API 키 관리
 * GET /api/admin/tenant/api-keys - API 키 목록 조회
 * POST /api/admin/tenant/api-keys - 새 API 키 발급
 */

import { NextResponse } from 'next/server';
import { withRole } from '@/lib/api/with-tenant';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const getServiceClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
    }
  );
};

// GET - API 키 목록 조회
export const GET = withRole('admin')(async (request, { tenant }) => {
  const supabase = getServiceClient();

  const { data: keys, error } = await supabase
    .from('tenant_api_keys')
    .select('id, key_prefix, name, scopes, rate_limit_per_minute, allowed_origins, is_active, expires_at, last_used_at, usage_count, created_at')
    .eq('tenant_id', tenant.tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch API keys:', error);
    return NextResponse.json(
      { success: false, error: 'API 키 목록을 가져올 수 없습니다.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: keys || [],
  });
});

// POST - 새 API 키 발급
export const POST = withRole('admin')(async (request, { tenant }) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { name, scopes, rateLimitPerMinute, allowedOrigins, expiresAt } = body;

  // API 키 생성 (pk_live_ + 32바이트 랜덤)
  const randomBytes = crypto.randomBytes(24).toString('base64url');
  const apiKey = `pk_live_${randomBytes}`;
  const keyPrefix = apiKey.substring(0, 12);

  // 해시 생성
  const keyHash = await bcrypt.hash(apiKey, 10);

  const supabase = getServiceClient();

  const { data: newKey, error } = await supabase
    .from('tenant_api_keys')
    .insert({
      tenant_id: tenant.tenantId,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      name: name || '홈페이지 연동용',
      scopes: scopes || ['consultations:write', 'bookings:write', 'visitor:write'],
      rate_limit_per_minute: rateLimitPerMinute || 60,
      allowed_origins: allowedOrigins || [],
      expires_at: expiresAt || null,
      created_by: tenant.memberId,
    })
    .select('id, key_prefix, name, scopes, rate_limit_per_minute, allowed_origins, is_active, expires_at, created_at')
    .single();

  if (error) {
    console.error('Failed to create API key:', error);
    return NextResponse.json(
      { success: false, error: 'API 키 생성에 실패했습니다.' },
      { status: 500 }
    );
  }

  // 생성된 키 반환 (이 때만 전체 키 노출)
  return NextResponse.json({
    success: true,
    data: {
      ...newKey,
      apiKey, // 전체 키는 생성 시에만 반환
    },
    message: 'API 키가 생성되었습니다. 이 키는 다시 확인할 수 없으니 안전하게 보관하세요.',
  }, { status: 201 });
});
