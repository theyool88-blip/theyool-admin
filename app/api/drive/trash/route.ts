/**
 * Trash API
 * GET /api/drive/trash - List deleted files and folders
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withTenant } from '@/lib/api/with-tenant'

/**
 * GET /api/drive/trash
 * List all soft-deleted files and folders for the current tenant
 */
export const GET = withTenant(async (request: NextRequest, { tenant }) => {
  try {
    const supabase = createAdminClient()

    // Get deleted files
    const { data: files, error: filesError } = await supabase
      .from('r2_files')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })

    if (filesError) {
      throw filesError
    }

    // Get deleted folders
    const { data: folders, error: foldersError } = await supabase
      .from('r2_folders')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })

    if (foldersError) {
      throw foldersError
    }

    return NextResponse.json({
      success: true,
      files: files || [],
      folders: folders || [],
    })
  } catch (error) {
    console.error('Error in GET /api/drive/trash:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
