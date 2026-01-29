/**
 * File Restore API
 * POST /api/drive/files/[id]/restore - Restore file from trash
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withTenant } from '@/lib/api/with-tenant'

/**
 * POST /api/drive/files/[id]/restore
 * Restore a soft-deleted file
 */
export const POST = withTenant(async (request: NextRequest, { tenant, params }) => {
  try {
    const fileId = params?.id
    if (!fileId) {
      return NextResponse.json(
        { success: false, error: 'File ID is required' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Check file exists and is deleted
    const { data: file, error: fetchError } = await supabase
      .from('r2_files')
      .select('*')
      .eq('id', fileId)
      .not('deleted_at', 'is', null)
      .single()

    if (fetchError || !file) {
      return NextResponse.json(
        { success: false, error: 'File not found in trash' },
        { status: 404 }
      )
    }

    // Verify tenant access
    if (file.tenant_id !== tenant.tenantId && !tenant.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    // Restore file by clearing deleted_at
    const { data: restoredFile, error: restoreError } = await supabase
      .from('r2_files')
      .update({ deleted_at: null })
      .eq('id', fileId)
      .select()
      .single()

    if (restoreError) {
      throw restoreError
    }

    return NextResponse.json({
      success: true,
      message: 'File restored from trash',
      file: restoredFile,
    })
  } catch (error) {
    console.error('Error in POST /api/drive/files/[id]/restore:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
