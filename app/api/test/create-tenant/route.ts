/**
 * Test endpoint - Create a test tenant for development
 * POST /api/test/create-tenant
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Missing env vars' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  // Check if tenant already exists
  const { data: existing } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', 'theyool')
    .single();

  if (existing) {
    return NextResponse.json({
      success: true,
      message: 'Tenant already exists',
      tenantId: existing.id,
    });
  }

  // Create test tenant
  const { data, error } = await supabase
    .from('tenants')
    .insert({
      name: '법무법인 더율',
      slug: 'theyool',
      type: 'firm',
      phone: '031-647-3777',
      email: 'admin@theyool.kr',
      address: '경기도 천안시',
      has_homepage: true,
      homepage_domain: 'theyool.kr',
      homepage_subdomain: 'theyool',
      plan: 'enterprise',
      plan_started_at: new Date().toISOString(),
      features: {
        maxCases: -1,
        maxClients: -1,
        maxMembers: -1,
        scourtSync: true,
        clientPortal: true,
        homepage: true,
      },
      status: 'active',
      is_verified: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Tenant created',
    tenant: data,
  });
}
