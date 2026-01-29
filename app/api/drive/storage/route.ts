/**
 * Storage Usage API
 * GET /api/drive/storage - Get storage usage for current tenant
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withTenant } from '@/lib/api/with-tenant'

/**
 * GET /api/drive/storage
 * Get storage usage for current tenant
 */
export const GET = withTenant(async (request: NextRequest, { tenant }) => {
  try {
    const supabase = createAdminClient()

    let query = supabase
      .from('tenant_storage')
      .select('*')

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      query = query.eq('tenant_id', tenant.tenantId)
    }

    const { data: storage, error } = await query.single()

    if (error) {
      // If no storage record exists, return defaults
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          success: true,
          storage: {
            tenant_id: tenant.tenantId,
            quota_bytes: 53687091200, // 50GB
            extra_quota_bytes: 0,
            used_bytes: 0,
            file_count: 0,
            usage_percent: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        })
      }
      throw error
    }

    const totalQuota = (storage.quota_bytes || 0) + (storage.extra_quota_bytes || 0)
    const usagePercent = totalQuota > 0
      ? (storage.used_bytes / totalQuota) * 100
      : 0

    return NextResponse.json({
      success: true,
      storage: {
        ...storage,
        usage_percent: Math.round(usagePercent * 100) / 100
      }
    })
  } catch (error) {
    console.error('Error in GET /api/drive/storage:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
