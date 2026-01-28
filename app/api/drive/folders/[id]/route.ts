import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withTenant } from '@/lib/api/with-tenant'

/**
 * GET /api/drive/folders/[id]
 * Get single folder details with stats
 */
export const GET = withTenant(async (
  request: NextRequest,
  { tenant, params }: { tenant: { tenantId: string | null; isSuperAdmin: boolean; memberRole: string }; params?: Record<string, string> }
) => {
  try {
    const id = params?.id
    if (!id) {
      return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Fetch folder
    let folderQuery = adminClient
      .from('r2_folders')
      .select('*')
      .eq('id', id)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      folderQuery = folderQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data: folder, error: folderError } = await folderQuery.single()

    if (folderError) {
      console.error('Error fetching folder:', folderError)
      return NextResponse.json(
        { error: `Folder not found: ${folderError.message}` },
        { status: folderError.code === 'PGRST116' ? 404 : 500 }
      )
    }

    // Count subfolders
    let subfoldersQuery = adminClient
      .from('r2_folders')
      .select('*', { count: 'exact', head: true })
      .eq('parent_id', id)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      subfoldersQuery = subfoldersQuery.eq('tenant_id', tenant.tenantId)
    }

    const { count: subfoldersCount } = await subfoldersQuery

    // Count files
    let filesQuery = adminClient
      .from('r2_files')
      .select('*', { count: 'exact', head: true })
      .eq('folder_id', id)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      filesQuery = filesQuery.eq('tenant_id', tenant.tenantId)
    }

    const { count: filesCount } = await filesQuery

    // Calculate total size
    let fileSizeQuery = adminClient
      .from('r2_files')
      .select('file_size')
      .eq('folder_id', id)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      fileSizeQuery = fileSizeQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data: filesData } = await fileSizeQuery

    const totalSize = (filesData || []).reduce((sum, file) => sum + (file.file_size || 0), 0)

    return NextResponse.json({
      success: true,
      folder,
      stats: {
        subfoldersCount: subfoldersCount || 0,
        filesCount: filesCount || 0,
        totalSize
      }
    })
  } catch (error) {
    console.error('Error in GET /api/drive/folders/[id]:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
})

/**
 * PUT /api/drive/folders/[id]
 * Rename folder
 * - Body: { name }
 * - Update path for this folder and all descendants
 */
export const PUT = withTenant(async (
  request: NextRequest,
  { tenant, params }: { tenant: { tenantId: string | null; isSuperAdmin: boolean; memberRole: string }; params?: Record<string, string> }
) => {
  try {
    const id = params?.id
    if (!id) {
      return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 })
    }

    const body = await request.json() as {
      name?: string
    }

    if (!body.name || body.name.trim() === '') {
      return NextResponse.json(
        { error: 'Folder name is required' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // Fetch existing folder
    let folderQuery = adminClient
      .from('r2_folders')
      .select('*')
      .eq('id', id)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      folderQuery = folderQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data: existingFolder, error: fetchError } = await folderQuery.single()

    if (fetchError) {
      console.error('Error fetching folder:', fetchError)
      return NextResponse.json(
        { error: `Folder not found: ${fetchError.message}` },
        { status: fetchError.code === 'PGRST116' ? 404 : 500 }
      )
    }

    // Check for duplicate name in same parent
    let duplicateQuery = adminClient
      .from('r2_folders')
      .select('id')
      .eq('name', body.name.trim())
      .neq('id', id)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      duplicateQuery = duplicateQuery.eq('tenant_id', tenant.tenantId)
    }

    if (existingFolder.parent_id) {
      duplicateQuery = duplicateQuery.eq('parent_id', existingFolder.parent_id)
    } else {
      duplicateQuery = duplicateQuery.is('parent_id', null)
    }

    const { data: duplicateFolder } = await duplicateQuery.maybeSingle()

    if (duplicateFolder) {
      return NextResponse.json(
        { error: 'A folder with this name already exists in this location' },
        { status: 409 }
      )
    }

    // Calculate new path
    const oldPath = existingFolder.path
    const pathParts = oldPath.split('/')
    pathParts[pathParts.length - 1] = body.name.trim()
    const newPath = pathParts.join('/')

    // Update folder
    const { data: updatedFolder, error: updateError } = await adminClient
      .from('r2_folders')
      .update({
        name: body.name.trim(),
        path: newPath,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating folder:', updateError)
      return NextResponse.json(
        { error: `Failed to update folder: ${updateError.message}` },
        { status: 500 }
      )
    }

    // Update descendant paths (recursive update)
    // Find all descendants and update their paths
    const { data: descendants } = await adminClient
      .from('r2_folders')
      .select('id, path')
      .like('path', `${oldPath}/%`)

    if (descendants && descendants.length > 0) {
      for (const descendant of descendants) {
        const updatedDescendantPath = descendant.path.replace(oldPath, newPath)
        await adminClient
          .from('r2_folders')
          .update({
            path: updatedDescendantPath,
            updated_at: new Date().toISOString()
          })
          .eq('id', descendant.id)
      }
    }

    return NextResponse.json({
      success: true,
      folder: updatedFolder,
      updatedDescendants: descendants?.length || 0
    })
  } catch (error) {
    console.error('Error in PUT /api/drive/folders/[id]:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
})

/**
 * DELETE /api/drive/folders/[id]
 * Delete folder
 * - Must be empty (no subfolders or files) unless recursive=true
 * - Query param: ?recursive=true for recursive deletion
 */
export const DELETE = withTenant(async (
  request: NextRequest,
  { tenant, params }: { tenant: { tenantId: string | null; isSuperAdmin: boolean; memberRole: string }; params?: Record<string, string> }
) => {
  try {
    const id = params?.id
    if (!id) {
      return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const recursive = searchParams.get('recursive') === 'true'

    const adminClient = createAdminClient()

    // Fetch folder
    let folderQuery = adminClient
      .from('r2_folders')
      .select('*')
      .eq('id', id)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      folderQuery = folderQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data: folder, error: fetchError } = await folderQuery.single()

    if (fetchError) {
      console.error('Error fetching folder:', fetchError)
      return NextResponse.json(
        { error: `Folder not found: ${fetchError.message}` },
        { status: fetchError.code === 'PGRST116' ? 404 : 500 }
      )
    }

    if (!recursive) {
      // Check if folder is empty
      const { count: subfoldersCount } = await adminClient
        .from('r2_folders')
        .select('*', { count: 'exact', head: true })
        .eq('parent_id', id)

      const { count: filesCount } = await adminClient
        .from('r2_files')
        .select('*', { count: 'exact', head: true })
        .eq('folder_id', id)

      if ((subfoldersCount && subfoldersCount > 0) || (filesCount && filesCount > 0)) {
        return NextResponse.json(
          {
            error: 'Folder is not empty. Use recursive=true to delete folder and its contents.',
            subfoldersCount: subfoldersCount || 0,
            filesCount: filesCount || 0
          },
          { status: 400 }
        )
      }
    } else {
      // Recursive deletion
      // 1. Delete all files in this folder and descendants
      const { data: descendantFolders } = await adminClient
        .from('r2_folders')
        .select('id')
        .or(`id.eq.${id},path.like.${folder.path}/%`)

      const folderIds = descendantFolders?.map(f => f.id) || [id]

      // Delete files in all these folders
      await adminClient
        .from('r2_files')
        .delete()
        .in('folder_id', folderIds)

      // 2. Delete all descendant folders
      await adminClient
        .from('r2_folders')
        .delete()
        .like('path', `${folder.path}/%`)
    }

    // Delete the folder itself
    const { error: deleteError } = await adminClient
      .from('r2_folders')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting folder:', deleteError)
      return NextResponse.json(
        { error: `Failed to delete folder: ${deleteError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true
    })
  } catch (error) {
    console.error('Error in DELETE /api/drive/folders/[id]:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
})
