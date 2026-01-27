/**
 * Test endpoint - Query consultations
 * GET /api/test/consultations
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  // Query recent consultations
  const { data, error } = await supabase
    .from('consultations')
    .select('id, name, phone, message, status, created_at, tenant_id')
    .order('created_at', { ascending: false })
    .limit(5);

  return NextResponse.json({
    success: !error,
    data,
    error: error?.message,
  });
}
