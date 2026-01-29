/**
 * Folder Restore API
 * POST /api/drive/folders/[id]/restore - Restore folder from trash
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withTenant } from '@/lib/api/with-tenant'

/**
 * POST /api/drive/folders/[id]/restore
 * Restore a soft-deleted folder
 */
export const POST = withTenant(async (request: NextRequest, { tenant, params }) => {
  try {
    const folderId = params?.id
    if (!folderId) {
      return NextResponse.json(
        { success: false, error: 'Folder ID is required' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Check folder exists and is deleted
    const { data: folder, error: fetchError } = await supabase
      .from('r2_folders')
      .select('*')
      .eq('id', folderId)
      .not('deleted_at', 'is', null)
      .single()

    if (fetchError || !folder) {
      return NextResponse.json(
        { success: false, error: 'Folder not found in trash' },
        { status: 404 }
      )
    }

    // Verify tenant access
    if (folder.tenant_id !== tenant.tenantId && !tenant.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    // Restore folder by clearing deleted_at
    const { data: restoredFolder, error: restoreError } = await supabase
      .from('r2_folders')
      .update({ deleted_at: null })
      .eq('id', folderId)
      .select()
      .single()

    if (restoreError) {
      throw restoreError
    }

    return NextResponse.json({
      success: true,
      message: 'Folder restored from trash',
      folder: restoredFolder,
    })
  } catch (error) {
    console.error('Error in POST /api/drive/folders/[id]/restore:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
