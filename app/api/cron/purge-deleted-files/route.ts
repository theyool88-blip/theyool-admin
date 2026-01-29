/**
 * Purge Deleted Files Cron Endpoint
 * POST /api/cron/purge-deleted-files
 *
 * Purges files/folders deleted more than 30 days ago.
 * Protected by CRON_SECRET header.
 * CRITICAL: Decrements tenant_storage.used_bytes to prevent count drift.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'
import { deleteObject } from '@/lib/r2/r2-client'

export async function POST(_request: NextRequest) {
  // Verify cron secret
  const headersList = await headers()
  const authHeader = headersList.get('authorization')

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  try {
    // 1. SELECT files to get their sizes and tenant_ids for storage update
    const { data: filesToPurge, error: selectError } = await supabase
      .from('r2_files')
      .select('id, r2_key, file_size, tenant_id')
      .lt('deleted_at', thirtyDaysAgo.toISOString())

    if (selectError) {
      console.error('Error selecting files to purge:', selectError)
      return NextResponse.json({ error: 'Failed to query files' }, { status: 500 })
    }

    // 2. Group files by tenant_id to calculate storage decrements
    const tenantStorageDecrements: Record<string, { bytes: number; count: number }> = {}
    for (const file of filesToPurge || []) {
      if (!tenantStorageDecrements[file.tenant_id]) {
        tenantStorageDecrements[file.tenant_id] = { bytes: 0, count: 0 }
      }
      tenantStorageDecrements[file.tenant_id].bytes += file.file_size || 0
      tenantStorageDecrements[file.tenant_id].count += 1
    }

    // 3. Delete files from database
    const fileIds = (filesToPurge || []).map(f => f.id)
    let deletedFilesCount = 0
    if (fileIds.length > 0) {
      const { error: deleteError, count } = await supabase
        .from('r2_files')
        .delete()
        .in('id', fileIds)

      if (deleteError) {
        console.error('Error deleting files from DB:', deleteError)
      } else {
        deletedFilesCount = count || fileIds.length
      }
    }

    // 4. Decrement storage for each tenant using atomic RPC
    const storageUpdateResults: Record<string, boolean> = {}
    for (const [tenantId, decrement] of Object.entries(tenantStorageDecrements)) {
      const { error: rpcError } = await supabase.rpc('update_tenant_storage_atomic', {
        p_tenant_id: tenantId,
        p_delta_bytes: -decrement.bytes,  // NEGATIVE delta to decrement
        p_delta_files: -decrement.count,   // NEGATIVE delta to decrement
      })
      storageUpdateResults[tenantId] = !rpcError
      if (rpcError) {
        console.error(`Failed to update storage for tenant ${tenantId}:`, rpcError)
      }
    }

    // 5. Delete old trashed folders (no storage impact for folders)
    const { data: deletedFolders, error: foldersError } = await supabase
      .from('r2_folders')
      .delete()
      .lt('deleted_at', thirtyDaysAgo.toISOString())
      .select('id')

    if (foldersError) {
      console.error('Error deleting folders:', foldersError)
    }

    // 6. Delete from R2 storage (the actual files)
    const r2DeleteResults: { id: string; success: boolean }[] = []
    for (const file of filesToPurge || []) {
      try {
        await deleteObject(file.r2_key)
        r2DeleteResults.push({ id: file.id, success: true })
      } catch (err) {
        console.error(`Failed to delete R2 object ${file.r2_key}:`, err)
        r2DeleteResults.push({ id: file.id, success: false })
      }
    }

    return NextResponse.json({
      success: true,
      purged: {
        files: deletedFilesCount,
        folders: deletedFolders?.length || 0,
        r2Objects: r2DeleteResults.filter(r => r.success).length,
      },
      storageUpdated: storageUpdateResults,
      tenantsAffected: Object.keys(tenantStorageDecrements).length,
    })
  } catch (error) {
    console.error('Purge cron error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
