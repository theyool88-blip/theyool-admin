import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withTenant, withTenantId } from '@/lib/api/with-tenant'

/**
 * GET /api/drive/folders?parentId=xxx
 * List folders and files in a directory
 * - If no parentId, return root folders
 * - Include tenant isolation
 * - Return folders and files with metadata
 */
export const GET = withTenant(async (request: NextRequest, { tenant }) => {
  try {
    const { searchParams } = new URL(request.url)
    const parentId = searchParams.get('parentId')

    const adminClient = createAdminClient()

    // Fetch folders
    let foldersQuery = adminClient
      .from('r2_folders')
      .select('*')
      .order('display_order', { ascending: true })
      .order('name', { ascending: true })

    // Apply tenant filter
    if (!tenant.isSuperAdmin && tenant.tenantId) {
      foldersQuery = foldersQuery.eq('tenant_id', tenant.tenantId)
    }

    // Apply parent filter
    if (parentId) {
      foldersQuery = foldersQuery.eq('parent_id', parentId)
    } else {
      foldersQuery = foldersQuery.is('parent_id', null)
    }

    const { data: folders, error: foldersError } = await foldersQuery

    if (foldersError) {
      console.error('Error fetching folders:', foldersError)
      return NextResponse.json(
        { error: `Failed to fetch folders: ${foldersError.message}` },
        { status: 500 }
      )
    }

    // Fetch files in the current folder
    let filesQuery = adminClient
      .from('r2_files')
      .select('*')
      .order('display_name', { ascending: true })

    // Apply tenant filter
    if (!tenant.isSuperAdmin && tenant.tenantId) {
      filesQuery = filesQuery.eq('tenant_id', tenant.tenantId)
    }

    // Apply folder filter
    if (parentId) {
      filesQuery = filesQuery.eq('folder_id', parentId)
    } else {
      filesQuery = filesQuery.is('folder_id', null)
    }

    const { data: files, error: filesError } = await filesQuery

    if (filesError) {
      console.error('Error fetching files:', filesError)
      return NextResponse.json(
        { error: `Failed to fetch files: ${filesError.message}` },
        { status: 500 }
      )
    }

    // Fetch current folder details if parentId is provided
    let currentFolder = null
    if (parentId) {
      let currentFolderQuery = adminClient
        .from('r2_folders')
        .select('*')
        .eq('id', parentId)

      if (!tenant.isSuperAdmin && tenant.tenantId) {
        currentFolderQuery = currentFolderQuery.eq('tenant_id', tenant.tenantId)
      }

      const { data: folderData } = await currentFolderQuery.single()
      currentFolder = folderData
    }

    // Build breadcrumbs
    const breadcrumbs: { id: string; name: string; path: string }[] = []
    if (currentFolder) {
      // Build breadcrumbs by traversing up the parent chain
      let current = currentFolder
      breadcrumbs.unshift({
        id: current.id,
        name: current.name,
        path: current.path
      })

      while (current.parent_id) {
        const { data: parentFolder } = await adminClient
          .from('r2_folders')
          .select('*')
          .eq('id', current.parent_id)
          .single()

        if (parentFolder) {
          breadcrumbs.unshift({
            id: parentFolder.id,
            name: parentFolder.name,
            path: parentFolder.path
          })
          current = parentFolder
        } else {
          break
        }
      }
    }

    return NextResponse.json({
      success: true,
      folders: folders || [],
      files: files || [],
      currentFolder,
      breadcrumbs
    })
  } catch (error) {
    console.error('Error in GET /api/drive/folders:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
})

/**
 * POST /api/drive/folders
 * Create new folder
 * - Body: { name, parentId?, caseId?, isContractFolder? }
 * - Validate permissions (contract folders need admin/owner)
 * - Auto-generate path based on parent
 */
export const POST = withTenant(async (request: NextRequest, { tenant }) => {
  try {
    const body = await request.json() as {
      name?: string
      parentId?: string
      caseId?: string
      isContractFolder?: boolean
      displayOrder?: number
    }

    // Validate required fields
    if (!body.name || body.name.trim() === '') {
      return NextResponse.json(
        { error: 'Folder name is required' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // Validate contract folder permissions
    if (body.isContractFolder) {
      // Check if user has admin/owner role
      if (!tenant.isSuperAdmin && tenant.memberRole !== 'admin' && tenant.memberRole !== 'owner') {
        return NextResponse.json(
          { error: 'Only admin or owner can create contract folders' },
          { status: 403 }
        )
      }
    }

    // Determine parent folder details
    let parentFolder = null
    let parentPath = ''
    let depth = 0

    if (body.parentId) {
      let parentQuery = adminClient
        .from('r2_folders')
        .select('*')
        .eq('id', body.parentId)

      if (!tenant.isSuperAdmin && tenant.tenantId) {
        parentQuery = parentQuery.eq('tenant_id', tenant.tenantId)
      }

      const { data, error } = await parentQuery.single()

      if (error || !data) {
        return NextResponse.json(
          { error: 'Parent folder not found' },
          { status: 404 }
        )
      }

      parentFolder = data
      parentPath = data.path
      depth = (data.depth || 0) + 1
      // Suppress unused variable warning
      void parentFolder
    }

    // Generate folder path
    const folderName = body.name.trim()
    const folderPath = parentPath
      ? `${parentPath}/${folderName}`
      : `/${tenant.tenantId}/${folderName}`

    // Check for duplicate folder name in same parent
    let duplicateQuery = adminClient
      .from('r2_folders')
      .select('id')
      .eq('name', folderName)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      duplicateQuery = duplicateQuery.eq('tenant_id', tenant.tenantId)
    }

    if (body.parentId) {
      duplicateQuery = duplicateQuery.eq('parent_id', body.parentId)
    } else {
      duplicateQuery = duplicateQuery.is('parent_id', null)
    }

    const { data: existingFolder } = await duplicateQuery.maybeSingle()

    if (existingFolder) {
      return NextResponse.json(
        { error: 'A folder with this name already exists in this location' },
        { status: 409 }
      )
    }

    // Create folder
    const newFolderData = withTenantId({
      name: folderName,
      path: folderPath,
      parent_id: body.parentId || null,
      case_id: body.caseId || null,
      is_contract_folder: body.isContractFolder || false,
      depth,
      display_order: body.displayOrder || 0,
    }, tenant)

    const { data: newFolder, error: createError } = await adminClient
      .from('r2_folders')
      .insert([newFolderData])
      .select()
      .single()

    if (createError) {
      console.error('Error creating folder:', createError)
      return NextResponse.json(
        { error: `Failed to create folder: ${createError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      folder: newFolder
    })
  } catch (error) {
    console.error('Error in POST /api/drive/folders:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
})
