/**
 * Test endpoint - Query tenants directly
 * GET /api/test/tenants
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({
      error: 'Missing env vars',
      supabaseUrl: supabaseUrl ? 'set' : 'not set',
      supabaseServiceKey: supabaseServiceKey ? 'set' : 'not set',
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  // Try to query tenants
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, has_homepage, homepage_domain, status')
    .limit(5);

  return NextResponse.json({
    success: !error,
    supabaseUrl,
    data,
    error: error?.message,
  });
}
